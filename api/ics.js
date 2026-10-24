// Subscribable calendar feed of the user's tasks, deadlines and fun sessions (iCalendar).
// Works with Google Calendar, Apple Calendar, Outlook and anything that can subscribe to a URL.
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const UID = /^[0-9a-f-]{36}$/
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const fold = (l) => l.match(/.{1,70}/gu).join('\r\n ')
const ymd = (d) => d.replace(/-/g, '')
const next = (d) => ymd(new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10))

export default async function handler(req, res) {
  const { uid, download } = req.query
  if (!UID.test(uid)) return res.status(400).send('bad uid')
  const [row] = await sql`select data from workspaces where uid = ${uid}`
  const { tasks = [], deadlines = [] } = row?.data ?? {}
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
      [t.hours && `${t.hours}h`, t.when && t.due && `due ${t.due}`, t.reason].filter(Boolean).join(' · '))
  }
  for (const d of deadlines) add(`deadline-${d.id}`, d.date, `Deadline: ${d.title}`, d.hours ? `${d.hours}h needed` : '')
  lines.push('END:VCALENDAR')
  res.setHeader('content-type', 'text/calendar; charset=utf-8')
  if (download) res.setHeader('content-disposition', 'attachment; filename="desker.ics"')
  res.send(lines.map(fold).join('\r\n') + '\r\n')
}
