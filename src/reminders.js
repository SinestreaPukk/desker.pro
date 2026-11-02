// Which browser notifications are due right now. Pure: the caller fires them and remembers the keys.
const at = (date, time) => new Date(`${date}T${time}:00`).getTime()
const MIN = 6e4, HOUR = 60 * MIN
const TIME = /^\d\d:\d\d$/

export function dueReminders(now, tasks, projects = []) {
  const out = []
  const leadUp = (kind, id, title, date, time) => {
    const m = at(date, time || '09:00') // no time given: the start of the day
    for (const [name, lead, end] of [['1 day', 24 * HOUR, HOUR], ['1 hour', HOUR, 0]]) { // windows do not overlap
      if (now >= m - lead && now < m - end) out.push({ key: `${kind}:${id}:${date}:${time || ''}:${name}`, title, body: `Due in about ${name}${time ? ` (${time})` : ''}.` })
    }
  }
  for (const t of tasks) {
    if (t.done || t.fun || t.session) continue
    if (t.when && TIME.test(t.start || '')) {
      const s = at(t.when, t.start)
      if (now >= s && now < s + 10 * MIN) out.push({ key: `t:${t.id}:${t.when}:${t.start}`, title: t.title, body: `Starts now (${t.start}).` })
    }
    if (t.due) leadUp('d', t.id, t.title, t.due, t.time || (t.when === t.due && t.start) || '')
  }
  for (const p of projects) if (p.date && (p.progress ?? 0) < 5) leadUp('p', p.id, p.title, p.date, p.time)
  return out
}
