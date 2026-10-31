// Badges and the habit streak. Growth (src/kodama.js) is the only progression: there is no XP, no level and no daily quest.
// Badges reward honest habits, the things that make Desker's plans better (real times, wrap-ups, energy taps), never how many tasks were ticked.
// They are shown in the kodama's window on Today (components/KodamaHome.jsx), earned ones plus the next one to go for.
import { dayStr } from './milestones.js'
import { accuracyByWeek } from './rhythm.js'

const BADGES = [
  ['timed', 'Real time', 'Time a task with the timer, or tell Desker how long it took', 1],
  ['morning', 'First plan', 'Do a morning plan', 1],
  ['wrapup', 'Wrapped up', 'Do an evening wrap-up', 1],
  ['energy8', 'Energy aware', 'Tap your energy 8 times', 8],
  ['closer', 'Sharper plan', 'Have a week where Desker\'s plan was closer than your own guess', 1],
  ['focus', 'Deep focus', 'Focus for 5 hours with the timer', 5],
]

export function badgeStats(data = {}) {
  const r = data.rhythm || {}, k = data.kodama || {}
  const timed = (r.outcomes || []).length + Object.values(r.archive || {}).reduce((n, a) => n + (a.n || 0), 0)
  const closer = accuracyByWeek(r.outcomes || []).filter((w) => w.n >= 3 && w.planErr != null && w.planErr < w.estErr).length
  const timer = (data.tasks || []).reduce((n, t) => n + (t.spent || 0), 0)
  const sessions = (r.sessions || []).reduce((n, s) => n + (s.active || 0), 0) / 60
  return { timed, morning: (k.rituals?.morning || []).length, wrapup: (k.rituals?.evening || []).length, energy8: (data.energyLog || []).length, closer, focus: Math.round(Math.max(timer, sessions) * 10) / 10 }
}

// [{ id, name, how, got, now, goal }]
export function badgesOf(data) {
  const s = badgeStats(data)
  return BADGES.map(([id, name, how, goal]) => ({ id, name, how, goal, now: Math.min(s[id], goal), got: s[id] >= goal }))
}
// The one to go for: the unearned badge you are furthest along on.
export const nextBadge = (badges) => badges.filter((b) => !b.got).sort((a, b) => b.now / b.goal - a.now / a.goal)[0]

// Days on which you did any honest habit: a focus session, a time told, an energy tap, a morning plan or wrap-up, a task finished with the timer.
export function habitDays(data = {}) {
  const r = data.rhythm || {}, k = data.kodama || {}, out = new Set()
  const add = (ms) => { if (Number.isFinite(ms)) out.add(dayStr(new Date(ms))) }
  for (const s of r.sessions || []) add(s.start ?? s.end)
  for (const o of r.outcomes || []) add(o.at)
  for (const e of data.energyLog || []) add(e.at)
  for (const t of data.tasks || []) if (t.done && t.spent > 0) add(t.doneAt)
  for (const d of [...(k.rituals?.morning || []), ...(k.rituals?.evening || [])]) out.add(d)
  return out
}
// Consecutive days with a habit, forgiving: up to two rest days in any week do not end it (and are not counted). Today does not count against you until it is over.
export function habitStreak(data, now = Date.now()) {
  const days = habitDays(data)
  if (!days.size) return 0
  const first = [...days].sort()[0]
  const d = new Date(now); d.setHours(12, 0, 0, 0)
  if (!days.has(dayStr(d))) d.setDate(d.getDate() - 1)
  const rests = [] // recent days walking back: true = rest day
  let streak = 0
  while (dayStr(d) >= first) {
    const active = days.has(dayStr(d))
    rests.unshift(!active); rests.length = Math.min(rests.length, 7)
    if (active) streak++
    else if (rests.filter(Boolean).length > 2) break
    d.setDate(d.getDate() - 1)
  }
  return streak
}
