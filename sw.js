'use strict';

const CACHE = 'halisaha';
const NETWORK_TIMEOUT_MS = 3000;

// "/index.html" Workers'ta "/" adresine yönlendirilir; yönlendirilmiş bir cevap sayfa açılışında
// kullanılamadığı için yalnız "/" saklanır.
const ASSETS = [
  '/',
  '/css/style.css',
  '/js/tournament.js',
  '/js/sync.js',
  '/js/app.js',
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
