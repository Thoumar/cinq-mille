/**
 * Service worker minimal — juste ce qu'il faut pour que l'app s'ouvre sans réseau.
 *
 * Stratégie : « réseau d'abord » pour les navigations (afin de récupérer une nouvelle
 * version dès qu'elle existe), « cache d'abord » pour les ressources versionnées de
 * Next, qui portent un hachage dans leur nom et ne changent donc jamais de contenu.
 *
 * Aucune donnée de partie ne passe ici : elle vit dans localStorage.
 */

const CACHE = 'cinq-mille-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(async () => (await caches.match('/')) ?? Response.error()),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
