// The ranked goal list. Goal rank is the array order; the Vision (level 0) sits apart from it. Pure.
export const rankedGoals = (goals) => goals.filter((g) => g.level !== 0)
export const visionOf = (goals) => goals.find((g) => g.level === 0)

// Moves a goal to a place in the ranked list, clamped to its ends.
export function moveGoal(goals, id, to) {
  const ranked = rankedGoals(goals)
  const from = ranked.findIndex((g) => g.id === id)
  if (from < 0) return goals
  const [goal] = ranked.splice(from, 1)
  ranked.splice(Math.max(0, Math.min(to, ranked.length)), 0, goal)
  return [...goals.filter((g) => g.level === 0), ...ranked]
}

export function setVision(goals, text, id = Date.now()) {
  const title = text.trim(), old = visionOf(goals), rest = goals.filter((g) => g !== old)
  if (!title) return rest
  return [old ? { ...old, title } : { id, title, level: 0, happiness: false }, ...rest]
}
