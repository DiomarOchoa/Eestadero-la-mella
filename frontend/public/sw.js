/* Service Worker mínimo: hace instalable la PWA y acelera la app.
 * - Precache: shell estático (/, index, manifiesto, iconos).
 * - Runtime: cache-first para assets propios, red para /api (datos siempre frescos).
 */
const VERSION = 'lamella-pwa-v1';
const ESTATICOS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(ESTATICOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // La API siempre va a la red: nada de ventas o stock desactualizados.
  if (url.pathname.startsWith('/api/')) return;

  // Solo mismo origen.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cacheada) => {
      if (cacheada) return cacheada;
      return fetch(request).then((respuesta) => {
        if (respuesta && respuesta.status === 200) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copia));
        }
        return respuesta;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
