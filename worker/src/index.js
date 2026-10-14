import { DurableObject } from 'cloudflare:workers';
import { goalNotices, resultNotices } from './notices.js';
import { publicKeyOf, sendPush, toSubscription, vapidKeys } from './push.js';
import { timerAlerts, timerNotice } from './timer.js';

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const ID_LENGTH = 10;
const ID_PATTERN = new RegExp(`^[${ID_ALPHABET}]{${ID_LENGTH}}$`);
const DEVICE_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_SUBSCRIPTION_BYTES = 4 * 1024;
const MAX_SUBSCRIPTIONS = 500;
const PUSH_PREFIX = 'push:';
const ADMIN_PUSH_PREFIX = 'adminpush:';
const MAX_ADMIN_SUBSCRIPTIONS = 20;
// Alarm ve gönderim birkaç yüz ms sapabilir; tam o anda gelen bir değişiklik uyarıyı düşürmesin.
const ALERT_GRACE_MS = 5000;
// "Son 1 dakika" bir dakika sonra artık geçersizdir.
const ALERT_TTL_S = 60;
// Yönetici cihazı 25 sn'de bir haber verir; iki haber kaçarsa izleyicilere "bağlı değil" denir.
const PRESENCE_MS = 70 * 1000;

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

async function readJson(request, maxBytes) {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new HttpError('too_large', 413);
  const raw = await request.arrayBuffer();
  if (raw.byteLength > maxBytes) throw new HttpError('too_large', 413);
  try {
    return JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new HttpError('bad_request', 400);
  }
}

// İzleyici linkinin id'si hash'te; ana ekrana eklenen uygulama onu yalnız manifestteki başlangıç adresinden öğrenir.
function watchManifest(id) {
  const icon = (src, extra = {}) => ({ src, sizes: '512x512', type: 'image/png', ...extra });
  const manifest = {
    id: '/izle',
    name: 'Halı Saha Canlı',
    short_name: 'Halı Saha Canlı',
    lang: 'tr',
    start_url: ID_PATTERN.test(id || '') ? `/izle#${id}` : '/izle',
    scope: '/izle',
    display: 'standalone',
    background_color: '#0a4d32',
    theme_color: '#0a4d32',
    icons: [
      icon('/icons/izle-192.png', { sizes: '192x192' }),
      icon('/icons/izle-512.png'),
      icon('/icons/izle-maskable-512.png', { purpose: 'maskable' }),
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    const { pathname, searchParams } = new URL(request.url);

    if (pathname === '/izle.webmanifest') return watchManifest(searchParams.get('id'));

    if (pathname === '/api/push-key') return env.VAPID_KEY ? json({ key: publicKeyOf(env.VAPID_KEY) }) : fail('push_disabled', 404);

    if (pathname === '/api/t') {
      if (request.method !== 'POST') return fail('method_not_allowed', 405);
      const id = randomId();
      const adminToken = randomToken();
      if (!(await stub(env, id).init(toHex(await sha256(adminToken))))) return fail('conflict', 409);
      return json({ id, adminToken }, 201);
    }

    const route = pathname.match(/^\/api\/t\/([^/]+)(?:\/(ws|takeover|push|admin-push))?$/);
    if (route && ID_PATTERN.test(route[1])) return stub(env, route[1]).fetch(request);

    return pathname.startsWith('/api/') ? fail('not_found', 404) : new Response('Bulunamadı', { status: 404 });
  },
};

export class Turnuva extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // İzleyiciler bağlantıyı canlı tutmak için "ping" gönderir; cevap DO'yu uyandırmadan verilir.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.presenceMs = Number(env.PRESENCE_MS) || PRESENCE_MS;
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
      if (action === 'push' && request.method === 'POST') return await this.subscribe(request);
      if (action === 'push' && request.method === 'DELETE') return await this.unsubscribe(request, PUSH_PREFIX);
      if (action === 'admin-push' && request.method === 'POST') return await this.subscribeAdmin(request);
      if (action === 'admin-push' && request.method === 'DELETE') return await this.unsubscribe(request, ADMIN_PUSH_PREFIX);
      if (action === '' && request.method === 'GET') return json(await this.snapshot());
      if (action === '' && request.method === 'PUT') return await this.update(request);
      return fail('method_not_allowed', 405);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.message, err.status, err.extra);
      throw err;
    }
  }

  async snapshot() {
    const stored = await this.ctx.storage.get(['rev', 'state', 'clockOffset', 'holder', 'seenAt']);
    const serverTime = Date.now();
    return {
      rev: stored.get('rev') ?? 0,
      state: stored.get('state') ?? null,
      clockOffset: stored.get('clockOffset') ?? 0,
      holder: stored.get('holder') ?? null,
      holderOnline: this.isOnline(stored.get('holder'), stored.get('seenAt'), serverTime),
      serverTime,
    };
  }

  isOnline(holder, seenAt, now = Date.now()) {
    return holder != null && seenAt != null && now - seenAt < this.presenceMs;
  }

  // Yönetici cihazından gelen her işaret (gönderim, devir, haber) cihazın bağlı olduğunu gösterir.
  async markSeen(now = Date.now()) {
    await this.ctx.storage.put('seenAt', now);
    await this.armAlarm(now);
  }

  // Tek alarm hem yönetici cihazının haberini hem süre uyarılarını bekler.
  async armAlarm(now = Date.now()) {
    const stored = await this.ctx.storage.get(['seenAt', 'alerts']);
    const times = (stored.get('alerts') ?? []).map((a) => a.at);
    const presenceAt = (stored.get('seenAt') ?? -Infinity) + this.presenceMs;
    if (presenceAt > now) times.push(presenceAt);
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
  }

  broadcast(snapshot) {
    const message = JSON.stringify({ type: 'state', ...snapshot });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message);
      } catch {}
    }
  }

  async tokenMatches(token) {
    const tokenHash = await this.ctx.storage.get('tokenHash');
    return !!token && crypto.subtle.timingSafeEqual(await sha256(token), fromHex(tokenHash));
  }

  async readAdminRequest(request) {
    const auth = request.headers.get('authorization') || '';
    if (!(await this.tokenMatches(auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''))) throw new HttpError('unauthorized', 401);

    const body = await readJson(request, MAX_BODY_BYTES);
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
    const before = await this.snapshot();
    const changed = before.holder !== device;
    if (changed) await this.ctx.storage.put('holder', device);
    await this.markSeen();
    const snapshot = await this.snapshot();
    // Yönetimi kaybeden cihaz da bu kanalı dinliyorsa salt okunura hemen geçer.
    if (changed || !before.holderOnline) this.broadcast(snapshot);
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

    const before = await this.ctx.storage.get('state');
    const notices = [...goalNotices(before, state), ...resultNotices(before, state)];
    const rev = current + 1;
    const serverTime = Date.now();
    // Organizatör saatiyle sunucu saati arasındaki fark; izleyici kalan süreyi bununla düzeltir.
    const clockOffset = serverTime - sentAt;
    const due = await this.takeDueAlert(serverTime);
    await this.ctx.storage.put({ rev, state, clockOffset, holder: device, updatedAt: serverTime });
    await this.planAlerts(state, clockOffset, serverTime);
    await this.markSeen(serverTime);
    this.broadcast({ rev, state, clockOffset, holder: device, holderOnline: true, serverTime });
    if (notices.length && this.env.VAPID_KEY) this.ctx.waitUntil(this.notify(notices, request.url));
    if (due) this.ctx.waitUntil(this.sendAlert(due));
    return json({ rev, serverTime });
  }

  // Duraklatma ve maç bitişi her gönderimde gelir; uyarılar her seferinde baştan hesaplanır.
  async planAlerts(state, clockOffset, now) {
    if (!this.env.VAPID_KEY) return;
    const { match, alerts } = timerAlerts(state, clockOffset);
    const sent = ((await this.ctx.storage.get('alertsSent')) ?? []).filter((key) => key.startsWith(`${match}:`));
    const pending = alerts.filter((a) => a.at > now - ALERT_GRACE_MS && !sent.includes(a.key));
    await this.ctx.storage.put({ alerts: pending, alertsSent: sent });
  }

  // Aynı anda birden çok uyarının vakti geldiyse yalnız sonuncusu gönderilir.
  async takeDueAlert(now) {
    const stored = await this.ctx.storage.get(['alerts', 'alertsSent', 'state']);
    const alerts = stored.get('alerts') ?? [];
    const due = alerts.filter((a) => a.at <= now);
    if (!due.length) return null;
    await this.ctx.storage.put({ alerts: alerts.filter((a) => a.at > now), alertsSent: [...(stored.get('alertsSent') ?? []), ...due.map((a) => a.key)] });
    return timerNotice(stored.get('state'), due.at(-1));
  }

  async sendAlert(notice) {
    const origin = await this.ctx.storage.get('origin');
    if (origin) await this.send(ADMIN_PUSH_PREFIX, [{ ...notice, url: '/', icon: '/icons/app-192.png', skipIfOpen: true }], origin, ALERT_TTL_S);
  }

  async subscribe(request) {
    if (!this.env.VAPID_KEY) throw new HttpError('push_disabled', 404);
    const sub = toSubscription(await readJson(request, MAX_SUBSCRIPTION_BYTES), this.env.PUSH_TEST_ORIGIN);
    if (!sub) throw new HttpError('bad_request', 400);
    await this.saveSubscription(PUSH_PREFIX, sub, MAX_SUBSCRIPTIONS);
    return json({ subscribed: true });
  }

  // Süre uyarıları yalnız yönetici linkini bilen cihazlara gider. Alarm bir isteğe bağlı olmadığından
  // VAPID'deki iletişim adresi için sitenin adresi burada saklanır.
  async subscribeAdmin(request) {
    if (!this.env.VAPID_KEY) throw new HttpError('push_disabled', 404);
    const { subscription } = await this.readAdminRequest(request);
    const sub = toSubscription(subscription, this.env.PUSH_TEST_ORIGIN);
    if (!sub) throw new HttpError('bad_request', 400);
    await this.saveSubscription(ADMIN_PUSH_PREFIX, sub, MAX_ADMIN_SUBSCRIPTIONS);
    await this.ctx.storage.put('origin', new URL(request.url).origin);
    return json({ subscribed: true });
  }

  async saveSubscription(prefix, sub, max) {
    const key = prefix + toHex(await sha256(sub.endpoint));
    if (!(await this.ctx.storage.get(key)) && (await this.ctx.storage.list({ prefix })).size >= max) throw new HttpError('too_many', 429);
    await this.ctx.storage.put(key, sub);
  }

  async unsubscribe(request, prefix) {
    const { endpoint } = (await readJson(request, MAX_SUBSCRIPTION_BYTES)) ?? {};
    if (typeof endpoint !== 'string') throw new HttpError('bad_request', 400);
    await this.ctx.storage.delete(prefix + toHex(await sha256(endpoint)));
    return json({ subscribed: false });
  }

  async notify(notices, requestUrl) {
    const { origin, pathname } = new URL(requestUrl);
    const url = `/izle#${pathname.split('/')[3]}`;
    await this.send(PUSH_PREFIX, notices.map((notice) => ({ ...notice, url })), origin);
  }

  async send(prefix, payloads, subject, ttl) {
    const subs = await this.ctx.storage.list({ prefix });
    this.vapid ??= vapidKeys(this.env.VAPID_KEY);
    const vapid = await this.vapid;
    await Promise.allSettled(
      [...subs].map(async ([key, sub]) => {
        for (const payload of payloads) {
          const status = await sendPush(sub, JSON.stringify(payload), vapid, { subject, ttl });
          // Servis aboneliğin bittiğini söylüyorsa (uygulama silindi, izin geri alındı) bir daha denenmez.
          if (status === 404 || status === 410) return this.ctx.storage.delete(key);
          if (status >= 400) console.warn(`push ${status} ${new URL(sub.endpoint).host}`);
        }
      }),
    ).then((results) => results.forEach((r) => r.status === 'rejected' && console.warn(`push hata: ${r.reason}`)));
  }

  async webSocketMessage(ws, message) {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    if (msg?.type !== 'beat' || typeof msg.token !== 'string') return;
    const stored = await this.ctx.storage.get(['holder', 'seenAt']);
    if (msg.device !== stored.get('holder') || !(await this.tokenMatches(msg.token))) return;
    const wasOnline = this.isOnline(stored.get('holder'), stored.get('seenAt'));
    await this.markSeen();
    if (!wasOnline) this.broadcast(await this.snapshot());
  }

  async alarm() {
    const now = Date.now();
    const due = await this.takeDueAlert(now);
    const snapshot = await this.snapshot();
    if (!snapshot.holderOnline) this.broadcast(snapshot);
    await this.armAlarm(now);
    if (due) await this.sendAlert(due);
  }

  webSocketClose(ws, code, reason) {
    try {
      ws.close(code, reason);
    } catch {}
  }
}
