const CACHE = 'pulselog-v2';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg'];

const isAppShellRequest = (request) => {
  const url = new URL(request.url);
  return APP_SHELL.includes(url.pathname);
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const revalidate = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    void revalidate;
    return cached;
  }

  const fresh = await revalidate;
  return fresh || Response.error();
};

const networkFirst = async (request) => {
  const cache = await caches.open(CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      void cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isAppShellRequest(event.request)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
