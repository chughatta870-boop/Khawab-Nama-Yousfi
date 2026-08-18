// خواب نامہ یوسفی — Service Worker
// Bump CACHE_NAME on every deploy to force refresh of cached assets.
const CACHE_NAME = 'khwab-nama-yusufi-v1';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './icon-180.png',
  './dream01.json',
  './dream02.json',
  './dream03.json',
  './dream04.json',
  './dream05.json',
  './dream06.json',
  './dream07.json',
  './dream08.json',
  './dream09.json',
  './dream10.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        APP_SHELL.map(url =>
          cache.add(url).catch(err => console.warn('SW: failed to cache', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;

  // network-first for fonts CDN, cache-first for same-origin app assets
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if(sameOrigin){
    event.respondWith(
      caches.match(req).then(cached => {
        const fetchPromise = fetch(req).then(networkRes => {
          if(networkRes && networkRes.ok){
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return networkRes;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  } else {
    // Google Fonts etc: try cache, fall back to network, cache result
    event.respondWith(
      caches.match(req).then(cached => {
        if(cached) return cached;
        return fetch(req).then(networkRes => {
          if(networkRes && networkRes.ok){
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return networkRes;
        }).catch(() => cached);
      })
    );
  }
});
