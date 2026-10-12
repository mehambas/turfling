import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { unstable_startWorker } from 'wrangler';

const config = fileURLToPath(new URL('../wrangler.toml', import.meta.url));

let worker;
let base;

before(async () => {
  worker = await unstable_startWorker({
    config,
    dev: { server: { port: 0 }, inspector: false, persist: false, logLevel: 'none', watch: false },
  });
  base = String(await worker.url).replace(/\/$/, '');
});

after(async () => {
  await worker?.dispose();
});

const DEVICE_A = 'cihaz-aaaaaaaa';
const DEVICE_B = 'cihaz-bbbbbbbb';

const sampleState = (extra = {}) => ({
  version: 1,
  name: 'Test',
  players: [{ id: 'p1', name: 'Ali' }],
  teams: [
    { id: 'A', name: 'Kırmızılar', color: 'red', playerIds: ['p1'] },
    { id: 'B', name: 'Maviler', color: 'blue', playerIds: [] },
    { id: 'C', name: 'Sarılar', color: 'yellow', playerIds: [] },
  ],
  settings: {},
  started: true,
  matches: [],
  lots: {},
  ...extra,
});

async function api(path, { method = 'GET', token, body, rawBody } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined || rawBody !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}
  return { status: res.status, data, text, headers: res.headers };
}

async function createTournament() {
  const res = await api('/api/t', { method: 'POST' });
  assert.equal(res.status, 201);
  return res.data;
}

const put = (t, { device = DEVICE_A, baseRev, sentAt = Date.now(), state = sampleState(), token = t.adminToken } = {}) =>
  api(`/api/t/${t.id}`, { method: 'PUT', token, body: { device, baseRev, sentAt, state } });

const takeover = (t, device, token = t.adminToken) => api(`/api/t/${t.id}/takeover`, { method: 'POST', token, body: { device } });

function openSocket(id) {
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/api/t/${id}/ws`);
  const queue = [];
  const waiters = [];
  ws.addEventListener('message', (e) => {
    const waiter = waiters.shift();
    if (waiter) waiter(e.data);
    else queue.push(e.data);
  });
  const next = () =>
    new Promise((resolve, reject) => {
      if (queue.length) return resolve(queue.shift());
      const timer = setTimeout(() => reject(new Error('mesaj gelmedi')), 3000);
      waiters.push((data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  return { ws, next, opened };
}

describe('turnuva oluşturma', () => {
  test('id ve yönetici anahtarı döner, başlangıç hâli boştur', async () => {
    const t = await createTournament();
    assert.match(t.id, /^[a-z2-9]{10}$/);
    assert.ok(t.adminToken.length >= 32);

    const res = await api(`/api/t/${t.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.data.rev, 0);
    assert.equal(res.data.state, null);
    assert.equal(res.data.holder, null);
    assert.ok(Math.abs(res.data.serverTime - Date.now()) < 5000);
  });

  test('her seferinde farklı id ve anahtar', async () => {
    const [a, b] = await Promise.all([createTournament(), createTournament()]);
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.adminToken, b.adminToken);
  });

  test('bilinmeyen ya da geçersiz id 404', async () => {
    assert.equal((await api('/api/t/abcdefghij')).status, 404);
    assert.equal((await api('/api/t/ABC')).status, 404);
    assert.equal((await api('/api/t/abcdefghij/ws')).status, 404);
    assert.equal((await api('/api/baska')).status, 404);
  });

  test('yanlış yöntem 405', async () => {
    assert.equal((await api('/api/t')).status, 405);
    const t = await createTournament();
    assert.equal((await api(`/api/t/${t.id}`, { method: 'DELETE' })).status, 405);
    assert.equal((await api(`/api/t/${t.id}/takeover`)).status, 405);
  });
});

describe('yazma yetkisi', () => {
  test('anahtarsız ya da yanlış anahtarla yazılamaz', async () => {
    const t = await createTournament();
    assert.equal((await put(t, { baseRev: 0, token: null })).status, 401);
    assert.equal((await put(t, { baseRev: 0, token: 'yanlis' })).status, 401);
    const other = await createTournament();
    assert.equal((await put(t, { baseRev: 0, token: other.adminToken })).status, 401);
    assert.equal((await takeover(t, DEVICE_A, 'yanlis')).status, 401);
    assert.equal((await api(`/api/t/${t.id}`)).data.rev, 0);
  });

  test('ilk yazan cihaz yönetimi alır, sürüm sunucuda artar', async () => {
    const t = await createTournament();
    const first = await put(t, { baseRev: 0 });
    assert.equal(first.status, 200);
    assert.equal(first.data.rev, 1);

    const second = await put(t, { baseRev: 1, state: sampleState({ name: 'İkinci' }) });
    assert.equal(second.data.rev, 2);

    const res = await api(`/api/t/${t.id}`);
    assert.equal(res.data.rev, 2);
    assert.equal(res.data.holder, DEVICE_A);
    assert.equal(res.data.state.name, 'İkinci');
    assert.equal(res.data.state.teams[0].name, 'Kırmızılar');
  });

  test('eski sürümün üstüne yapılan değişiklik reddedilir ve son hâl döner', async () => {
    const t = await createTournament();
    await put(t, { baseRev: 0, state: sampleState({ name: 'Bir' }) });
    await put(t, { baseRev: 1, state: sampleState({ name: 'İki' }) });

    for (const baseRev of [0, 1, 3]) {
      const res = await put(t, { baseRev, state: sampleState({ name: 'Ezen' }) });
      assert.equal(res.status, 409);
      assert.equal(res.data.error, 'stale');
      assert.equal(res.data.rev, 2);
      assert.equal(res.data.state.name, 'İki');
    }
  });

  test('yönetim başka cihazdayken yazılamaz, devralınca yazılır', async () => {
    const t = await createTournament();
    await put(t, { baseRev: 0, device: DEVICE_A });

    const blocked = await put(t, { baseRev: 1, device: DEVICE_B });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.data.error, 'not_holder');
    assert.equal(blocked.data.holder, DEVICE_A);

    const taken = await takeover(t, DEVICE_B);
    assert.equal(taken.status, 200);
    assert.equal(taken.data.holder, DEVICE_B);
    assert.equal(taken.data.rev, 1);
    assert.equal(taken.data.state.name, 'Test');

    assert.equal((await put(t, { baseRev: 1, device: DEVICE_B })).data.rev, 2);
    const old = await put(t, { baseRev: 2, device: DEVICE_A });
    assert.equal(old.status, 409);
    assert.equal(old.data.error, 'not_holder');

    await takeover(t, DEVICE_A);
    assert.equal((await put(t, { baseRev: 2, device: DEVICE_A })).data.rev, 3);
  });

  test('bozuk istekler 400, büyük gövde 413', async () => {
    const t = await createTournament();
    assert.equal((await api(`/api/t/${t.id}`, { method: 'PUT', token: t.adminToken, rawBody: '{bozuk' })).status, 400);
    assert.equal((await put(t, { baseRev: 0, device: 'kısa' })).status, 400);
    assert.equal((await put(t, { baseRev: -1 })).status, 400);
    assert.equal((await put(t, { baseRev: 0, sentAt: 'dün' })).status, 400);
    assert.equal((await put(t, { baseRev: 0, state: { players: [] } })).status, 400);
    assert.equal((await put(t, { baseRev: 0, state: [] })).status, 400);
    assert.equal((await takeover(t, '')).status, 400);

    const big = sampleState({ name: 'x'.repeat(70 * 1024) });
    assert.equal((await put(t, { baseRev: 0, state: big })).status, 413);
    assert.equal((await api(`/api/t/${t.id}`)).data.rev, 0);
  });

  test('organizatör saati ile sunucu saati arasındaki fark kaydedilir', async () => {
    const t = await createTournament();
    await put(t, { baseRev: 0, sentAt: Date.now() - 90_000 });
    const res = await api(`/api/t/${t.id}`);
    assert.ok(Math.abs(res.data.clockOffset - 90_000) < 2000, `clockOffset ${res.data.clockOffset}`);
  });
});

describe('izleyici WebSocket', () => {
  test('bağlanınca son hâl, her değişiklikte yenisi gelir', async () => {
    const t = await createTournament();
    await put(t, { baseRev: 0, state: sampleState({ name: 'Önce' }) });

    const { ws, next, opened } = openSocket(t.id);
    await opened;
    const first = JSON.parse(await next());
    assert.equal(first.type, 'state');
    assert.equal(first.rev, 1);
    assert.equal(first.state.name, 'Önce');

    await put(t, { baseRev: 1, state: sampleState({ name: 'Sonra' }), sentAt: Date.now() - 1000 });
    const second = JSON.parse(await next());
    assert.equal(second.rev, 2);
    assert.equal(second.state.name, 'Sonra');
    assert.ok(second.clockOffset >= 1000);

    await put(t, { baseRev: 0, state: sampleState({ name: 'Reddedilen' }) });
    await takeover(t, DEVICE_B);
    const third = JSON.parse(await next());
    assert.equal(third.holder, DEVICE_B);
    assert.equal(third.rev, 2);

    ws.send('ping');
    assert.equal(await next(), 'pong');
    ws.close();
  });

  test('aynı cihaz yeniden devralırsa yayın yapılmaz', async () => {
    const t = await createTournament();
    await put(t, { baseRev: 0, device: DEVICE_A });
    const { ws, next, opened } = openSocket(t.id);
    await opened;
    await next();
    await takeover(t, DEVICE_A);
    ws.send('ping');
    assert.equal(await next(), 'pong');
    ws.close();
  });

  test('yükseltme olmadan 426', async () => {
    const t = await createTournament();
    assert.equal((await api(`/api/t/${t.id}/ws`)).status, 426);
  });
});

describe('statik dosyalar', () => {
  test('uygulama sunulur', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<title>Halı Saha Turnuvası<\/title>/);
    assert.equal((await fetch(`${base}/js/tournament.js`)).status, 200);
    assert.equal((await fetch(`${base}/fonts/fonts.css`)).status, 200);
  });

  test('worker, testler ve depo dosyaları sunulmaz', async () => {
    for (const path of ['/worker/src/index.js', '/worker/wrangler.toml', '/tests/tournament.test.js', '/README.md', '/.git/config', '/.gitignore', '/.assetsignore']) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
  });
});
