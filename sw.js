const CACHE_NAME = 'smartpark-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@^19.2.3',
  'https://esm.sh/react-dom@^19.2.3',
  'https://esm.sh/lucide-react@^0.560.0',
  'https://esm.sh/react-router-dom@^7.10.1',
  'https://esm.sh/dexie-react-hooks@^4.2.0',
  'https://esm.sh/dexie@^4.2.1'
];

// Install Event: Cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Network first, fall back to cache (Stale-while-revalidate strategy could be better for code, but Network First ensures data freshness for APIs, though we are mostly local)
// Since we use ESM.sh, we want to try cache first for those libraries to speed up load
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy: Cache First for external libraries (esm.sh, tailwind)
  if (url.hostname === 'esm.sh' || url.hostname === 'cdn.tailwindcss.com') {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  } else {
    // Strategy: Network First for everything else
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});