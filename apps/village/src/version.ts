// "A new version is ready": compares this page's build with /version.json every 5 minutes (and when the tab comes back). Also reports uncaught errors, tagged with the build.
import { track } from './api.ts'

declare const __BUILD__: string
export const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'

export function watchVersion(onNew: () => void) {
  if (BUILD === 'dev') return () => {}
  const check = () => fetch('/version.json', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j?.build && j.build !== BUILD) onNew() }, () => {})
  const t = setInterval(check, 5 * 60_000), vis = () => { if (!document.hidden) check() }
  document.addEventListener('visibilitychange', vis)
  return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
}

/** Uncaught errors go to the village's own event log (kind and build only, never the message), at most 3 per page load. */
export function reportErrors(slug: string) {
  let n = 0
  const send = (where: 'script' | 'promise') => { if (n++ < 3) track(slug, 'client_error', { where, build: BUILD }) }
  const a = () => send('script'), b = () => send('promise')
  window.addEventListener('error', a); window.addEventListener('unhandledrejection', b)
  return () => { window.removeEventListener('error', a); window.removeEventListener('unhandledrejection', b) }
}
