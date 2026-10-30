// TickTick-style helpers: natural-language quick add, smart lists, and date groups. All pure.
const iso = (d) => d.toLocaleDateString('sv')
const plus = (today, n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d) }
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const pad = (n) => String(n).padStart(2, '0')

// "Call dentist tomorrow 3pm for 1h #taxes" -> { title, due, when, start, hours, projectId }. Words that are not recognised stay in the title.
export function parseQuick(text, projects = [], today = new Date()) {
  let s = ` ${text} `, date, start
  const out = {}
  const take = (re, fn) => { const m = s.match(re); if (m) { s = s.replace(re, ' '); fn(m) } }
  take(/\s#(\S+)/, (m) => {
    const p = projects.find((p) => p.title.toLowerCase().replace(/\s+/g, '').startsWith(m[1].toLowerCase()))
    if (p) out.projectId = p.id; else s += ` #${m[1]}`
  })
  take(/\sfor\s+(\d+(?:\.\d+)?)\s?(?:hours?|hrs?|h)\b/i, (m) => { out.hours = +m[1] })
  take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i, (m) => {
    const h = +m[1] % 12 + (m[3].toLowerCase() === 'pm' ? 12 : 0)
    if (+m[1] >= 1 && +m[1] <= 12) start = `${pad(h)}:${m[2] || '00'}`; else s += ` ${m[0]}`
  })
  if (!start) take(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/, (m) => { start = `${pad(+m[1])}:${m[2]}` })
  take(/\s(?:today|tonight)\b/i, () => { date = plus(today, 0) })
  take(/\s(?:tomorrow|tmr)\b/i, () => { date = plus(today, 1) })
  take(/\snext week\b/i, () => { date = plus(today, 7) })
  take(/\sin\s+(\d+)\s+days?\b/i, (m) => { date = plus(today, +m[1]) })
  if (!date) take(/\s(?:on\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i, (m) => { date = plus(today, (WEEKDAYS.indexOf(m[1].toLowerCase()) - today.getDay() + 7) % 7) })
  if (start && !date) date = plus(today, 0)
  const title = s.replace(/\s+/g, ' ').trim()
  if (!title) return { title: text.trim() }
  out.title = title
  if (date) out.due = date
  if (start) { out.when = date; out.start = start }
  return out
}

export const dateOf = (t) => t.when || t.due

// A task with `from` (and `due`) spans a range: it shows from its start day until it is done.
const startOf = (t) => t.from || dateOf(t)

// Smart lists: plan (dated or in a project), today (incl. overdue), week (next 7 days incl. overdue), inbox (no date, no project), all, done, p:<projectId>.
export function inList(t, list, todayStr) {
  const d = dateOf(t)
  if (t.fun) return false
  if (list === 'done') return !!t.done
  if (t.done) return false
  if (list === 'all') return true
  if (list === 'plan') return !!d || !!t.projectId // everything with a day or a project; the rest waits in the inbox
  if (list === 'today') return !!d && startOf(t) <= todayStr
  if (list === 'week') return !!d && startOf(t) <= plus(new Date(`${todayStr}T00:00`), 7)
  if (list === 'inbox') return !d && !t.projectId
  return t.projectId === Number(list.slice(2))
}

// Date buckets in the order shown, empty ones dropped.
export function groupByDate(tasks, todayStr) {
  const t0 = new Date(`${todayStr}T00:00`), tomorrow = plus(t0, 1), week = plus(t0, 7)
  const names = ['Overdue', 'Today', 'Tomorrow', 'Next 7 days', 'Later', 'No date']
  const bucket = (t) => { const d = dateOf(t); return !d ? 5 : d < todayStr ? 0 : d === todayStr || (t.from && t.from <= todayStr) ? 1 : d === tomorrow ? 2 : d <= week ? 3 : 4 }
  const groups = names.map((name) => ({ name, tasks: [] }))
  for (const t of tasks) groups[bucket(t)].tasks.push(t)
  groups.forEach((g) => g.tasks.sort((a, b) => (dateOf(a) || '').localeCompare(dateOf(b) || '') || (a.start || '99').localeCompare(b.start || '99')))
  return groups.filter((g) => g.tasks.length)
}

// Two sections only: due soon (overdue through the next 7 days, a started range counts) and due later (further out, or no date).
export function groupSoon(tasks, todayStr) {
  const week = plus(new Date(`${todayStr}T00:00`), 7)
  const groups = [{ name: 'Due soon', tasks: [] }, { name: 'Due later', tasks: [] }]
  for (const t of tasks) groups[dateOf(t) && startOf(t) <= week ? 0 : 1].tasks.push(t)
  groups.forEach((g) => g.tasks.sort((a, b) => (dateOf(a) || '9').localeCompare(dateOf(b) || '9') || (a.start || '99').localeCompare(b.start || '99')))
  return groups.filter((g) => g.tasks.length)
}
