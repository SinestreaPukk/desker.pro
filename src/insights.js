// What Desker has learned about you, in plain sentences, and a recap of the week. Pure functions over tasks, goals and the energy log.
import { energyProfile, ranges } from './energy.js'
import { timeRatio } from './tasks.js'
import { taskXp } from './game.js'

const day = (d) => d.toLocaleDateString('sv')
const mondayOf = (now) => { const n = new Date(now); return new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7)) }
const PARTS = [['morning', (h) => h < 12], ['afternoon', (h) => h >= 12 && h < 17], ['evening', (h) => h >= 17]]

// Each line is only said when there is enough data behind it.
export function learned({ tasks = [], energyLog = [] }) {
  const out = []
  const done = tasks.filter((t) => t.done && t.doneAt && !t.fun)
  if (done.length >= 6) {
    const counts = PARTS.map(([name, test]) => [name, done.filter((t) => test(new Date(t.doneAt).getHours())).length]).sort((a, b) => b[1] - a[1])
    if (counts[0][1] / done.length >= 0.5) out.push(`You finish most of your tasks in the ${counts[0][0]} (${Math.round((counts[0][1] / done.length) * 100)}%).`)
  }
  const r = timeRatio(tasks)
  if (r) out.push(r.ratio >= 1.15 ? `Your tasks take about ${r.ratio}x what you estimate. Add some buffer.` : r.ratio <= 0.85 ? `You finish faster than you estimate (about ${r.ratio}x). You can plan more.` : 'Your time estimates are spot on.')
  const e = energyProfile(energyLog)
  if (e.enough && e.high.length) out.push(`Your energy is usually high at ${ranges(e.high)}.`)
  return out
}

// This week (Monday on) against last week.
export function recap({ tasks = [], goals = [] }, now = Date.now()) {
  const mon = mondayOf(now).getTime(), prev = mon - 7 * 864e5
  const inWeek = (t, from, to) => t.done && t.doneAt >= from && t.doneAt < to
  const thisWeek = tasks.filter((t) => inWeek(t, mon, Infinity)), lastWeek = tasks.filter((t) => inWeek(t, prev, mon))
  const monStr = day(new Date(mon))
  const milestones = goals.reduce((n, g) => n + (g.milestones || []).filter((m) => m.at >= monStr).length, 0)
  const byDay = {}
  for (const t of thisWeek) { const d = new Date(t.doneAt).toLocaleDateString([], { weekday: 'long' }); byDay[d] = (byDay[d] || 0) + 1 }
  const best = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]
  return {
    done: thisWeek.length, last: lastWeek.length, xp: thisWeek.reduce((n, t) => n + (t.fun ? 5 : taskXp(t)), 0), milestones,
    hours: Math.round(thisWeek.reduce((n, t) => n + (t.spent || 0), 0) * 10) / 10, best: best && best[0],
  }
}
