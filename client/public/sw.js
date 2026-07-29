// Service Worker — Rungundum PWA
// Versão: 2.0 — Push Notifications + Offline Cache

const CACHE_VERSION = 'rg-v3'
const SHELL_CACHE   = `${CACHE_VERSION}-shell`
const ASSETS_CACHE  = `${CACHE_VERSION}-assets`
const API_CACHE     = `${CACHE_VERSION}-api`

// Assets estáticos conhecidos — precache no install
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/logo-branco.png',
  '/logo-preto.png',
  '/logoescuro.svg',
  '/logoclaro.svg',
]

// ── Install: precache shell ────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: limpar caches antigas ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      ))
      .then(() => clients.claim())
  )
})

// ── Fetch: estratégias de cache ────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar pedidos que não sejam GET (POST, PATCH, DELETE, etc.)
  if (request.method !== 'GET') return

  // Ignorar origens externas desconhecidas (ex: Cloudinary)
  const isOwnOrigin   = url.origin === self.location.origin
  const isGoogleFonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!isOwnOrigin && !isGoogleFonts) return

  // 1. API — Network First com fallback para cache
  //    Só cacheamos GETs não-auth para não guardar tokens ou dados sensíveis
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  // 2. Navegação (SPA) — servir index.html da cache → React Router trata o resto
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then((cached) => cached || fetch(request))
    )
    return
  }

  // 3. Fontes Google — Cache First (raramente mudam, poupam largura de banda)
  if (isGoogleFonts) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE))
    return
  }

  // 4. Assets Vite (/assets/...) e ficheiros estáticos — Cache First
  //    Os bundles têm hash no nome → versão nova = nome novo → cache fresh automaticamente
  event.respondWith(cacheFirst(request, ASSETS_CACHE))
})

// ── Cache First: serve da cache; se falhar, vai à rede e guarda ───────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Recurso indisponível offline.', { status: 503 })
  }
}

// ── Network First: tenta rede; se falhar, serve da cache ──────────────────────
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(
      JSON.stringify({ error: 'Sem ligação. A mostrar dados guardados.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// ── Push Notifications ─────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { return }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Rungundum', {
      body: data.body || '',
      icon: '/logo-branco.png',
      badge: '/logo-branco.png',
      data: { url: data.link || '/' },
      vibrate: [100, 50, 100],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})
