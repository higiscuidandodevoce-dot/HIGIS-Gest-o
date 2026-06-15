/* ============================================================
   HIGIS — Service Worker
   Estratégia: cache-first para o shell do app (funciona offline
   após a primeira visita), network-first implícito para CDNs
   externas (React/Tailwind/fontes) — ficam em cache se baixadas
   com sucesso, mas tentamos rede primeiro para pegar updates.
   ============================================================ */

const CACHE_NAME = 'higis-v1.3.1';

// Arquivos do "shell" — essenciais para o app abrir offline
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isShell = url.origin === self.location.origin;

  if (isShell) {
    // Shell local: cache-first, atualiza em background
    event.respondWith(
      caches.match(event.request).then(cached => {
        const network = fetch(event.request).then(resp => {
          if (resp && resp.ok) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
          }
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    );
  } else {
    // CDNs externas (React, Tailwind, fontes, ícones): network-first com fallback pro cache
    event.respondWith(
      fetch(event.request).then(resp => {
        if (resp && resp.ok) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
        }
        return resp;
      }).catch(() => caches.match(event.request))
    );
  }
});
