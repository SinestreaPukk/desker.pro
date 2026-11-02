// The village's service worker: web push only (no caching, no offline mode), like Desker's own /sw.js. Tapping a notification opens the right place.
self.addEventListener('push', (e) => {
  let m = {}
  try { m = e.data.json() } catch { return }
  e.waitUntil(self.registration.showNotification(m.title || 'Kodama Village', { body: m.body, tag: m.tag, data: { url: m.url || '/' } }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(async (all) => {
    const open = all.find((c) => 'focus' in c)
    if (open) { await open.focus(); return 'navigate' in open ? open.navigate(url) : undefined }
    return self.clients.openWindow(url)
  }))
})
