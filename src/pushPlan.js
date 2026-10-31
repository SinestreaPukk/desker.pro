// What the kodama may say as a notification, and when. Pure, so the rules are testable:
//   - at most two a day, one in the morning (08:00 local) and one in the evening (19:00 local), because the sender runs hourly and each slot is one hour;
//   - never inside the user's quiet hours (default 22:00-08:00; the morning note is at 08:00, so a later quiet end moves it out of the way);
//   - never to someone who has been away for 5+ days (no nagging, no "we miss you");
//   - only when there is something real to say, in the kodama's voice, with the name the user gave it.
import { cleanName } from './persona.js'
import { ritualDue } from './kodama.js'

export const QUIET = { from: '22:00', to: '08:00' }
const hourOf = (hhmm) => Number(String(hhmm).slice(0, 2))
export const inQuiet = (hour, q = QUIET) => { const a = hourOf(q.from), b = hourOf(q.to); return a === b ? false : a < b ? hour >= a && hour < b : hour >= a || hour < b }
export const MORNING_HOUR = 8, EVENING_HOUR = 19

// local: { day: 'yyyy-mm-dd', hour: 0-23 } in the user's own time zone. now: epoch ms.
export function planPush(doc, local, now = Date.now()) {
  const p = doc?.push
  if (!p?.on || !p.sub) return null
  if (doc?.kodama?.lastSeen && now - doc.kodama.lastSeen > 5 * 864e5) return null
  if (inQuiet(local.hour, p.quiet || QUIET)) return null
  const name = cleanName(doc?.kodama?.name)
  const at = new Date(`${local.day}T${String(local.hour).padStart(2, '0')}:30:00`)
  const due = ritualDue(doc, at)
  if (local.hour === MORNING_HOUR && due === 'morning') {
    const n = (doc.tasks || []).filter((t) => !t.done && !t.fun && t.when === local.day).length
    return { tag: `morning-${local.day}`, title: name, body: n ? `Good morning. ${n} thing${n === 1 ? ' is' : 's are'} planned today. Shall we look at it together?` : 'Good morning. Shall we plan the day together?' }
  }
  if (local.hour === EVENING_HOUR && due === 'evening') return { tag: `evening-${local.day}`, title: name, body: 'How did today go? Tell me what got done, and what can wait.' }
  return null
}
