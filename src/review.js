import { LEVELS, FUN, NO_GOAL } from './ui.js'

export const SLICES = [...LEVELS.map((l) => l.name), 'Fun', 'No goal']
export const SLICE_COLOR = Object.fromEntries([...LEVELS, FUN, NO_GOAL].map((s) => [s.name, s.color]))
const day = (d) => d.toLocaleDateString('sv')
const zero = () => Object.fromEntries(SLICES.map((s) => [s, 0]))
const h1 = (n) => Math.round(n * 10) / 10

// How this week (Monday to Sunday) is split across the goal levels, fun and work with no goal.
// Planned = hours on tasks with a planned day this week. Done = hours (timer time if logged) on tasks finished this week.
export function weekReview(tasks, goals, now = Date.now()) {
  const n = new Date(now), mon = new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7))
  const next = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7)
  const [from, to] = [day(mon), day(next)]
  const planned = zero(), done = zero()
  let doneCount = 0
  for (const t of tasks) {
    const g = goals.find((x) => x.id === t.goalId)
    const slice = t.fun ? 'Fun' : g ? LEVELS[g.level].name : 'No goal'
    if (t.when && t.when >= from && t.when < to) planned[slice] += t.hours || 1
    if (t.done && t.doneAt >= mon.getTime() && t.doneAt < next.getTime()) { done[slice] += t.spent || t.hours || 1; if (!t.fun) doneCount++ }
  }
  const work = SLICES.filter((s) => s !== 'Fun').reduce((a, s) => a + planned[s], 0)
  const alignment = work ? Math.round(((work - planned['No goal']) / work) * 100) : null
  const list = (o) => SLICES.map((s) => `${s} ${h1(o[s])}h`).join(', ')
  const text = `Planned hours this week: ${list(planned)}. Done hours: ${list(done)}. ${doneCount} task${doneCount === 1 ? '' : 's'} finished.`
    + (alignment === null ? '' : ` ${alignment}% of planned work hours link to a goal.`)
  return { planned, done, alignment, text, empty: SLICES.every((s) => !planned[s] && !done[s]) }
}
