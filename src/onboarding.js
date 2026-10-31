// First-run: turns the Welcome answers into saved data. Pure, so it can be tested.
import { addTasks } from './tasks.js'
import { repair } from './schedule.js'
import { plannerOf } from './rhythm.js'

// answers: { sharpest, slow, at } (or { skipped, at }); first: { task } | { deadline } | undefined.
// A first task gets a real slot in this week's plan, so Today opens with a "Right now" suggestion.
export function startFrom(d, answers, first, now = new Date()) {
  let tasks = d.tasks || [], deadlines = d.deadlines || []
  if (first?.deadline) deadlines = [...deadlines, first.deadline]
  if (first?.task) {
    tasks = addTasks(tasks, [first.task])
    const id = tasks[tasks.length - 1].id
    tasks = repair({ tasks, changed: [id], busy: d.busy || [], deadlines, freeHours: d.freeHours ?? 4, now, ...(plannerOf({ ...d, onboarding: answers }) || {}) }).tasks
  }
  return { ...d, onboarding: answers, tasks, deadlines }
}
