// Tiny event hook for "Measure the habit". No vendor and no personal content: props are ids, counts and step names only.
// Off by default. VITE_TRACK=console logs events to the console.
// aid is an anonymous id made just for analytics. It is NOT the sync code, which is a key to the workspace.
// TODO(roadmap: Measure the habit): send events to the chosen provider inside track().
const store = {
  get: (k) => { try { return localStorage[k] } catch { return undefined } },
  set: (k, v) => { try { localStorage[k] = v } catch { /* storage blocked: ids reset each visit */ } },
}
const today = () => new Date().toLocaleDateString('sv')
const aid = store.get('aid') || (store.set('aid', crypto.randomUUID()), store.get('aid'))
const firstSeen = store.get('firstSeen') || (store.set('firstSeen', today()), today())

export function track(event, props = {}) {
  if (import.meta.env.VITE_TRACK === 'console') console.info('[track]', event, { aid, ...props })
}

// Next-day and 7-day return can be computed from daysSinceFirst.
export const trackOpen = () => track('app_open', { firstSeen, daysSinceFirst: Math.round((Date.parse(today()) - Date.parse(firstSeen)) / 864e5) })

// Fires onboarding_step_completed once per step. A workspace that already existed is seeded silently so old data does not look like new onboarding.
export function trackSteps(keys, hadData) {
  let seen = null
  try { seen = JSON.parse(store.get('stepsReported')) } catch { /* first run */ }
  if (!seen) seen = hadData ? keys : []
  const fresh = keys.filter((k) => !seen.includes(k))
  fresh.forEach((step) => track('onboarding_step_completed', { step }))
  if (fresh.length || !store.get('stepsReported')) store.set('stepsReported', JSON.stringify([...seen, ...fresh]))
}
