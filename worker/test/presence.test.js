import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { memoryStorage, sampleState, startWorker, waitFor } from './helpers.js';

const LiveSync = createRequire(import.meta.url)('../../js/sync.js');
const PRESENCE_MS = 600;
const DEVICE = 'cihaz-aaaaaaaa';

let worker;
let base;

before(async () => {
  worker = await startWorker({ presenceMs: PRESENCE_MS });
  base = worker.base;
});

after(async () => {
  await worker?.dispose();
});

const create = async () => (await fetch(`${base}/api/t`, { method: 'POST' })).json();
const online = async (id) => (await (await fetch(`${base}/api/t/${id}`)).json()).holderOnline;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const put = (t, baseRev) =>
  fetch(`${base}/api/t/${t.id}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${t.adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ device: DEVICE, baseRev, sentAt: Date.now(), state: sampleState() }),
  });

function listen(id) {
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/api/t/${id}/ws`);
  const messages = [];
  ws.addEventListener('message', (e) => messages.push(JSON.parse(e.data)));
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  return { ws, messages, opened };
}

describe('yönetici cihazının bağlantısı', () => {
  test('gönderen cihaz bağlı sayılır; haberi kesilince izleyicilere bildirilir', async () => {
    const t = await create();
    const viewer = listen(t.id);
    await viewer.opened;
    await waitFor(() => viewer.messages.length === 1, 'ilk hâl');
    assert.equal(viewer.messages[0].holderOnline, false);

    assert.equal((await put(t, 0)).status, 200);
    await waitFor(() => viewer.messages.length === 2, 'gönderim yayınlansın');
    assert.equal(viewer.messages[1].holderOnline, true);
    assert.equal(await online(t.id), true);

    await waitFor(() => viewer.messages.length === 3, 'bağlantı koptu bildirimi', PRESENCE_MS * 5);
    assert.equal(viewer.messages[2].holderOnline, false);
    assert.equal(viewer.messages[2].rev, 1);
    assert.equal(await online(t.id), false);
    viewer.ws.close();
  });

  test('haber bağlantıyı tazeler; yanlış anahtarlı ya da başka cihazdan gelen haber sayılmaz', async () => {
    const t = await create();
    await put(t, 0);
    const viewer = listen(t.id);
    await viewer.opened;
    await waitFor(() => viewer.messages.at(-1)?.holderOnline === false, 'bağlı görünmesin', PRESENCE_MS * 5);
    const count = viewer.messages.length;

    viewer.ws.send(JSON.stringify({ type: 'beat', device: DEVICE, token: 'yanlis-anahtar' }));
    viewer.ws.send(JSON.stringify({ type: 'beat', device: 'cihaz-bbbbbbbb', token: t.adminToken }));
    viewer.ws.send('bozuk');
    await sleep(200);
    assert.equal(viewer.messages.length, count);
    assert.equal(await online(t.id), false);

    viewer.ws.send(JSON.stringify({ type: 'beat', device: DEVICE, token: t.adminToken }));
    await waitFor(() => viewer.messages.length === count + 1, 'yeniden bağlı görünsün');
    assert.equal(viewer.messages.at(-1).holderOnline, true);
    viewer.ws.close();
  });

  test('yayındaki yönetici cihazı haber verdikçe bağlı görünür, yayından çıkınca görünmez', async () => {
    const sync = LiveSync.admin({ getState: () => sampleState(), onAdopt() {}, storage: memoryStorage(), origin: base, debounceMs: 10, beatMs: 150 });
    await sync.start();
    const { id } = sync.config;
    await waitFor(() => sync.status().connected && sync.status().pending === 0, 'gönderim bitsin');
    await sleep(PRESENCE_MS * 2);
    assert.equal(await online(id), true, 'haberler bağlantıyı canlı tutar');

    sync.stop();
    await waitFor(async () => (await online(id)) === false, 'çıkınca bağlı görünmesin', PRESENCE_MS * 5);
  });
});
