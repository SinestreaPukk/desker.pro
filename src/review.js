import { doneByGoal } from './rank.js'
import { rankedGoals } from './goals.js'

// What was finished this week (from Monday), goal by goal, for the weekly review in chat.
export function weekReview(tasks, goals, projects = [], now = Date.now()) {
  const counts = doneByGoal(tasks, projects, now)
  const ranked = rankedGoals(goals)
  const lines = ranked.map((g, i) => `#${i + 1} ${g.title}: ${counts.get(g.id) || 0}`)
  const live = new Set(ranked.map((g) => g.id))
  const loose = [...counts].reduce((n, [id, c]) => (live.has(id) ? n : n + c), 0)
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  return { counts, total, text: `Finished this week: ${[...lines, `not linked to a goal: ${loose}`].join(', ')}. ${total} in all.` }
}
