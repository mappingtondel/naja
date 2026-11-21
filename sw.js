const CACHE_NAME = 'gamemap-v6';   // App-Oberfläche
const TILE_CACHE = 'gamemap-tiles-v1'; // Kartenkacheln & Schriften (begrenzt)
const MAX_TILE_ENTRIES = 5000;

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/styles.js',
  './js/routing.js',
  './js/ui.js',
  './js/sheet.js',
  './js/map.js',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'
];

// Live-Dienste nie cachen
const LIVE_HOSTS = ['valhalla', 'photon', 'overpass'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // einzelne fehlende Dateien (z. B. Icons) sollen die Installation nicht komplett verhindern
      .then(cache => Promise.all(ASSETS.map(u => cache.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME && k !== TILE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
  }
}

let puts = 0;
async function cacheFirst(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      await cache.put(req, res.clone());
      if (max && ++puts % 50 === 0) trim(cacheName, max);
    }
    return res;
  } catch {
    return Response.error();
  }
}

// Frische Daten bevorzugen, bei Offline/Timeout auf den Cache zurückfallen
async function networkFirst(req, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
    ]);
    if (res && res.ok) await cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;
  if (LIVE_HOSTS.some(h => url.hostname.includes(h))) return;

  // OpenFreeMap: TileJSON verweist auf versionierte Kachel-URLs und muss frisch sein,
  // Kacheln und Schriften dürfen aus dem Cache kommen
  if (url.hostname === 'tiles.openfreemap.org') {
    const isTileJson = url.pathname === '/planet' || url.pathname.endsWith('.json');
    event.respondWith(isTileJson ? networkFirst(req, TILE_CACHE, 5000) : cacheFirst(req, TILE_CACHE, MAX_TILE_ENTRIES));
    return;
  }

  // MapLibre von unpkg ist auf eine Version festgelegt
  if (url.hostname === 'unpkg.com') {
    event.respondWith(cacheFirst(req, CACHE_NAME));
    return;
  }

  // Eigene Dateien: immer die neueste Version, offline aus dem Cache
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, CACHE_NAME, 4000));
  }
});
