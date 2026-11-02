// Web push rules (Phase 1 CP8). Pure: the API asks `decide` before every send, the settings screen uses `cleanPrefs`, and the tests pin the caps.
export const PUSH_KINDS = ['answered', 'group', 'busy', 'deadline'] // a knock only reaches people who are in the village, so it never needs a push
export const QUIET_DEFAULT = { from: 23, to: 8 }
export const defaultPrefs = () => ({ types: { answered: true, group: true, busy: true, deadline: true }, quiet: { ...QUIET_DEFAULT } })

const hour = (v, fallback) => (Number.isInteger(v) && v >= 0 && v <= 23 ? v : fallback)
/** Whatever the browser sent -> valid prefs (unknown keys dropped, missing ones default). */
export function cleanPrefs(b) {
  const d = defaultPrefs(), t = b?.types ?? {}
  for (const k of PUSH_KINDS) if (typeof t[k] === 'boolean') d.types[k] = t[k]
  d.quiet = { from: hour(b?.quiet?.from, QUIET_DEFAULT.from), to: hour(b?.quiet?.to, QUIET_DEFAULT.to) }
  return d
}

/** { hour, minute } on the person's own clock, or null for a time zone we do not know (then nothing is sent rather than guessing). */
export function localParts(now, tz) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now).map((x) => [x.type, x.value]))
    return { hour: Number(p.hour) % 24, minute: Number(p.minute) }
  } catch { return null }
}
/** Quiet hours wrap midnight (23 to 8). from === to means no quiet hours. */
export const isQuiet = ({ from, to }, h) => (from === to ? false : from > to ? h >= from || h < to : h >= from && h < to)
/** Epoch ms of this person's local midnight (to the minute), for "have they opened the village today". */
export const localDayStart = (now, tz) => { const l = localParts(now, tz); return l ? now - (l.hour * 60 + l.minute) * 60_000 : now - 24 * 3_600_000 }

/** Should this push go out? ctx: sentToday = how many of this kind were sent today (per village for 'group', per person for 'busy'); already = this item was sent before ('deadline'); openedToday = opened the village today ('busy'). */
export function decide({ kind, prefs, now, tz, sentToday = 0, already = false, openedToday = false }) {
  if (!PUSH_KINDS.includes(kind) || prefs?.types?.[kind] === false) return { send: false, why: 'off' }
  const l = localParts(now, tz)
  if (!l) return { send: false, why: 'tz' }
  if (isQuiet(prefs?.quiet ?? QUIET_DEFAULT, l.hour)) return { send: false, why: 'quiet' }
  if (kind === 'group' && sentToday >= 2) return { send: false, why: 'cap' } // at most 2 a day per village
  if (kind === 'busy' && (sentToday >= 1 || openedToday)) return { send: false, why: openedToday ? 'opened' : 'cap' } // 1 a day in total, and not if you were already here today
  if (kind === 'deadline' && already) return { send: false, why: 'already' } // once per item
  return { send: true }
}
