self.options = {
    "domain": "5gvci.com",
    "zoneId": 12268906
};
self.lary = "";
importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw');

// Service Worker for caching static assets
// Version number - increment this on each deployment to clear old caches
const CACHE_VERSION = 'v2';
const CACHE_NAME = `moviestream-${CACHE_VERSION}`;

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...', CACHE_VERSION);
  // Skip waiting to activate the new service worker immediately
  self.skipWaiting();
});

// Activate event - delete ALL old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Delete ALL old caches (not just specific ones)
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Claim all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - network first, cache fallback for static assets only
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // For HTML files, always fetch from network (no cache)
  if (request.mode === 'navigate' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request).catch(() => {
        // Fallback to index.html if network fails
        return caches.match('/index.html');
      })
    );
    return;
  }

  // For static assets (JS, CSS with hash), use network first, then cache
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request);
        })
    );
    return;
  }

  // For everything else, use network first
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});
