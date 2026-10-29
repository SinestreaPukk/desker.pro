// A project owns tasks through task.projectId. Progress is derived, never stored.
export function progress(p, tasks) {
  const mine = tasks.filter((t) => t.projectId === p.id && !t.fun)
  const done = mine.filter((t) => t.done).length
  return {
    total: mine.length, done,
    pct: mine.length ? Math.round((done / mine.length) * 100) : 0,
    hoursLeft: mine.filter((t) => !t.done).reduce((n, t) => n + (t.hours || 0), 0),
  }
}

// Deleting a project keeps its tasks; they just stop belonging to it.
export const unlink = (tasks, id) => tasks.map((t) => (t.projectId === id ? { ...t, projectId: undefined } : t))
