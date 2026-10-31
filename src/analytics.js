// First-party product analytics: a small allow-list of events, sent to our own database (api/_events.js). Nothing third-party.
// Off unless VITE_ANALYTICS=on in the build AND ANALYTICS=on on the server, so local development sends nothing.
// Privacy by construction: an event is a name from EVENTS plus properties that are numbers or one of a fixed set of words. There is no way to
// put a task title, a note or any other free text in an event: sanitize() drops anything that is not on the list, on the client and again on the server.
export const EVENTS = {
  signed_up: {}, onboarding_completed: { skipped: 'bool', first: ['task', 'deadline', 'none'] },
  syllabus_imported: { count: 'int' }, task_created: { source: ['manual', 'ai', 'import'], count: 'int' }, task_completed: { timed: 'bool' },
  right_now_started: { via: ['calendar', 'pick', 'auto'] }, plan_generated: { ai: 'bool', moved: 'int', problems: 'int' }, agent_message_sent: {},
  session_started: { device: ['phone', 'desktop'], theme: ['light', 'dark'] },
  focus_session_completed: { minutes: 'int', result: ['finished', 'abandoned'] }, duration_logged: { source: ['timer', 'chip'] },
  energy_logged: { prompted: 'bool' }, morning_plan_opened: {}, wrapup_completed: {}, kodama_named: {}, followup_answered: { result: ['well', 'okay', 'rough'] }, rhythm_page_viewed: {},
  notification_opened: { kind: ['morning', 'evening'] }, notification_sent: { kind: ['morning', 'evening'] },
}

// -> { name, props, at } or null. Numbers are clamped to 0..100000 and rounded; words must be on the list; unknown properties are dropped.
export function sanitize(e) {
  const spec = EVENTS[e?.name]
  if (!spec) return null
  const props = {}
  for (const [k, kind] of Object.entries(spec)) {
    const v = e.props?.[k]
    if (kind === 'bool' && typeof v === 'boolean') props[k] = v
    else if (kind === 'int' && Number.isFinite(v)) props[k] = Math.min(100000, Math.max(0, Math.round(v)))
    else if (Array.isArray(kind) && kind.includes(v)) props[k] = v
  }
  return { name: e.name, props, at: Number.isFinite(e.at) ? e.at : Date.now() }
}

const on = () => typeof window !== 'undefined' && import.meta.env?.VITE_ANALYTICS === 'on'
let queue = [], timer = null
function flush() {
  timer = null
  if (!queue.length) return
  const body = JSON.stringify({ events: queue }); queue = []
  try { fetch('/api/state?events=1', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body }).catch(() => {}) } catch { /* analytics never breaks the app */ }
}
export function track(name, props) {
  if (!on()) return
  const e = sanitize({ name, props, at: Date.now() })
  if (!e) return
  queue.push(e)
  if (queue.length >= 20) flush(); else timer ||= setTimeout(flush, 5000)
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) flush() })
