// The Coming up list: everything on the calendar, by day, then Later. Each item says its kind, so meetings and things to do can look different. Pure.
import { meetingsOn, clock, happensOn, repeatsOn, taskClock, toMinutes, typeOf } from './events.js'

const fmt = (d, o) => new Date(`${d}T12:00`).toLocaleDateString('en-GB', o)
const dayName = (d) => fmt(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')
const onDate = (d) => fmt(d, { day: 'numeric', month: 'short' })
const DAYS_SHOWN = 7 // then everything is under Later
const range = (s, e) => `${clock(s)}–${clock(e)}`
const named = (title, time) => (time ? `${title}, ${time}` : title)
const dueTime = (x) => (!x.hm ? '' : x.end > x.hm ? range(toMinutes(x.hm), toMinutes(x.end)) : clock(toMinutes(x.hm)))

export function comingUp({ tasks, projects, events = [], busy = [] }, now = Date.now()) {
  const n = new Date(now), minute = n.getHours() * 60 + n.getMinutes()
  const plus = (i) => new Date(n.getFullYear(), n.getMonth(), n.getDate() + i, 12).toLocaleDateString('sv')
  const today = plus(0), end = plus(DAYS_SHOWN)
  const due = [
    ...tasks.filter((t) => t.due && !t.done && !t.fun && !t.session).map((t) => ({ id: `t${t.id}`, kind: 'due', type: 'taskReminder', title: t.title, date: t.due, hm: taskClock(t), task: t })),
    ...projects.filter((p) => p.date && (p.date >= today || (p.progress ?? 0) < 5)).map((p) => ({ id: `p${p.id}`, kind: 'due', type: typeOf({ project: p }), title: p.title, date: p.date, hm: p.time, end: p.end, project: p })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const groups = Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const date = plus(i)
    const meetings = meetingsOn(date, events, busy).filter((m) => i > 0 || m.allDay || m.e > minute)
      .map((m) => ({ id: `${m.id}-${date}`, kind: 'meeting', type: typeOf(m), label: m.allDay ? m.title : named(m.title, range(m.s, m.e)), at: m.allDay ? -1 : m.s, meeting: m }))
    const items = due.filter((x) => (i ? x.date === date : x.date <= date) || (x.task && repeatsOn(x.task, date))).map((x) => ({ ...x, label: named(x.title, dueTime(x)), at: x.hm ? toMinutes(x.hm) : Infinity }))
    return { name: i ? dayName(date) : 'Today', items: [...meetings, ...items].sort((a, b) => a.at - b.at) } // whole-day events, then through the day, then due any time
  })

  // Under Later, something that repeats shows once, at its next time.
  const nextWeekly = (e) => { for (let i = DAYS_SHOWN; i < DAYS_SHOWN * 2; i++) if (e.date <= plus(i) && happensOn(e, plus(i))) return plus(i) }
  const own = events.map((e) => ({ e, date: e.weekly ? nextWeekly(e) : e.date })).filter((x) => x.date && x.date >= end)
    .map(({ e, date }) => ({ id: `m${e.id}`, kind: 'meeting', type: 'taskMeeting', title: e.title, date, meeting: e }))
  const nextRepeat = (t) => { for (let i = DAYS_SHOWN; i < DAYS_SHOWN + 62; i++) if (repeatsOn(t, plus(i))) return plus(i) } // long enough for a monthly one
  const repeats = due.filter((x) => x.task?.repeat && x.date < end).flatMap((x) => { const date = nextRepeat(x.task); return date ? [{ ...x, date }] : [] })
  const seen = new Set()
  const imported = busy.map((x, i) => ({ id: `i${i}`, kind: 'meeting', type: 'imported', title: x.t, date: x.d || new Date(x.s).toLocaleDateString('sv') }))
    .filter((x) => x.date >= end).sort((a, b) => a.date.localeCompare(b.date)).filter((x) => !seen.has(x.title) && seen.add(x.title))
  const later = [...own, ...imported, ...repeats, ...due.filter((x) => x.date >= end)].sort((a, b) => a.date.localeCompare(b.date))
    .map((x) => ({ ...x, label: `${x.title}, ${onDate(x.date)}` }))
  return [...groups, { name: 'Later', items: later }].filter((g) => g.items.length)
}
