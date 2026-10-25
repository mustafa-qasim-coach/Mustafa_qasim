const CACHE_NAME = 'alarabin-shell-v14';
const APP_ROOT = new URL('./', self.location.href).href;
const APP_FILES = [APP_ROOT, APP_ROOT + 'manifest.json', APP_ROOT + 'workout-tracker.css', APP_ROOT + 'workout-tracker.js', APP_ROOT + 'site-motion.css', APP_ROOT + 'site-motion.js', APP_ROOT + 'icons/icon-192.png', APP_ROOT + 'icons/icon-512.png', APP_ROOT + 'icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('alarabin-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const fresh = await fetch(request, {cache: 'no-cache'});
      if (fresh.ok) await cache.put(APP_ROOT, fresh.clone());
      return fresh;
    } catch (error) {
      return (await cache.match(APP_ROOT)) || Response.error();
    }
  })());
});
