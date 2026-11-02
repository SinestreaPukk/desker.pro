// Project progress (0 to 5) against time, and the session rows that keep a project on the Now page. Pure.
import { addTasks, day } from './tasks.js'

const dayNumber = (y, m, d) => Date.UTC(y, m - 1, d) / 864e5

// Whole calendar days from `now` to a yyyy-mm-dd date, negative once it has passed. Clock changes can't shift it.
export function daysLeft(date, now = Date.now()) {
  const n = new Date(now)
  const [y, m, d] = date.split('-').map(Number)
  return dayNumber(y, m, d) - dayNumber(n.getFullYear(), n.getMonth() + 1, n.getDate())
}

// [days per step under this, urgency, label on the project]
const BANDS = [[1, 1, 'Behind'], [2, 0.85, 'Tight'], [4, 0.6, 'Tight'], [8, 0.3, null], [Infinity, 0, null]]
const band = (perStep) => BANDS.find(([under]) => perStep < under)
export const urgencyOf = (perStep) => band(perStep)[1]

// Anything else counts as no date, so one bad value from an imported backup can't break the whole list.
export const isDate = (s) => /^\d{4}-\d\d-\d\d$/.test(s)

// Days left for each progress step left. null when the project has no date.
export function pace(project, now = Date.now()) {
  if (!isDate(project.date)) return null
  const left = daysLeft(project.date, now)
  const progress = project.progress ?? 0
  const perStep = left / Math.max(1, 5 - progress) // open tasks at 5/5 are one step
  return { daysLeft: left, perStep, label: progress >= 5 ? null : band(perStep)[2] }
}

// The word must end the title, with an optional number after it: "Statics midterm", "Quiz 3", not "Final invoice to client".
export const isExam = (title) => /\b(test|exam|quiz|midterm|final)s?(\s+\d+)?\s*$/i.test(title)
export const sessionTitle = (p) => p.sessionTitle || `${isExam(p.title) ? 'Review for' : 'Work on'} ${p.title}`

// Sessions run until the date passes or 5/5, and a project's own open tasks replace them.
const canHaveSession = (tasks, p, now) => (p.progress ?? 0) < 5 && !(p.date && daysLeft(p.date, now) < 0)
  && !tasks.some((t) => t.projectId === p.id && !t.session && !t.done && !t.fun)
const newSession = (p) => ({ title: sessionTitle(p), projectId: p.id, session: true })

// Keeps exactly one open session on each active project. Finishing anything in a project clears it until tomorrow.
// Returns the same list when nothing changed, so a sync on its own never causes a save.
export function syncSessions(tasks, projects, now = Date.now()) {
  const active = new Map(projects.filter((p) => canHaveSession(tasks, p, now)).map((p) => [p.id, p]))
  const covered = new Set()
  const kept = tasks.flatMap((t) => {
    if (!t.session || t.done) return [t]
    const p = active.get(t.projectId)
    if (!p || covered.has(p.id)) return []
    covered.add(p.id)
    return [t.title === sessionTitle(p) ? t : { ...t, title: sessionTitle(p) }]
  })
  const today = day(new Date(now))
  const finishedToday = new Set(tasks.filter((t) => t.done && t.doneAt && day(new Date(t.doneAt)) === today).map((t) => t.projectId))
  const added = [...active.values()].filter((p) => !covered.has(p.id) && !finishedToday.has(p.id)).map(newSession)
  const same = !added.length && kept.length === tasks.length && kept.every((t, i) => t === tasks[i])
  return same ? tasks : addTasks(kept, added)
}

// Projects with nothing on Now because something in them was finished today. "Another session" stays one tap away for these.
export function restingProjects(tasks, projects, now = Date.now()) {
  const today = day(new Date(now))
  return projects.filter((p) => canHaveSession(tasks, p, now)
    && !tasks.some((t) => t.session && !t.done && t.projectId === p.id)
    && tasks.some((t) => t.projectId === p.id && t.done && t.doneAt && day(new Date(t.doneAt)) === today))
}

// The "Another session" button: skips the wait until tomorrow, but still never makes a second open session.
export function anotherSession(tasks, project, now = Date.now()) {
  const open = tasks.some((t) => t.session && !t.done && t.projectId === project.id)
  return open || !canHaveSession(tasks, project, now) ? tasks : addTasks(tasks, [newSession(project)])
}
