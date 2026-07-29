// Service Worker — Rungundum PWA Push Notifications
// Versão: 1.0

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()))

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
