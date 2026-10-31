// Hours put into goals. A task belongs to a goal through task.goalId; "fun" sessions are hobbies, not goal work.
//   per goal:  total = the hours its tasks need, put = the hours already put in (a finished task counts in full, an open one for the time its timer logged)
//   per day:   the goal time planned for today (goal tasks planned or due today, plus goal tasks finished today) against the time put in today.
//              Reaching it is the day's goal milestone: the kodama is happy.
//   free:      every open task that has nothing to do with a goal is done (and at least one was finished today): the rest of the day is for goals or happiness.
import { dayStr } from './milestones.js'

const need = (t) => Math.max(t.hours > 0 ? t.hours : 0, t.spent || 0)
const goalTasks = (tasks = []) => tasks.filter((t) => t.goalId != null && !t.fun)
const doneOn = (t, day) => t.done && t.doneAt && dayStr(new Date(t.doneAt)) === day

export function goalHours(goal, tasks) {
  const mine = goalTasks(tasks).filter((t) => t.goalId === goal.id)
  const total = mine.reduce((n, t) => n + need(t), 0)
  const put = mine.reduce((n, t) => n + (t.done ? need(t) : Math.min(t.spent || 0, need(t))), 0)
  return { total, put, pct: total > 0 ? Math.min(100, Math.round((put / total) * 100)) : 0 }
}

// -> { target, put, pct, reached } in hours, or null when no goal work is planned for today.
export function goalDay(data, today = dayStr()) {
  const mine = goalTasks(data?.tasks).filter((t) => t.when === today || t.due === today || doneOn(t, today))
  const target = mine.reduce((n, t) => n + need(t), 0)
  if (!(target > 0)) return null
  const sessions = data?.rhythm?.sessions || []
  const put = mine.reduce((n, t) => {
    if (doneOn(t, today)) return n + need(t)
    const mins = sessions.filter((s) => s.task === t.id && dayStr(new Date(s.start)) === today).reduce((m, s) => m + (s.active || 0), 0)
    return n + Math.min(mins / 60, need(t))
  }, 0)
  return { target, put, pct: Math.min(100, Math.round((put / target) * 100)), reached: put >= target - 1e-9 }
}

export function freeForGoals(data, today = dayStr()) {
  const own = (data?.tasks || []).filter((t) => t.goalId == null && !t.fun)
  return (data?.goals || []).length > 0 && own.some((t) => doneOn(t, today)) && !own.some((t) => !t.done)
}
