// Browser side of village notifications. Permission is only asked from a click, at a good moment (after a first focus or first question), never on load.
import { pushOff, pushSave, pushState, type PushState } from './api.ts'
import type { PushPrefs } from '@desker/shared'

export const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const bytes = (b64: string) => { const p = '='.repeat((4 - (b64.length % 4)) % 4), s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)) }
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** Asks permission, subscribes this browser and saves it with the person's choices. Throws a sentence the screen can show. */
export async function enable(st: PushState, prefs: PushPrefs = st.prefs) {
  if (!supported() || !st.configured || !st.publicKey) throw new Error('Notifications are not available here.')
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings, then try again.')
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(st.publicKey) }))
  await pushSave({ sub: sub.toJSON(), prefs, tz: tz() })
}
export async function disable() {
  try { await (await navigator.serviceWorker.getRegistration('/sw.js'))?.pushManager.getSubscription().then((s) => s?.unsubscribe()) } catch { /* nothing to undo */ }
  await pushOff()
}
export const save = (prefs: PushPrefs) => pushSave({ prefs, tz: tz() })
export { pushState }
