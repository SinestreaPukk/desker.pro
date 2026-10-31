// Receives the kodama's web push notifications (api/_push.js) and opens Desker when one is tapped. Nothing else: no caching, no offline mode.
self.addEventListener('push', (e) => {
  let m = {}
  try { m = e.data.json() } catch { return }
  e.waitUntil(self.registration.showNotification(m.title || 'Desker', { body: m.body, tag: m.tag, icon: '/pixel/av-main.png', data: { url: m.url || '/today' } }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((all) => {
    const open = all.find((c) => 'focus' in c)
    return open ? open.focus() : self.clients.openWindow(e.notification.data?.url || '/today')
  }))
})
