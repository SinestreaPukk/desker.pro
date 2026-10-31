// The game layer. Nothing is stored: XP, level, quest and badges are all worked out from the tasks, goals and guide you already have,
// so they can never drift from the real data. (Ceiling: deleting finished tasks lowers XP. Store a running total if that ever matters.)
import { doneStats } from './tasks.js'
import { dayStr } from './milestones.js'

const taskXp = (t) => 10 + (t.important ? 5 : 0) + (t.urgent ? 5 : 0) + Math.min(10, Math.round((t.hours || 0) * 2)) // bigger, harder tasks pay more
export const MILESTONE_XP = 25, GUIDE_XP = 50, QUEST_GOAL = 3

export const xpOf = ({ tasks = [], goals = [], guide }) =>
  tasks.filter((t) => t.done).reduce((n, t) => n + (t.fun ? 5 : taskXp(t)), 0)
  + goals.reduce((n, g) => n + (g.milestones || []).filter((m) => m.at).length * MILESTONE_XP, 0) + (guide?.done ? GUIDE_XP : 0)

// Level n starts at 25 * (n-1)^2 XP: 0, 25, 100, 225, 400... quick early wins, slower later.
export const levelOf = (xp) => {
  const level = Math.floor(Math.sqrt(xp / 25)) + 1, from = 25 * (level - 1) ** 2, to = 25 * level ** 2
  return { level, xp, from, to, pct: Math.round(((xp - from) / (to - from)) * 100) }
}

export const questOf = (tasks, today = dayStr()) => {
  const done = tasks.filter((t) => t.done && t.doneAt && !t.fun && dayStr(new Date(t.doneAt)) === today).length
  return { done: Math.min(done, QUEST_GOAL), goal: QUEST_GOAL, complete: done >= QUEST_GOAL }
}

const BADGES = [
  ['first', 'First step', 'Finish a task', (s) => s.tasksDone >= 1],
  ['ten', 'Ten down', 'Finish 10 tasks', (s) => s.tasksDone >= 10],
  ['fifty', 'Fifty down', 'Finish 50 tasks', (s) => s.tasksDone >= 50],
  ['streak3', 'On a roll', 'A 3-day streak', (s) => s.streak >= 3],
  ['streak7', 'Week warrior', 'A 7-day streak', (s) => s.streak >= 7],
  ['milestone', 'Milestone maker', 'Reach a goal milestone', (s) => s.milestones >= 1],
  ['guide', 'Pathfinder', 'Finish the goals guide', (s) => s.guide],
  ['focus', 'Deep focus', 'Log 5 hours with the timer', (s) => s.hours >= 5],
]
export function badgesOf({ tasks = [], goals = [], guide }) {
  const s = { tasksDone: tasks.filter((t) => t.done).length, streak: doneStats(tasks).streak, guide: !!guide?.done,
    milestones: goals.reduce((n, g) => n + (g.milestones || []).filter((m) => m.at).length, 0), hours: tasks.reduce((n, t) => n + (t.spent || 0), 0) }
  return BADGES.map(([id, name, how, test]) => ({ id, name, how, got: test(s) }))
}
