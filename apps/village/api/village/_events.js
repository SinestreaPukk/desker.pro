// Village analytics (SPEC §13). Stored in village_event, never with message text: each event keeps only the props listed here, as numbers or short enums.
// The gate report (scripts/village-report.ts) reads these. Pure, so it is tested (test/village-events.test.mjs).
const num = (max) => (v) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : undefined)
const oneOf = (...xs) => (v) => (xs.includes(v) ? v : undefined)
const bool = (v) => (typeof v === 'boolean' ? v : undefined)
const SPEC = {
  village_opened: { device: oneOf('phone', 'desktop') },
  village_joined: { via: oneOf('link', 'seed') },
  desk_claimed: {},
  bubble_sent: { zoneId: oneOf('plaza', 'library', 'tables', 'lounge', 'garden'), length: num(120) },
  focus_started: { plannedMin: num(600) },
  focus_completed: { plannedMin: num(600), actualMin: num(600), valid: bool },
  board_opened: {},
  board_item_added: { kind: oneOf('due', 'exam', 'announcement') }, board_item_to_planner: { kind: oneOf('due', 'exam') },
  question_asked: {}, question_answered: {}, question_resolved: {},
  invite_created: {},
  invite_accepted: {},
  mod_kick: {}, mod_ban: {}, mod_unban: {}, mod_transfer: {},
  session_minutes: { minutes: num(1440), focusMinutes: num(1440) },
}
/** Events a browser may report itself; the rest are recorded by the server when the thing happens. */
export const CLIENT_EVENTS = ['village_opened', 'bubble_sent', 'board_opened', 'session_minutes']

/** -> the props to store, or null if the event name is unknown. Unknown props are dropped, bad values are left out. */
export function cleanEvent(name, props) {
  const spec = SPEC[name]
  if (!spec) return null
  const out = {}
  for (const [k, ok] of Object.entries(spec)) { const v = ok(props?.[k]); if (v !== undefined) out[k] = v }
  return out
}
