// Reads an iCalendar (.ics) feed or file and returns busy events for the next 5 weeks.
// Works with Google ("secret address in iCal format"), Apple, Outlook and any app that publishes .ics.
import ICAL from 'ical.js'
import { fetchRaw } from './_fetchPage.js'

const DAYS = 35
const MAX = 200
const day = (t) => `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`

export function parseEvents(text, from = Date.now() - 864e5, to = Date.now() + DAYS * 864e5) {
  const root = new ICAL.Component(ICAL.parse(text))
  root.getAllSubcomponents('vtimezone').forEach((z) => ICAL.TimezoneService.register(z))
  const out = []
  const push = (title, start, end) => {
    if (start.isDate) {
      // all-day: DTEND is exclusive; emit one entry per day (date-only, no timezone)
      const last = new ICAL.Time({ year: end.year, month: end.month, day: end.day, isDate: true })
      for (let d = start.clone(), n = 0; d.compare(last) < 0 && n < 14; d.adjust(1, 0, 0, 0), n++) {
        const ms = d.toJSDate().getTime()
        if (ms >= from - 864e5 && ms <= to) out.push({ t: title, d: day(d) })
      }
    } else {
      const s = start.toJSDate().getTime(), e = end.toJSDate().getTime()
      if (e >= from && s <= to) out.push({ t: title, s, e })
    }
  }
  for (const v of root.getAllSubcomponents('vevent')) {
    try {
      const ev = new ICAL.Event(v)
      if (v.getFirstPropertyValue('status') === 'CANCELLED' || !ev.startDate) continue
      const title = String(ev.summary || 'Busy').slice(0, 80)
      const span = ev.endDate ? ev.endDate.subtractDate(ev.startDate) : new ICAL.Duration()
      if (ev.isRecurring()) {
        const it = ev.iterator()
        for (let t = it.next(), n = 0; t && n < 400; t = it.next(), n++) {
          if (t.toJSDate().getTime() > to) break
          const end = t.clone(); end.addDuration(span)
          push(title, t, end)
        }
      } else push(title, ev.startDate, ev.endDate || ev.startDate)
    } catch { /* skip an event we cannot read */ }
  }
  out.sort((a, b) => (a.s ?? Date.parse(a.d)) - (b.s ?? Date.parse(b.d)))
  return out.slice(0, MAX)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { url, text } = req.body || {}
  try {
    const ics = typeof url === 'string'
      ? await fetchRaw(url.trim().replace(/^webcal/i, 'https'), { types: /^(text\/(calendar|plain)|application\/(ics|octet-stream))/, max: 4_000_000, accept: 'text/calendar,text/plain' })
      : typeof text === 'string' && text.length < 4_000_000 ? text : null
    if (!ics || !ics.includes('BEGIN:VCALENDAR')) return res.status(422).json({ error: 'That is not a calendar (.ics) link or file' })
    res.json({ events: parseEvents(ics) })
  } catch (err) {
    res.status(422).json({ error: err.message })
  }
}
