// Which browser notifications are due right now. Pure: the caller fires them and remembers the keys.
const at = (date, time) => new Date(`${date}T${time}:00`).getTime()
const MIN = 6e4, HOUR = 60 * MIN

export function dueReminders(now, tasks, deadlines) {
  const out = []
  for (const t of tasks) {
    if (t.done || !t.when || !/^\d\d:\d\d$/.test(t.start || '')) continue
    const s = at(t.when, t.start)
    if (now >= s && now < s + 10 * MIN) out.push({ key: `t:${t.id}:${t.when}:${t.start}`, title: t.title, body: `Starts now (${t.start}).` })
  }
  for (const d of deadlines) {
    const m = at(d.date, d.time || '09:00') // no time given: the start of the day
    for (const [name, lead, end] of [['1 day', 24 * HOUR, HOUR], ['1 hour', HOUR, 0]]) { // windows do not overlap
      if (now >= m - lead && now < m - end) out.push({ key: `d:${d.id}:${d.date}:${d.time || ''}:${name}`, title: d.title, body: `Due in about ${name}${d.time ? ` (${d.time})` : ''}.` })
    }
  }
  return out
}
