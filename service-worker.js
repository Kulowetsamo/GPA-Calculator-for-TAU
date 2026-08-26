// GPA Calculator service worker — cache-first for offline use.
// Bump CACHE_VERSION when releasing to invalidate old caches.
const CACHE_VERSION = 'gpa-calc-v1.3.2';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './gr_style.css',
  './data.js',
  './storage.js',
  './calc.js',
  './ui.js',
  './export.js',
  './exams.js',
  './app.js',
  './gr_calc.js',
  './gr_storage.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Navigations: network first — never serve stale HTML that references
  // newer/older scripts than the cached ones (prevents dead onclick handlers).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Everything else: cache first, refresh in the background
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response && (response.status === 200 || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
