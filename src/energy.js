// Energy check-ins [{ at: ms, level: 'low'|'medium'|'high' }] and what they say about the user's day.
const SCORE = { low: 0, medium: 1, high: 2 }

// Appends a check-in; a second one within 10 minutes replaces the first (people fiddle with the buttons).
export function logEnergy(log = [], level, now = Date.now()) {
  const last = log[log.length - 1]
  return [...(last && now - last.at < 6e5 ? log.slice(0, -1) : log), { at: now, level }].slice(-500)
}

export const MIN_CHECKINS = 8
// Hours of the day (0-23) where energy is typically high or low (needs 2+ check-ins in that hour).
export function energyProfile(log = []) {
  if (log.length < MIN_CHECKINS) return { enough: false, n: log.length, high: [], low: [] }
  const by = {}
  for (const e of log) (by[new Date(e.at).getHours()] ||= []).push(SCORE[e.level])
  const hours = Object.entries(by).filter(([, v]) => v.length >= 2).map(([h, v]) => [+h, v.reduce((a, b) => a + b, 0) / v.length])
  return { enough: true, n: log.length, high: hours.filter(([, a]) => a >= 1.5).map(([h]) => h).sort((a, b) => a - b), low: hours.filter(([, a]) => a <= 0.5).map(([h]) => h).sort((a, b) => a - b) }
}

// [9,10,11,15] -> "9:00-12:00, 15:00-16:00"
export function ranges(hours) {
  const out = []
  for (const h of hours) {
    const last = out[out.length - 1]
    if (last && last[1] === h) last[1] = h + 1
    else out.push([h, h + 1])
  }
  return out.map(([a, b]) => `${a}:00-${b}:00`).join(', ')
}
