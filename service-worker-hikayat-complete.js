const CACHE_NAME = 'hikayat-shell-v1';
const AUDIO_CACHE = 'hikayat-audio-v1';
const CORE_FILES = ['./', './hikayat-final-complete-2.html', './manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !url.hostname.includes('raw.githubusercontent.com')) return;
  if (url.hostname.includes('raw.githubusercontent.com') && /\.(mp3|wav|ogg)$/i.test(url.pathname)) {
    event.respondWith(caches.open(AUDIO_CACHE).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        return cached || new Response('', {status: 504, statusText: 'Offline audio unavailable'});
      }
    }));
    return;
  }
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match('./hikayat-final-complete-2.html'))));
  }
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'CACHE_APP') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      const clients = await self.clients.matchAll({type: 'window'});
      const urls = [...CORE_FILES, ...clients.map(client => new URL(client.url).href)];
      await Promise.all(urls.map(url => cache.add(url).catch(() => {})));
    })());
  }
  if (data.type === 'CACHE_STORY') {
    event.waitUntil(caches.open(AUDIO_CACHE).then(cache => Promise.all((data.urls || []).map(url => cache.add(url).catch(() => {})))));
  }
  if (data.type === 'DELETE_STORY') {
    event.waitUntil(caches.open(AUDIO_CACHE).then(async cache => {
      for (const url of data.urls || []) await cache.delete(url);
    }));
  }
});

self.addEventListener('error', () => {});
