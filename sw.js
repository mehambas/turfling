'use strict';

const CACHE = 'halisaha';
const NETWORK_TIMEOUT_MS = 3000;

// "/index.html" ve "/izle.html" Workers'ta "/" ve "/izle" adreslerine yönlendirilir; yönlendirilmiş
// bir cevap sayfa açılışında kullanılamadığı için yalnız yönlendirilen adresler saklanır.
const ASSETS = [
  '/',
  '/izle',
  '/css/style.css',
  '/css/izle.css',
  '/js/tournament.js',
  '/js/sync.js',
  '/js/crests.js',
  '/js/views.js',
  '/js/app.js',
  '/js/izle.js',
  '/manifest.webmanifest',
  '/icons/app-small.svg',
  '/icons/app-180.png',
  '/icons/izle-180.png',
  '/fonts/fonts.css',
  '/fonts/barlow-condensed-latin-500-normal.woff2',
  '/fonts/barlow-condensed-latin-600-normal.woff2',
  '/fonts/barlow-condensed-latin-700-normal.woff2',
  '/fonts/barlow-condensed-latin-ext-500-normal.woff2',
  '/fonts/barlow-condensed-latin-ext-600-normal.woff2',
  '/fonts/barlow-condensed-latin-ext-700-normal.woff2',
  '/fonts/barlow-latin-400-normal.woff2',
  '/fonts/barlow-latin-500-normal.woff2',
  '/fonts/barlow-latin-600-normal.woff2',
  '/fonts/barlow-latin-700-normal.woff2',
  '/fonts/barlow-latin-ext-400-normal.woff2',
  '/fonts/barlow-latin-ext-500-normal.woff2',
  '/fonts/barlow-latin-ext-600-normal.woff2',
  '/fonts/barlow-latin-ext-700-normal.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Önce ağ: çevrimiçiyken hep en yeni dosyalar gelir, yayından sonra sürüm numarası değiştirmek gerekmez.
// Sahada bağlantı yoksa ya da çok yavaşsa birkaç saniye sonra saklanan sürüm açılır.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  const network = fetch(request);
  const saved = network
    .then((res) => {
      if (!res.ok || res.type !== 'basic' || res.redirected) return;
      const copy = res.clone();
      return caches.open(CACHE).then((cache) => cache.put(request, copy));
    })
    .catch(() => {});
  event.waitUntil(saved);
  event.respondWith(fromNetworkOrCache(request, network));
});

async function fromNetworkOrCache(request, network) {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS));
  try {
    return await Promise.race([network, timeout]);
  } catch {
    return (await caches.match(request, { ignoreSearch: true })) || network;
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {}
  event.waitUntil(show(data));
});

async function show(data) {
  const url = data.url || '/izle';
  if (data.skipIfOpen && (await pageVisible(url)) && !(await applePush())) return;
  return self.registration.showNotification(data.title || 'Gol!', {
    body: data.body || '',
    icon: data.icon || '/icons/izle-192.png',
    tag: data.tag || '',
    renotify: !!data.tag,
    vibrate: [200, 100, 200],
    data: { url },
  });
}

// Süre uyarısını yönetim ekranı açıkken sayfa kendisi verir (ses, titreşim); bildirim üstüne binmesin.
async function pageVisible(url) {
  const { pathname } = new URL(url, self.location.origin);
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return list.some((c) => c.visibilityState === 'visible' && new URL(c.url).pathname === pathname);
}

// Apple her push'ta bildirim ister; göstermeyen sitenin aboneliğini birkaç seferde iptal eder.
async function applePush() {
  const sub = await self.registration.pushManager.getSubscription();
  return /(^|\.)push\.apple\.com$/.test(sub ? new URL(sub.endpoint).hostname : '');
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/izle', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url === url);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
