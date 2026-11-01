// Ending a village focus session writes into the account document exactly as desker.dev's Focus screen does (src/App.jsx):
// a rhythm session, hours added to the task's `spent`, and for Done an outcome that teaches the planner (only if it passes src/rhythm.js's validity rules).
// Pure: takes the document, returns the next one. No I/O, so it is tested directly (test/village-session.test.mjs).
import { addOutcome, addSession, invalidReason, outcomeFor, record, rhythmOf, typeOf } from '../../../../src/rhythm.js'

const round3 = (n) => Math.round(n * 1000) / 1000
const COURSE = /\b([A-Z]{2,5})\s?(\d{3,4})\b/ // "DTIP 122" -> DTIP 122 (decision: course codes are parsed by regex)
export const courseOf = (t) => { const m = COURSE.exec(`${t.title ?? ''} ${t.context ?? ''}`); return m ? `${m[1]} ${m[2]}` : undefined }

/** Today's open tasks, for the picker. */
export const todaysTasks = (doc, date) => (doc.tasks ?? [])
  .filter((t) => !t.done && !t.fun && t.when === date)
  .map((t) => ({ id: String(t.id), title: String(t.title).slice(0, 120), hours: t.hours > 0 ? t.hours : 1, courseCode: courseOf(t), activity: ACTIVITY[typeOf(t)] ?? 'other', repeat: !!t.repeat }))

// Desker's task types -> the village activity enum (packages/shared/src/types.ts)
export const ACTIVITY = { Reading: 'reading', 'Problem set': 'practising', Writing: 'writing', Revision: 'revising', 'Lab report': 'lab_report', 'Group work': 'group_work', Admin: 'admin', Other: 'other' }

/** s = { taskId?, start, end (ms), active (whole minutes), pauses, done }. Returns { doc, reason } where reason is why it will not teach Desker (null = it will). */
export function finishSession(doc, s, now = Date.now()) {
  const active = Math.max(0, Math.round(s.active))
  const task = s.taskId ? (doc.tasks ?? []).find((t) => String(t.id) === String(s.taskId)) : undefined
  let next = doc, reason = 'no_outcome' // no task, or not Done: nothing is taught
  if (task && active > 0) next = { ...next, tasks: next.tasks.map((t) => (t === task ? { ...t, spent: round3((t.spent || 0) + active / 60) } : t)) }
  if (active >= 1) next = record(next, (r) => addSession(r, { task: task?.id, type: task ? typeOf(task) : undefined, start: s.start, end: s.end, active, pauses: s.pauses ?? 0, result: s.done ? 'finished' : 'abandoned' }))
  if (task && s.done && !task.repeat && !task.done) { // repeating tasks are left for Desker to roll over; the time is logged either way
    const t = next.tasks.find((x) => x.id === task.id)
    const tasks = next.tasks.map((x) => (x === t ? { ...x, done: true, doneAt: now } : x))
    next = { ...next, tasks }
    if (!t.fun && t.spent > 0) {
      const o = outcomeFor(t, next, t.spent, 'timer', now)
      reason = invalidReason(o, rhythmOf(next).prefs)
      next = record(next, (r) => addOutcome(r, o))
    }
  }
  return { doc: next, reason }
}
