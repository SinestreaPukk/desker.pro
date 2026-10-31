// Browser side of the kodama's notifications. Only offered when VITE_VAPID_PUBLIC_KEY is set (see .env.example), so without keys nothing here shows.
export const vapidKey = () => import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
export const pushSupported = () => !!vapidKey() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const bytes = (b64) => { const p = '='.repeat((4 - (b64.length % 4)) % 4), s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)) }

// Asks permission (only when called, from a click), subscribes this browser, returns the subscription to store in data.push.
export async function subscribe() {
  if (!pushSupported()) throw new Error('This browser cannot receive notifications.')
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings, then try again.')
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(vapidKey()) }))
  return { sub: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone }
}
export async function unsubscribe() {
  try { await (await navigator.serviceWorker.getRegistration('/sw.js'))?.pushManager.getSubscription().then((s) => s?.unsubscribe()) } catch { /* nothing to undo */ }
}
