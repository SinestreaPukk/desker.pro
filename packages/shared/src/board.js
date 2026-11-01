// Plain JS (no TS build step in the Vercel API); types in board.d.ts.
// The Board (SPEC §7, Phase 0): deadlines that members chose to share, merged and sorted. Pure, so the API builds it and tests cover it.

const DAY = 86_400_000
const COURSE = /\b([A-Za-z]{2,5})\s?(\d{3,4})\b/ // case does not matter (people type "dtip 122"); only the village's own course tags decide what shows
// "DTIP122" and "DTIP 122" are the same course (decision: course codes are parsed by regex)
export const courseOf = (text) => { const m = COURSE.exec(text); return m ? `${m[1].toUpperCase()} ${m[2]}` : null }
export const normTitle = (t) => t.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim()
const isExam = (t) => /\b(exam|midterm|mid-term|final|quiz|test)\b|สอบ/i.test(t)

/** red under 24 h (and for 24 h after), amber under 3 days, else blue. */
export const urgency = (dueAt, now) => (dueAt - now < DAY ? 'red' : dueAt - now < 3 * DAY ? 'amber' : 'blue')

/** Keeps the village's courses only, drops items over 24 h past, merges the same course + title within +-1 day, and sorts by date.
 *  Auto rows (members' own deadlines) show only inside the window: due 7 days ahead, exams 60. Manual rows (`manual: true`, with `itemId` and `confirmers`) always show.
 *  Each entry says who has it (`userIds`: sharers, the adder, confirmers) and which manual item it is (`itemId`), so it can be confirmed, edited or deleted. */
export function buildBoard(rows, courseTags, now) {
  const tags = new Set(courseTags.map((c) => courseOf(c) ?? c.toUpperCase()))
  const out = []
  for (const r of [...rows].sort((a, b) => a.dueAt - b.dueAt)) {
    if (!r.courseCode || !tags.has(r.courseCode) || r.dueAt < now - DAY) continue
    const kind = r.kind ?? (isExam(r.title) ? 'exam' : 'due')
    if (!r.manual && r.dueAt > now + (kind === 'exam' ? 60 : 7) * DAY) continue
    const n = normTitle(r.title), conf = r.confirmers ?? []
    const hit = out.find((e) => e.courseCode === r.courseCode && e.kind === kind && normTitle(e.title) === n && Math.abs(e.dueAt - r.dueAt) <= DAY)
    const people = [r.userId, ...conf]
    if (hit) {
      for (const u of people) if (!hit.userIds.includes(u)) hit.userIds.push(u)
      for (const u of conf) if (!hit.confirmedBy.includes(u)) hit.confirmedBy.push(u)
      if (r.itemId && !hit.itemId) { hit.itemId = r.itemId; hit.createdBy = r.createdBy }
    } else out.push({ key: `${r.courseCode}|${n}|${new Date(r.dueAt).toISOString().slice(0, 10)}`, kind, courseCode: r.courseCode, title: r.title, dueAt: r.dueAt, userIds: [...new Set(people)], confirmedBy: [...conf], ...(r.itemId && { itemId: r.itemId, createdBy: r.createdBy }) })
  }
  return out
}

/** The entry that already says this (same course, same normalised title, date within a day), or undefined. Used when someone adds an item by hand. */
export const findDuplicate = (entries, { courseCode, title, dueAt }) =>
  entries.find((e) => e.courseCode === courseCode && normTitle(e.title) === normTitle(title) && Math.abs(e.dueAt - dueAt) <= DAY)

// Desker keeps dates without a time zone; Thai universities are all UTC+7.
export const parseDue = (date, time) => (/^\d{4}-\d\d-\d\d$/.test(date ?? '') && (time == null || time === '' || /^\d\d:\d\d$/.test(time)) ? Date.parse(`${date}T${time || '23:59'}:00+07:00`) : NaN)
const bkk = (ms) => new Date(ms + 7 * 3_600_000).toISOString()

/** Is this already in the person's Desker planner? (`deadlines` as Desker stores them: title, date, time) */
export const plannerHas = (deadlines, { title, dueAt }) => deadlines.some((d) => normTitle(String(d.title ?? '')) === normTitle(title) && Math.abs(parseDue(d.date, d.time) - dueAt) <= DAY)

/** A deadline in the shape Desker's own screens create ({ id, title, date, time, hours, context }). The id never clashes with an existing one. */
export const plannerDeadline = (deadlines, { title, courseCode, dueAt }, now = Date.now()) => {
  const t = bkk(dueAt).slice(11, 16)
  return { id: Math.max(now, ...deadlines.map((d) => Number(d.id) + 1 || 0)), title, date: bkk(dueAt).slice(0, 10), ...(t !== '23:59' && { time: t }), hours: null, context: courseCode ?? '' }
}
