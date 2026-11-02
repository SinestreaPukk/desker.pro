// Natural-language quick add, one-tap dates, and checks on what chat proposes. All pure.
const iso = (d) => d.toLocaleDateString('sv')
const plus = (today, n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d) }
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const pad = (n) => String(n).padStart(2, '0')
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const DAY_MONTH = new RegExp(`\\s(\\d{1,2})\\s+${MONTH}\\b`, 'i')
const MONTH_DAY = new RegExp(`\\s${MONTH}\\s+(\\d{1,2})\\b`, 'i')
const WEEKDAY = /\s(?:on\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i
// The next time this day and month come round, today included. A day the month doesn't have rolls over.
function dayOfYear(day, month, today) {
  const m = MONTHS.indexOf(month.slice(0, 3).toLowerCase())
  const d = new Date(today.getFullYear(), m, +day, 12)
  return iso(d) < iso(today) ? iso(new Date(today.getFullYear() + 1, m, +day, 12)) : iso(d)
}

// "Call dentist tomorrow 3pm #taxes" -> { title, due, when, start, projectId }. Words that are not recognised stay in the title.
export function parseQuick(text, projects = [], today = new Date()) {
  let s = ` ${text} `, date, start
  const out = {}
  const take = (re, fn) => { const m = s.match(re); if (m) { s = s.replace(re, ' '); fn(m) } }
  take(/\s#(\S+)/, (m) => {
    const p = projects.find((p) => p.title.toLowerCase().replace(/\s+/g, '').startsWith(m[1].toLowerCase()))
    if (p) out.projectId = p.id; else s += ` #${m[1]}`
  })
  take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i, (m) => {
    const h = +m[1] % 12 + (m[3].toLowerCase() === 'pm' ? 12 : 0)
    if (+m[1] >= 1 && +m[1] <= 12) start = `${pad(h)}:${m[2] || '00'}`; else s += ` ${m[0]}`
  })
  if (!start) take(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/, (m) => { start = `${pad(+m[1])}:${m[2]}` })
  take(/\s(?:today|tonight)\b/i, () => { date = plus(today, 0) })
  take(/\s(?:tomorrow|tmr)\b/i, () => { date = plus(today, 1) })
  take(/\snext week\b/i, () => { date = plus(today, 7) })
  take(/\sin\s+(\d+)\s+days?\b/i, (m) => { date = plus(today, +m[1]) })
  if (!date) take(MONTH_DAY, (m) => { date = dayOfYear(m[2], m[1], today) })
  if (!date) take(DAY_MONTH, (m) => { date = dayOfYear(m[1], m[2], today) })
  if (!date) take(WEEKDAY, (m) => { date = plus(today, (WEEKDAYS.indexOf(m[1].slice(0, 3).toLowerCase()) - today.getDay() + 7) % 7) })
  if (start && !date) date = plus(today, 0)
  const title = s.replace(/\s+/g, ' ').trim()
  if (!title) return { title: text.trim() }
  out.title = title
  if (date) out.due = date
  if (start) { out.when = date; out.start = start }
  return out
}

// The one-tap date choices. Weeks start on Monday and these land on their last day. Tapped on a Sunday, "this week" means the week ahead.
export function quickDate(kind, today = new Date()) {
  const toSunday = 7 - today.getDay()
  return plus(today, { today: 0, tomorrow: 1, thisWeek: toSunday, nextWeek: toSunday + 7 }[kind])
}

// What chat proposes is only a suggestion until tapped, so nothing but a type, a title and a real date gets through.
export function validAdds(list) {
  if (!Array.isArray(list)) return []
  return list.flatMap((a) => {
    const title = typeof a?.title === 'string' ? a.title.trim().slice(0, 200) : ''
    if (!title || !['task', 'project'].includes(a.type)) return []
    return [{ type: a.type, title, ...(/^\d{4}-\d\d-\d\d$/.test(a.due) && { due: a.due }) }]
  }).slice(0, 40)
}

// A date input reports a value while its year is still being typed ("0002-11-03").
export const isRealDate = (d) => d >= '2000'
