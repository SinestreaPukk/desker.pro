// The one way tasks get created. The UI (form, dump box, deadline options) uses it, and so can any
// future source (e.g. a LINE webhook) that writes into the same workspace document.
export function addTasks(tasks, items) {
  const base = Math.max(Date.now(), ...tasks.map((t) => t.id + 1))
  return [...tasks, ...items.filter((i) => i.title?.trim()).map((i, k) => ({ done: false, happy: 50, ...i, title: i.title.trim(), id: base + k }))]
}

const day = (d) => d.toLocaleDateString('sv')

// Next occurrence of a repeating date, always after `today` (so finishing late does not create an overdue copy).
export function nextDate(from, repeat, today = day(new Date())) {
  const d = new Date(`${from}T12:00:00`), day0 = d.getDate()
  const step = () => {
    if (repeat === 'monthly') {
      d.setDate(1); d.setMonth(d.getMonth() + 1)
      d.setDate(Math.min(day0, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
    } else {
      d.setDate(d.getDate() + (repeat === 'weekly' ? 7 : 1))
      if (repeat === 'weekdays') while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1)
    }
  }
  step()
  while (day(d) <= today) step()
  return day(d)
}

// Compares the old and new task lists after any edit: stamps doneAt on newly finished tasks, clears it on
// reopened ones, and adds the next copy of finished repeating tasks.
export function settle(prev, next, now = Date.now()) {
  const was = new Map(prev.map((t) => [t.id, !!t.done]))
  const finished = []
  const tasks = next.map((t) => {
    if (!was.has(t.id) || was.get(t.id) === !!t.done) return t
    if (!t.done) { const { doneAt, ...rest } = t; return rest }
    finished.push(t)
    return { ...t, doneAt: now }
  })
  const today = day(new Date(now))
  const copies = finished.filter((t) => t.repeat).map(({ id, doneAt, ...t }) => ({
    ...t, done: false, subs: (t.subs || []).map((s) => ({ ...s, done: false })),
    due: t.due ? nextDate(t.due, t.repeat, today) : t.when ? t.due : nextDate(today, t.repeat, today), when: t.when ? nextDate(t.when, t.repeat, today) : t.when,
  }))
  const out = addTasks(tasks, copies)
  return { tasks: out, finished: finished.map((t) => t.id), spawned: out.slice(tasks.length).map((t) => t.id) }
}

// Done this week (Monday start) and the current day streak, from doneAt stamps.
export function doneStats(tasks, now = Date.now()) {
  const stamps = tasks.filter((t) => t.done && t.doneAt && !t.fun).map((t) => t.doneAt)
  const days = new Set(stamps.map((s) => day(new Date(s))))
  const n = new Date(now), monday = new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7)).getTime()
  let streak = 0
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12)
  if (!days.has(day(d))) d.setDate(d.getDate() - 1) // today may not have a finished task yet
  while (days.has(day(d))) { streak++; d.setDate(d.getDate() - 1) }
  return { week: stamps.filter((s) => s >= monday).length, streak }
}

// A planned task whose day (or start + length, when it has a start time) has passed without being done.
export function isMissed(t, now = Date.now()) {
  if (t.done || t.fun || !t.when) return false
  const n = new Date(now)
  if (t.when < day(n)) return true
  if (t.when > day(n) || !/^\d\d:\d\d$/.test(t.start || '')) return false
  return new Date(`${t.when}T${t.start}:00`).getTime() + (t.hours || 1) * 36e5 <= now
}

// How long tasks really take compared with the user's estimates, from tasks finished with a timer. null until 3 samples.
export function timeRatio(tasks) {
  const s = tasks.filter((t) => t.done && t.spent > 0 && t.hours > 0)
  if (s.length < 3) return null
  const r = s.reduce((a, t) => a + t.spent, 0) / s.reduce((a, t) => a + t.hours, 0)
  return { ratio: Math.round(Math.min(3, Math.max(0.5, r)) * 100) / 100, n: s.length }
}
