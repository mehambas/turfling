import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { memoryStorage, sampleState, startWorker, waitFor } from './helpers.js';

const LiveSync = createRequire(import.meta.url)('../../js/sync.js');

let worker;
let base;
const devices = [];

before(async () => {
  worker = await startWorker();
  base = worker.base;
});

after(async () => {
  for (const d of devices) d.sync.stop();
  await worker?.dispose();
});

function device(initial = sampleState(), { storage = memoryStorage() } = {}) {
  const d = {
    state: initial,
    offline: false,
    loseResponses: false,
    notices: [],
    adopted: 0,
    statuses: [],
    requests: [],
  };
  const fetchImpl = async (...args) => {
    if (d.offline) throw new TypeError('fetch failed');
    d.requests.push({ path: new URL(args[0]).pathname, method: args[1]?.method, body: args[1]?.body ? JSON.parse(args[1].body) : null });
    const res = await fetch(...args);
    if (d.loseResponses) throw new TypeError('fetch failed');
    return res;
  };
  d.sync = LiveSync.admin({
    getState: () => d.state,
    onAdopt: (s) => {
      d.state = s;
      d.adopted++;
    },
    onNotice: (n) => d.notices.push(n),
    onChange: (s) => d.statuses.push(s),
    storage,
    fetchImpl,
    origin: base,
    debounceMs: 10,
    retryMs: 50,
  });
  d.change = (fn) => {
    fn(d.state);
    d.sync.changed();
  };
  devices.push(d);
  return d;
}

const server = async (id) => (await fetch(`${base}/api/t/${id}`)).json();

const synced = (d) => waitFor(() => d.sync.status().pending === 0 && d.sync.status().connected, 'gönderim bitsin');

describe('yardımcılar', () => {
  test('yönetici linki ayrıştırılır', () => {
    assert.deepEqual(LiveSync.parseAdminHash('#yonet/abcdefghjk.AbC_-1234567890abcdefXYZ'), { id: 'abcdefghjk', token: 'AbC_-1234567890abcdefXYZ' });
    assert.equal(LiveSync.parseAdminHash('#yonet/abcdefghjk'), null);
    assert.equal(LiveSync.parseAdminHash('#ekran'), null);
    assert.equal(LiveSync.parseAdminHash('#yonet/ABCDEFGHJK.AbC_-1234567890abcdefXYZ'), null);
    assert.equal(LiveSync.parseAdminHash(''), null);
  });

  test('zamanlar bu cihazın saatine çevrilir, göreli gol dakikalarına dokunulmaz', () => {
    const snapshot = {
      clockOffset: 5000,
      serverTime: 1_000_000,
      state: sampleState({
        matches: [
          { id: 'L1', startedAt: 100, runningSince: 300, endedAt: null, goals: [{ ms: 60_000 }] },
          { id: 'L2', startedAt: 10, runningSince: null, endedAt: 20, goals: [] },
        ],
      }),
    };
    const out = LiveSync.localize(snapshot, 1_002_000);
    assert.deepEqual(
      out.matches.map((m) => [m.startedAt, m.runningSince, m.endedAt]),
      [
        [7100, 7300, null],
        [7010, null, 7020],
      ],
    );
    assert.equal(out.matches[0].goals[0].ms, 60_000);
    assert.equal(snapshot.state.matches[0].startedAt, 100);
  });
});

describe('yönetici cihazı', () => {
  test('yayını başlatınca durum sunucuya gider, ardışık değişiklikler toplanır', async () => {
    const a = device();
    assert.equal(a.sync.status().mode, 'off');
    await a.sync.start();
    const { id } = a.sync.config;
    await synced(a);
    assert.equal(a.sync.status().mode, 'admin');
    assert.equal((await server(id)).state.name, 'Test');

    for (let i = 1; i <= 5; i++) a.change((s) => (s.name = `Ad ${i}`));
    await synced(a);
    const snap = await server(id);
    assert.equal(snap.state.name, 'Ad 5');
    assert.ok(snap.rev < 6, `5 değişiklik tek tek gönderilmemeli, rev ${snap.rev}`);
    assert.equal(snap.holder, a.sync.config.device);
  });

  test('internet yokken değişiklikler bekler, gelince gönderilir', async () => {
    const a = device();
    await a.sync.start();
    const { id } = a.sync.config;
    await synced(a);

    a.offline = true;
    a.change((s) => (s.name = 'Çevrimdışı 1'));
    a.change((s) => (s.name = 'Çevrimdışı 2'));
    await waitFor(() => a.sync.status().offline, 'çevrimdışı görünsün');
    assert.equal(a.sync.status().pending, 2);
    assert.equal((await server(id)).state.name, 'Test');

    a.offline = false;
    a.sync.wake();
    await synced(a);
    assert.equal((await server(id)).state.name, 'Çevrimdışı 2');
    assert.equal(a.sync.status().offline, false);
  });

  test('gönderim ulaştı ama cevabı kayboldu: aynı hâl yeniden gönderilir, sürüm şaşmaz', async () => {
    const a = device();
    await a.sync.start();
    const { id } = a.sync.config;
    await synced(a);

    a.loseResponses = true;
    a.change((s) => (s.name = 'Kayıp cevap'));
    await waitFor(async () => (await server(id)).rev === 2, 'sunucu almış olsun');
    a.loseResponses = false;
    a.change((s) => (s.name = 'Sonraki'));
    await synced(a);
    const snap = await server(id);
    assert.equal(snap.state.name, 'Sonraki');
    assert.equal(a.sync.config.rev, snap.rev);
    assert.deepEqual(a.notices, []);
  });
});

describe('aynı anda tek yönetici', () => {
  test('linkle bağlanan cihaz salt okunur başlar, yayındaki hâli gösterir', async () => {
    const a = device();
    await a.sync.start();
    const { id, token } = a.sync.config;
    a.change((s) => (s.name = 'Yayındaki'));
    await synced(a);

    const b = device(sampleState({ name: 'B cihazının eski verisi' }));
    assert.equal(b.sync.join(id, token), true);
    assert.equal(b.sync.join(id, token), false);
    await waitFor(() => b.state.name === 'Yayındaki', 'B yayındaki hâli alsın');
    assert.equal(b.sync.status().mode, 'follower');

    b.change((s) => (s.name = 'B yazamaz'));
    await new Promise((r) => setTimeout(r, 100));
    assert.equal((await server(id)).state.name, 'Yayındaki');
    assert.equal(b.sync.status().pending, 0);
  });

  test('devralınca eski yönetici hemen salt okunura geçer ve yeni girilenleri görür', async () => {
    const a = device();
    await a.sync.start();
    const { id, token } = a.sync.config;
    await synced(a);
    const b = device();
    b.sync.join(id, token);
    await waitFor(() => b.adopted > 0, 'B ilk hâli alsın');

    await b.sync.takeover();
    assert.equal(b.sync.status().mode, 'admin');
    await waitFor(() => a.sync.status().mode === 'follower', 'A salt okunura geçsin');
    assert.deepEqual(a.notices, [{ kind: 'lost', lost: 0 }]);

    b.change((s) => (s.name = 'B girdi'));
    await synced(b);
    await waitFor(() => a.state.name === 'B girdi', 'A, B nin girdiğini görsün');

    a.change((s) => (s.name = 'A artık yazamaz'));
    await new Promise((r) => setTimeout(r, 100));
    assert.equal((await server(id)).state.name, 'B girdi');

    await a.sync.takeover();
    await waitFor(() => b.sync.status().mode === 'follower', 'B salt okunura geçsin');
    a.change((s) => (s.name = 'A geri aldı'));
    await synced(a);
    await waitFor(() => b.state.name === 'A geri aldı', 'B, A nın girdiğini görsün');
  });

  test('internetsizken yönetimi kaybeden cihazın bekleyen değişiklikleri başkasınınkini ezmez', async () => {
    const a = device();
    await a.sync.start();
    const { id, token } = a.sync.config;
    await synced(a);
    const b = device();
    b.sync.join(id, token);
    await waitFor(() => b.adopted > 0, 'B ilk hâli alsın');

    a.offline = true;
    a.change((s) => (s.name = 'A internetsiz 1'));
    a.change((s) => (s.name = 'A internetsiz 2'));
    await waitFor(() => a.sync.status().offline, 'A çevrimdışı');

    await b.sync.takeover();
    b.change((s) => (s.name = 'B nin golü'));
    await synced(b);
    await waitFor(() => a.sync.status().mode === 'follower' || a.notices.length, 'A yönetimin gittiğini duysun');

    a.offline = false;
    a.sync.wake();
    await waitFor(() => a.state.name === 'B nin golü', 'A sunucudaki hâli alsın');
    assert.equal((await server(id)).state.name, 'B nin golü');
    assert.equal(a.sync.status().mode, 'follower');
    assert.equal(a.sync.status().pending, 0);
    assert.deepEqual(a.notices, [{ kind: 'lost', lost: 2 }]);
  });

  test('yayından çıkan cihaz artık göndermez', async () => {
    const a = device();
    await a.sync.start();
    const { id } = a.sync.config;
    await synced(a);
    a.sync.stop();
    assert.equal(a.sync.status().mode, 'off');
    assert.equal(a.sync.config, null);
    a.change((s) => (s.name = 'Gitmemeli'));
    await new Promise((r) => setTimeout(r, 100));
    assert.equal((await server(id)).state.name, 'Test');
  });
});

const withLibrary = () => sampleState({ version: 2, id: 'current', playerPool: [{ id: 'p1', name: 'Ali' }, { id: 'p2', name: 'Geçmiş oyuncu' }], archives: [sampleState({ id: 'old', name: 'Önceki turnuva' })] });

describe('kütüphane senkronizasyonu', () => {
  test('gol/saat güncellemeleri arşiv taşımaz; değişiklik yalnız ilgili kaydı taşır', async () => {
    const a = device(withLibrary());
    await a.sync.start(); await synced(a);
    const first = a.requests.find((r) => r.method === 'PUT').body;
    assert.equal('archives' in first.state, false);
    assert.equal('playerPool' in first.state, false);
    assert.equal(first.library.upsertArchives.length, 1);
    a.requests = [];
    a.change((s) => { s.name = 'Skor güncellemesi'; });
    await synced(a);
    assert.ok(a.requests.filter((r) => r.method === 'PUT').every((r) => !('library' in r.body)));
    a.requests = [];
    a.change((s) => s.archives.push(sampleState({ id: 'second', name: 'İkinci turnuva' })));
    await synced(a);
    const patch = a.requests.find((r) => r.method === 'PUT').body.library;
    assert.deepEqual(patch.upsertArchives.map((t) => t.id), ['second']);
    assert.equal('playerPool' in patch, false);
    a.requests = [];
    a.change((s) => { s.playerPool[1].name = 'Yeni ad'; }); await synced(a);
    const poolPatch = a.requests.find((r) => r.method === 'PUT').body.library;
    assert.equal(poolPatch.upsertArchives.length, 0);
    assert.equal(poolPatch.playerPool[1].name, 'Yeni ad');
  });

  test('diğer yönetici özel arşivi alır, sıradan yayın mesajları arşivi silmez', async () => {
    const a = device(withLibrary());
    await a.sync.start(); await synced(a);
    const { id, token } = a.sync.config;
    const b = device(); b.sync.join(id, token);
    await waitFor(() => b.state.archives?.length === 1, 'B özel arşivi alsın');
    assert.equal(b.state.playerPool.length, 2);
    assert.ok(b.requests.some((r) => r.path.endsWith('/admin')));
    const reads = b.requests.filter((r) => r.path.endsWith('/admin')).length;
    a.change((s) => { s.name = 'Yeni skor'; }); await synced(a);
    await waitFor(() => b.state.name === 'Yeni skor', 'B canlı değişikliği alsın');
    assert.equal(b.state.archives[0].name, 'Önceki turnuva');
    assert.equal(b.requests.filter((r) => r.path.endsWith('/admin')).length, reads);
    a.change((s) => { s.archives[0].name = 'Arşiv düzeltmesi'; }); await synced(a);
    await waitFor(() => b.state.archives[0].name === 'Arşiv düzeltmesi', 'B arşiv değişikliğini alsın');
    await b.sync.takeover();
    await waitFor(() => a.sync.status().mode === 'follower', 'A devri alsın');
    b.change((s) => { s.name = 'B skoru'; }); await synced(b);
    await waitFor(() => a.state.name === 'B skoru', 'A yeni skoru alsın');
    assert.equal(a.state.archives[0].name, 'Arşiv düzeltmesi');
    assert.ok(b.requests.filter((r) => r.method === 'PUT').every((r) => !r.body.library));
  });

  test('kayıp kütüphane cevabı ve çevrimdışı arşiv değişiklikleri tekrarlandığında kaybolmaz', async () => {
    const a = device(withLibrary()); await a.sync.start(); await synced(a);
    a.loseResponses = true;
    a.change((s) => s.archives.push(sampleState({ id: 'second' })));
    await waitFor(async () => (await server(a.sync.config.id)).rev === 2, 'sunucu arşivi alsın');
    a.loseResponses = false;
    a.change((s) => { s.archives[0].name = 'Son değişiklik'; });
    await synced(a);
    const b = device(); b.sync.join(a.sync.config.id, a.sync.config.token);
    await waitFor(() => b.state.archives?.length === 2, 'iki turnuva da korunsun');
    assert.equal(b.state.archives[0].name, 'Son değişiklik');
  });

  test('yanlış anahtar özel arşivi alamaz', async () => {
    const a = device(withLibrary()); await a.sync.start(); await synced(a);
    const b = device(); b.sync.join(a.sync.config.id, 'wrong-token');
    await waitFor(() => b.sync.status().mode === 'error', 'yetki hatası');
    assert.equal(b.sync.status().error, 'unauthorized');
    assert.equal(b.state.archives, undefined);
  });
});

test('büyük ilk arşiv aktarımı küçük isteklerle tamamlanır; sonra canlı skor küçüktür', async () => {
  const state = withLibrary();
  state.archives = Array.from({ length: 170 }, (_, i) => sampleState({ id: `old-${i}`, name: 'Turnuva'.repeat(1100) }));
  assert.ok(JSON.stringify(state.archives).length > 1024 * 1024);
  const a = device(state); await a.sync.start(); await synced(a);
  const puts = a.requests.filter((r) => r.method === 'PUT');
  assert.ok(puts.length > 1);
  for (const request of puts) assert.ok(Buffer.byteLength(JSON.stringify(request.body)) < 1024 * 1024);
  const res = await fetch(`${base}/api/t/${a.sync.config.id}/admin`, { headers: { authorization: `Bearer ${a.sync.config.token}` } });
  assert.equal((await res.json()).state.archives.length, 170);
  a.requests = [];
  a.change((s) => { s.name = 'Canlı güncelleme'; }); await synced(a);
  const next = a.requests.find((r) => r.method === 'PUT');
  assert.equal(next.body.library, undefined);
  assert.ok(Buffer.byteLength(JSON.stringify(next.body)) < 2000);
});

test('sayfa yeniden açıldığında bekleyen skor, arşiv tekrar gönderilmeden eşitlenir', async () => {
  const a = device(withLibrary()); await a.sync.start(); await synced(a);
  const cfg = { ...a.sync.config, pending: 1 };
  const state = structuredClone(a.state); state.name = 'Yeniden açılan cihaz';
  a.sync.stop();
  const storage = memoryStorage(); storage.setItem(LiveSync.CONFIG_KEY, JSON.stringify(cfg));
  const b = device(state, { storage }); await synced(b);
  assert.equal(b.state.archives.length, 1);
  assert.ok(b.requests.some((r) => r.path.endsWith('/admin')));
  const puts = b.requests.filter((r) => r.method === 'PUT');
  assert.ok(puts.length > 0);
  assert.ok(puts.every((r) => !r.body.library));
  assert.equal((await server(cfg.id)).state.name, 'Yeniden açılan cihaz');
});
