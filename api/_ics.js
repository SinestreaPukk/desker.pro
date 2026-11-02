// Subscribable calendar feed of the user's tasks, deadlines and fun sessions (iCalendar).
// Works with Google Calendar, Apple Calendar, Outlook and anything that can subscribe to a URL.
import { loadDoc } from './_store.js'
import { userOfToken } from './_token.js'
import { limit } from './_rate.js'
import { timeProfile } from '../src/rhythm.js'
import { getTaskTime, fmtMin } from '../src/taskTime.js'

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const fold = (l) => l.match(/.{1,70}/gu).join('\r\n ')
const ymd = (d) => d.replace(/-/g, '')
const next = (d) => ymd(new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10))

export default async function handler(req, res) {
  const { key, download } = req.query
  const uid = await userOfToken(key, 'feed') // the secret link made in Calendar > Connect (not the account id)
  if (!uid) return res.status(404).send('unknown calendar link')
  if (!(await limit(req, res, { scope: 'feed', max: 120, id: uid }))) return // calendar apps poll about hourly
  const doc = await loadDoc(uid)
  const { tasks, deadlines } = doc, tp = timeProfile(doc)
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Desker//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Desker', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H']
  const add = (id, date, title, desc) => {
    if (!/^\d{4}-\d\d-\d\d$/.test(date)) return
    lines.push('BEGIN:VEVENT', `UID:${id}@desker`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${next(date)}`,
      `SUMMARY:${esc(title)}`, ...(desc ? [`DESCRIPTION:${esc(desc)}`] : []), 'TRANSP:TRANSPARENT', 'END:VEVENT')
  }
  for (const t of tasks) {
    if (t.done) continue
    add(`task-${t.id}`, t.when || t.due, `${t.fun ? '' : 'Task: '}${t.title}`,
      [t.hours > 0 && (({ plannedMinutes: p, adjusted }) => adjusted ? `${t.hours}h, Desker plans ${fmtMin(p)}` : `${t.hours}h`)(getTaskTime(t, tp)), t.when && t.due && `due ${t.due}`, t.reason].filter(Boolean).join(' · '))
  }
  for (const d of deadlines) add(`deadline-${d.id}`, d.date, `Deadline: ${d.title}`, d.hours ? `${d.hours}h needed` : '')
  lines.push('END:VCALENDAR')
  res.setHeader('content-type', 'text/calendar; charset=utf-8')
  if (download) res.setHeader('content-disposition', 'attachment; filename="desker.ics"')
  res.send(lines.map(fold).join('\r\n') + '\r\n')
}
