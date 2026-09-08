const CACHE = 'check-calculator-v7-verified-rate-engine';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './rate-engine-v2.js', './history.js', './history.css', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.pathname.endsWith('/app.js')) {
    event.respondWith((async () => {
      try {
        const [appResponse, engineResponse] = await Promise.all([
          fetch(event.request, { cache: 'no-store' }),
          fetch(new URL('./rate-engine-v2.js?v=1', event.request.url), { cache: 'no-store' })
        ]);
        const [appText, engineText] = await Promise.all([appResponse.text(), engineResponse.text()]);
        return new Response(`${appText}\n\n/* verified-rate-engine */\n${engineText}`, {
          headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      } catch (_) {
        const cache = await caches.open(CACHE);
        const app = await cache.match('./app.js');
        const engine = await cache.match('./rate-engine-v2.js');
        if (app && engine) {
          return new Response(`${await app.text()}\n\n${await engine.text()}`, {
            headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
          });
        }
        return caches.match(event.request);
      }
    })());
    return;
  }

  event.respondWith(fetch(event.request).then(response => {
    const clone = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, clone));
    return response;
  }).catch(() => caches.match(event.request)));
});