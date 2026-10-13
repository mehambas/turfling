import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { publicKeyOf } from '../src/push.js';
import { newVapidSecret, pushClient, sampleState, startWorker, waitFor } from './helpers.js';

const DEVICE = 'cihaz-aaaaaaaa';

let worker;
let base;
let secret;
let service;
let serviceOrigin;
const received = [];
const gone = new Set();

before(async () => {
  service = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      received.push({ path: req.url, headers: req.headers, body: new Uint8Array(Buffer.concat(chunks)) });
      res.writeHead(gone.has(req.url) ? 410 : 201).end();
    });
  });
  await new Promise((resolve) => service.listen(0, '127.0.0.1', resolve));
  serviceOrigin = `http://127.0.0.1:${service.address().port}`;
  secret = await newVapidSecret();
  worker = await startWorker({ vars: { VAPID_KEY: secret, PUSH_TEST_ORIGIN: serviceOrigin } });
  base = worker.base;
});

after(async () => {
  await worker?.dispose();
  service?.close();
});

const send = (path, method, body, headers = {}) =>
  fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });

async function createTournament() {
  const res = await send('/api/t', 'POST');
  return res.json();
}

function live(goals) {
  return sampleState({
    players: [{ id: 'p1', name: 'Ali' }],
    matches: [{ id: 'm1', stage: 'league', home: 'A', away: 'B', status: 'live', goals }],
  });
}

async function publish(t, state) {
  t.rev ??= 0;
  const res = await send(`/api/t/${t.id}`, 'PUT', { device: DEVICE, baseRev: t.rev, sentAt: Date.now(), state }, { authorization: `Bearer ${t.adminToken}` });
  assert.equal(res.status, 200);
  t.rev = (await res.json()).rev;
}

async function subscribe(t, path) {
  const client = await pushClient();
  const res = await send(`/api/t/${t.id}/push`, 'POST', { endpoint: serviceOrigin + path, expirationTime: null, keys: client.keys });
  assert.equal(res.status, 200);
  return client;
}

const arrivals = (path) => received.filter((r) => r.path === path);
const settle = () => new Promise((r) => setTimeout(r, 300));

describe('gol bildirimi', () => {
  test('açık anahtar sunulur', async () => {
    const res = await fetch(`${base}/api/push-key`);
    assert.deepEqual(await res.json(), { key: publicKeyOf(secret) });
  });

  test('yeni gol aboneye şifreli ve imzalı gider', async () => {
    const t = await createTournament();
    const client = await subscribe(t, '/sub/gol');
    await publish(t, live([]));
    await publish(t, live([{ id: 'g1', team: 'A', playerId: 'p1', ms: 60000 }]));

    const [push] = await waitFor(() => arrivals('/sub/gol').length && arrivals('/sub/gol'), 'push');
    assert.equal(push.headers['content-encoding'], 'aes128gcm');
    assert.equal(push.headers.ttl, '300');
    assert.equal(push.headers.urgency, 'high');
    assert.match(push.headers.authorization, new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${publicKeyOf(secret)}$`));
    assert.deepEqual(JSON.parse(await client.decrypt(push.body)), {
      title: 'Gol! Kırmızılar',
      body: 'Ali · Kırmızılar 1–0 Maviler',
      url: `/izle#${t.id}`,
    });
  });

  test('ilk yayın ve golsüz değişiklik bildirim göndermez', async () => {
    const t = await createTournament();
    await subscribe(t, '/sub/sessiz');
    await publish(t, live([{ id: 'g1', team: 'A', playerId: 'p1', ms: 60000 }]));
    await publish(t, live([{ id: 'g1', team: 'A', playerId: null, ms: 60000 }]));
    await settle();
    assert.equal(arrivals('/sub/sessiz').length, 0);
  });

  test('aboneliği kapatan bildirim almaz', async () => {
    const t = await createTournament();
    await subscribe(t, '/sub/kapali');
    const res = await send(`/api/t/${t.id}/push`, 'DELETE', { endpoint: `${serviceOrigin}/sub/kapali` });
    assert.equal(res.status, 200);
    await publish(t, live([]));
    await publish(t, live([{ id: 'g1', team: 'B', playerId: null, ms: 1000 }]));
    await settle();
    assert.equal(arrivals('/sub/kapali').length, 0);
  });

  test('servis aboneliğin bittiğini söylerse abonelik silinir', async () => {
    const t = await createTournament();
    gone.add('/sub/bitti');
    await subscribe(t, '/sub/bitti');
    await publish(t, live([]));
    await publish(t, live([{ id: 'g1', team: 'A', playerId: null, ms: 1000 }]));
    await waitFor(() => arrivals('/sub/bitti').length === 1, 'ilk push');
    await publish(t, live([{ id: 'g1', team: 'A', playerId: null, ms: 1000 }, { id: 'g2', team: 'A', playerId: null, ms: 2000 }]));
    await settle();
    assert.equal(arrivals('/sub/bitti').length, 1);
  });

  test('bilinmeyen push adresi ve bozuk abonelik reddedilir', async () => {
    const t = await createTournament();
    const { keys } = await pushClient();
    assert.equal((await send(`/api/t/${t.id}/push`, 'POST', { endpoint: 'https://example.com/x', keys })).status, 400);
    assert.equal((await send(`/api/t/${t.id}/push`, 'POST', { endpoint: `${serviceOrigin}/x` })).status, 400);
    assert.equal((await send(`/api/t/${t.id}/push`, 'DELETE', {})).status, 400);
    assert.equal((await send(`/api/t/${t.id}/push`, 'PUT', {})).status, 405);
    assert.equal((await send('/api/t/aaaaaaaaaa/push', 'POST', { endpoint: `${serviceOrigin}/x`, keys })).status, 404);
  });
});
