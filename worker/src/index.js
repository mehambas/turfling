import { DurableObject } from 'cloudflare:workers';

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const ID_LENGTH = 10;
const ID_PATTERN = new RegExp(`^[${ID_ALPHABET}]{${ID_LENGTH}}$`);
const DEVICE_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_BODY_BYTES = 64 * 1024;

class HttpError extends Error {
  constructor(code, status, extra = {}) {
    super(code);
    this.status = status;
    this.extra = extra;
  }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const fail = (error, status, extra = {}) => json({ error, ...extra }, status);

function randomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(ID_LENGTH)), (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

const isState = (s) =>
  !!s && typeof s === 'object' && !Array.isArray(s) && Array.isArray(s.players) && Array.isArray(s.teams) && Array.isArray(s.matches);

const stub = (env, id) => env.TURNUVA.get(env.TURNUVA.idFromName(id));

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/t') {
      if (request.method !== 'POST') return fail('method_not_allowed', 405);
      const id = randomId();
      const adminToken = randomToken();
      if (!(await stub(env, id).init(toHex(await sha256(adminToken))))) return fail('conflict', 409);
      return json({ id, adminToken }, 201);
    }

    const route = pathname.match(/^\/api\/t\/([^/]+)(?:\/(ws|takeover))?$/);
    if (route && ID_PATTERN.test(route[1])) return stub(env, route[1]).fetch(request);

    return pathname.startsWith('/api/') ? fail('not_found', 404) : new Response('Bulunamadı', { status: 404 });
  },
};

export class Turnuva extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // İzleyiciler bağlantıyı canlı tutmak için "ping" gönderir; cevap DO'yu uyandırmadan verilir.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async init(tokenHash) {
    if (await this.ctx.storage.get('tokenHash')) return false;
    await this.ctx.storage.put({ tokenHash, rev: 0, state: null, clockOffset: 0, holder: null, createdAt: Date.now() });
    return true;
  }

  async fetch(request) {
    if (!(await this.ctx.storage.get('tokenHash'))) return fail('not_found', 404);
    const action = new URL(request.url).pathname.split('/')[4] ?? '';
    try {
      if (action === 'ws') return await this.connect(request);
      if (action === 'takeover' && request.method === 'POST') return await this.takeover(request);
      if (action === '' && request.method === 'GET') return json(await this.snapshot());
      if (action === '' && request.method === 'PUT') return await this.update(request);
      return fail('method_not_allowed', 405);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.message, err.status, err.extra);
      throw err;
    }
  }

  async snapshot() {
    const stored = await this.ctx.storage.get(['rev', 'state', 'clockOffset', 'holder']);
    return {
      rev: stored.get('rev') ?? 0,
      state: stored.get('state') ?? null,
      clockOffset: stored.get('clockOffset') ?? 0,
      holder: stored.get('holder') ?? null,
      serverTime: Date.now(),
    };
  }

  broadcast(snapshot) {
    const message = JSON.stringify({ type: 'state', ...snapshot });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message);
      } catch {}
    }
  }

  async readAdminRequest(request) {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const tokenHash = await this.ctx.storage.get('tokenHash');
    if (!token || !crypto.subtle.timingSafeEqual(await sha256(token), fromHex(tokenHash))) throw new HttpError('unauthorized', 401);

    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new HttpError('too_large', 413);
    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) throw new HttpError('too_large', 413);

    let body;
    try {
      body = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      throw new HttpError('bad_request', 400);
    }
    if (!body || typeof body !== 'object' || !DEVICE_PATTERN.test(body.device ?? '')) throw new HttpError('bad_request', 400);
    return body;
  }

  async connect(request) {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return fail('upgrade_required', 426);
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: 'state', ...(await this.snapshot()) }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async takeover(request) {
    const { device } = await this.readAdminRequest(request);
    const changed = (await this.ctx.storage.get('holder')) !== device;
    if (changed) await this.ctx.storage.put('holder', device);
    const snapshot = await this.snapshot();
    // Yönetimi kaybeden cihaz da bu kanalı dinliyorsa salt okunura hemen geçer.
    if (changed) this.broadcast(snapshot);
    return json(snapshot);
  }

  async update(request) {
    const { device, baseRev, sentAt, state } = await this.readAdminRequest(request);
    if (!Number.isSafeInteger(baseRev) || baseRev < 0 || !Number.isFinite(sentAt) || !isState(state)) throw new HttpError('bad_request', 400);

    // Aynı anda tek yönetici yazabilir; diğerleri önce devralmalı. Yönetimi henüz kimse almadıysa ilk yazan alır.
    const holder = await this.ctx.storage.get('holder');
    if (holder && holder !== device) throw new HttpError('not_holder', 409, await this.snapshot());

    // Yalnız sunucudaki son sürümün üstüne yapılan değişiklik kabul edilir; internetsiz kalmış
    // ya da devir sırasında geride kalmış bir cihaz başkasının girdiğini ezemez.
    const current = (await this.ctx.storage.get('rev')) ?? 0;
    if (baseRev !== current) throw new HttpError('stale', 409, await this.snapshot());

    const rev = current + 1;
    const serverTime = Date.now();
    // Organizatör saatiyle sunucu saati arasındaki fark; izleyici kalan süreyi bununla düzeltir.
    const clockOffset = serverTime - sentAt;
    await this.ctx.storage.put({ rev, state, clockOffset, holder: device, updatedAt: serverTime });
    this.broadcast({ rev, state, clockOffset, holder: device, serverTime });
    return json({ rev, serverTime });
  }

  webSocketMessage() {}

  webSocketClose(ws, code, reason) {
    try {
      ws.close(code, reason);
    } catch {}
  }
}
