const CACHE_NAME = 'markdown-viewer-cache-v3.8.0';

// PERF-011: Split precache into critical (local files) and lazy (CDN libraries)
// Critical assets are precached during SW install for instant offline startup
const CRITICAL_ASSETS = [
  './',
  './index.html',
  './script.js',
  './preview-worker.js',
  './styles.css',
  './sample.md',
  './assets/icon.jpg',
  './manifest.json'
];

// CDN assets are cached lazily on first use via runtime cache-first strategy
// This prevents the SW install from downloading ~5.4 MB of CDN resources upfront
const CDN_ORIGINS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net'
];

const NETWORK_FIRST_LOCAL_PATHS = new Set([
  '/',
  '/index.html',
  '/script.js',
  '/preview-worker.js',
  '/styles.css',
  '/sw.js'
]);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CRITICAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;
  const isCDN = CDN_ORIGINS.some(origin => url.hostname.includes(origin));

  if (isLocal) {
    const localPath = url.pathname.endsWith('/') ? '/' : url.pathname;
    const shouldUseNetworkFirst =
      event.request.mode === 'navigate' || NETWORK_FIRST_LOCAL_PATHS.has(localPath);

    if (shouldUseNetworkFirst) {
      event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
          return fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cache.match(event.request));
        })
      );
      return;
    }

    // Stale-While-Revalidate strategy for non-code local assets
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(err => {
            console.warn('Background fetch failed for:', event.request.url, err);
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
  } else if (isCDN) {
    // Cache-First strategy for stable third-party CDN libraries
    // PERF-011: CDN resources are cached on first use (lazy) rather than precached
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then(response => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return response;
          });
        })
    );
  } else {
    // Network-only for non-CDN external requests
    event.respondWith(fetch(event.request));
  }
});
