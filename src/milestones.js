// Goal milestones and the kodama's mood. A milestone is { id, title, at? } on a goal; `at` is the local day it was reached.
// Reached today: the kodama is happy. Reached yesterday: today is a lucky day. Neither: the kodama stays as it is.
export const dayStr = (d = new Date()) => d.toLocaleDateString('sv')
export const prevDay = (day) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() - 1); return dayStr(d) }
export const msOf = (g) => g.milestones || []
const reached = (goals, day) => goals.some((g) => msOf(g).some((m) => m.at === day))

export function kodamaMood(goals, today = dayStr()) {
  const happy = reached(goals, today), lucky = reached(goals, prevDay(today))
  return { mood: happy ? 'happy' : lucky ? 'lucky' : 'idle', happy, lucky }
}
export const progress = (g) => ({ done: msOf(g).filter((m) => m.at).length, total: msOf(g).length })

const edit = (goals, id, fn) => goals.map((g) => (g.id === id ? { ...g, milestones: fn(msOf(g)) } : g))
export const addMilestone = (goals, id, title, mid = Date.now()) => (title.trim() ? edit(goals, id, (ms) => [...ms, { id: mid, title: title.trim().slice(0, 200) }]) : goals)
export const removeMilestone = (goals, id, mid) => edit(goals, id, (ms) => ms.filter((m) => m.id !== mid))
export const toggleMilestone = (goals, id, mid, today = dayStr()) => edit(goals, id, (ms) => ms.map((m) => {
  if (m.id !== mid) return m
  if (m.at) { const { at, ...rest } = m; return rest }
  return { ...m, at: today }
}))
