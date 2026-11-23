/* ============================================================
   EZRoutine — Service Worker (offline-first PWA)
   - cache shell & assets (no CDN)
   - navigation network-first with cached fallback
   - assets cache-first
   - safe update via SKIP_WAITING message from app
   NOTE: This worker does NOT play background alarm audio.
   ============================================================ */

const VERSION = 'ezroutine-v1.0.0';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/themes.css',
  './css/style.css',
  './css/components.css',
  './css/responsive.css',
  './js/app.js',
  './js/router.js',
  './js/home.js',
  './js/schedule.js',
  './js/workout.js',
  './js/alarm.js',
  './js/statistics.js',
  './js/settings.js',
  './js/storage.js',
  './js/database.js',
  './js/utils.js',
  './js/ui.js',
  './js/audio.js',
  './js/notifications.js',
  './js/constants.js',
  './js/events.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_ASSETS).catch(err => console.warn('Precache sebagian gagal', err));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE && k.startsWith('ezroutine-'))
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const isNavigation = request => request.mode === 'navigate';

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigation(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL_CACHE);
        if (fresh && fresh.ok) cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch {
      const shell = await caches.open(SHELL_CACHE);
      return (await shell.match(req)) || Response.error();
    }
  })());
});
