const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const ASSETS = vm.runInNewContext(`${read('sw.js')}\nASSETS`, {
  self: { addEventListener() {}, location: { origin: 'http://localhost' } },
  URL,
});

const PAGES = { '/': 'index.html', '/izle': 'izle.html' };

test('önbellek listesindeki her dosya projede var', () => {
  for (const asset of ASSETS) {
    assert.ok(fs.existsSync(path.join(root, PAGES[asset] || asset)), asset);
  }
  for (const page of Object.keys(PAGES)) assert.ok(ASSETS.includes(page), page);
});

for (const file of Object.values(PAGES)) {
  test(`${file} sayfasının yüklediği her dosya önbellek listesinde`, () => {
    const refs = [...read(file).matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => `/${m[1]}`);
    assert.ok(refs.length >= 5, refs.join(', '));
    for (const ref of refs) assert.ok(ASSETS.includes(ref), `${ref} sw.js listesinde yok`);
  });
}

test('yazı tipi dosyalarının hepsi önbellek listesinde', () => {
  const fonts = [...read('fonts/fonts.css').matchAll(/url\("([^"]+)"\)/g)].map((m) => `/fonts/${m[1]}`);
  assert.ok(fonts.length > 0);
  for (const font of fonts) assert.ok(ASSETS.includes(font), `${font} sw.js listesinde yok`);
});

function serviceWorker({ endpoint = 'https://fcm.googleapis.com/fcm/send/x' } = {}) {
  const listeners = {};
  const calls = [];
  const clients = [];
  const self = {
    location: { origin: 'https://hali-saha.example' },
    addEventListener: (type, fn) => (listeners[type] = fn),
    registration: {
      showNotification: (...args) => calls.push(['show', ...args]),
      pushManager: { getSubscription: async () => ({ endpoint }) },
    },
    clients: {
      matchAll: async () => clients,
      openWindow: async (url) => calls.push(['open', url]),
    },
  };
  vm.runInNewContext(read('sw.js'), { self, URL, caches: {}, fetch() {}, setTimeout });
  const fire = async (type, event) => {
    let done;
    listeners[type]({ ...event, waitUntil: (p) => (done = p) });
    await done;
  };
  return { fire, calls, clients };
}

test('push: gelen gol bildirim olarak gösterilir, bozuk veride varsayılan metin', async () => {
  const sw = serviceWorker();
  await sw.fire('push', { data: { json: () => ({ title: 'Gol! Maviler', body: 'Ali · Kırmızılar 1–1 Maviler', url: '/izle#abcdefghij' }) } });
  await sw.fire('push', { data: { json: () => JSON.parse('{') } });
  const [[, title, opts], [, fallback]] = sw.calls;
  assert.equal(title, 'Gol! Maviler');
  assert.equal(opts.body, 'Ali · Kırmızılar 1–1 Maviler');
  assert.equal(opts.data.url, '/izle#abcdefghij');
  assert.equal(fallback, 'Gol!');
});

const timerPush = { title: 'Son 1 dakika', body: 'Kırmızılar 1–0 Maviler', tag: 'sure-L1', url: '/', icon: '/icons/app-192.png', skipIfOpen: true };
const page = (url, visibilityState) => ({ url: `https://hali-saha.example${url}`, visibilityState });

test('süre uyarısı: yönetim ekranı görünmüyorsa bildirim, aynı maçın önceki uyarısının yerine', async () => {
  const sw = serviceWorker();
  sw.clients.push(page('/', 'hidden'), page('/izle#abcdefghij', 'visible'));
  await sw.fire('push', { data: { json: () => timerPush } });
  const [[, title, opts]] = sw.calls;
  assert.equal(title, 'Son 1 dakika');
  assert.equal(opts.tag, 'sure-L1');
  assert.equal(opts.renotify, true);
  assert.equal(opts.icon, '/icons/app-192.png');
  assert.equal(opts.data.url, '/');
});

test('süre uyarısı: yönetim ekranı açıksa sayfa haber verir; Apple ise her push için bildirim ister', async () => {
  const sw = serviceWorker();
  sw.clients.push(page('/', 'visible'));
  await sw.fire('push', { data: { json: () => timerPush } });
  assert.deepEqual(sw.calls, []);

  const apple = serviceWorker({ endpoint: 'https://web.push.apple.com/abc' });
  apple.clients.push(page('/', 'visible'));
  await apple.fire('push', { data: { json: () => timerPush } });
  assert.equal(apple.calls.length, 1);
});

test('bildirime dokununca o yayının sayfası öne gelir, açık değilse açılır', async () => {
  const sw = serviceWorker();
  const notification = (url) => ({ data: { url }, close() {} });
  let focused = 0;
  sw.clients.push({ url: 'https://hali-saha.example/izle#abcdefghij', focus: async () => focused++ });
  await sw.fire('notificationclick', { notification: notification('/izle#abcdefghij') });
  await sw.fire('notificationclick', { notification: notification('/izle#kkkkkkkkkk') });
  assert.equal(focused, 1);
  assert.deepEqual(sw.calls, [['open', 'https://hali-saha.example/izle#kkkkkkkkkk']]);
});
