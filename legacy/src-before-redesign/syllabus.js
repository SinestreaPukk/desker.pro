const DATE = /^\d{4}-\d\d-\d\d$/
const day = (d) => d.toLocaleDateString('sv')
const addDays = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return day(d) }
const diffDays = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5)

// Clean the AI's extracted list: dated, titled, capped, hours defaulted. past = already due.
export function validItems(items, today = day(new Date())) {
  return (Array.isArray(items) ? items : []).filter((i) => i?.title && DATE.test(i.date)).slice(0, 40).map((i) => ({
    title: String(i.title).slice(0, 120), date: i.date, type: String(i.type || '').slice(0, 20),
    hours: Number.isFinite(+i.hours) && +i.hours > 0 ? Math.min(60, Math.max(0.5, Math.round(+i.hours * 4) / 4)) : 4, past: i.date < today,
  }))
}

// Study blocks of about 1.5h, the last one the day before the due date and the rest spread evenly backwards.
export function spreadBlocks({ title, date, hours }, today = day(new Date())) {
  const n = Math.min(10, Math.max(1, Math.ceil(hours / 1.5)))
  const span = Math.max(1, diffDays(today, date)) // days available before the due date
  const per = Math.round((hours / n) * 4) / 4
  return Array.from({ length: n }, (_, k) => {
    let when = addDays(date, -(1 + Math.floor((k * span) / n)))
    if (when < today) when = today
    return { when, hours: per }
  }).reverse().map((b, i) => ({ title: `Study: ${title} (${i + 1}/${n})`, when: b.when, due: date, hours: b.hours }))
}
