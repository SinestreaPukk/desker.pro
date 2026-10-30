// The one place dates and durations become words.
const noon = (d) => new Date(`${d}T12:00`)

// "Fri 31 Oct" from yyyy-mm-dd
export const fmtDate = (d) => (d ? noon(d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : '')

// Hours -> "45 min", "1 h 30 min", "4 h". Never "0.8h".
export function fmtDuration(hours) {
  const m = Math.round((hours || 0) * 60)
  if (m < 60) return `${m} min`
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`
}

// "Today", "Tomorrow", "In 4 days", "Yesterday", "3 days ago"; beyond two weeks the plain date.
export function relDate(d, today = new Date().toLocaleDateString('sv')) {
  const n = Math.round((noon(d) - noon(today)) / 864e5)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  if (n > 1 && n <= 14) return `In ${n} days`
  if (n < -1 && n >= -14) return `${-n} days ago`
  return fmtDate(d)
}
