// Plain JS (no TS build step in the Vercel API); types in board.d.ts.
// The Board (SPEC §7, Phase 0): deadlines that members chose to share, merged and sorted. Pure, so the API builds it and tests cover it.

const DAY = 86_400_000
const COURSE = /\b([A-Za-z]{2,5})\s?(\d{3,4})\b/ // case does not matter (people type "dtip 122"); only the village's own course tags decide what shows
// "DTIP122" and "DTIP 122" are the same course (decision: course codes are parsed by regex)
export const courseOf = (text) => { const m = COURSE.exec(text); return m ? `${m[1].toUpperCase()} ${m[2]}` : null }
export const normTitle = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const isExam = (t) => /\b(exam|midterm|mid-term|final|quiz|test)\b|สอบ/i.test(t)

/** red under 24 h (and for 24 h after), amber under 3 days, else blue. */
export const urgency = (dueAt, now) => (dueAt - now < DAY ? 'red' : dueAt - now < 3 * DAY ? 'amber' : 'blue')

/** Keeps the village's courses only, drops items over 24 h past, merges the same course + title within +-1 day, and sorts by date. Due items show 7 days ahead, exams 60. */
export function buildBoard(rows, courseTags, now) {
  const tags = new Set(courseTags.map((c) => courseOf(c) ?? c.toUpperCase()))
  const out = []
  for (const r of [...rows].sort((a, b) => a.dueAt - b.dueAt)) {
    if (!r.courseCode || !tags.has(r.courseCode) || r.dueAt < now - DAY) continue
    const kind = isExam(r.title) ? 'exam' : 'due'
    if (r.dueAt > now + (kind === 'exam' ? 60 : 7) * DAY) continue
    const n = normTitle(r.title)
    const hit = out.find((e) => e.courseCode === r.courseCode && e.kind === kind && normTitle(e.title) === n && Math.abs(e.dueAt - r.dueAt) <= DAY)
    if (hit) { if (!hit.userIds.includes(r.userId)) hit.userIds.push(r.userId) } else out.push({ key: `${r.courseCode}|${n}|${new Date(r.dueAt).toISOString().slice(0, 10)}`, kind, courseCode: r.courseCode, title: r.title, dueAt: r.dueAt, userIds: [r.userId] })
  }
  return out
}
