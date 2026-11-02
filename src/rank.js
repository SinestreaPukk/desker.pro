// The live order of everything to do, with no AI. Pure.
import { daysLeft, isDate, pace, urgencyOf } from './sessions.js'
import { rankedGoals } from './goals.js'

const NOT_LINKED = 0.25
const URGENT = 0.6 // where the matrix's urgent boxes start, and what a drag to them counts as
const round = (n) => Math.round(n * 1e6) / 1e6 // so scores that are equal on paper tie
const days = (n) => `${n} day${n === 1 ? '' : 's'}`

// Rank r of N goals runs from 1.0 down to 0.5. With no goals at all, everything is 0.5.
function importanceOf(ranked, r) {
  if (!ranked.length) return 0.5
  if (r < 0) return NOT_LINKED
  return ranked.length === 1 ? 1 : 1 - (0.5 * r) / (ranked.length - 1)
}

function dueWords(left) {
  if (left < -1) return `Was due ${days(-left)} ago.`
  if (left === -1) return 'Was due yesterday.'
  if (left === 0) return 'Due today.'
  return left === 1 ? 'Due tomorrow.' : `Due in ${days(left)}.`
}

function progressWords({ progress = 0 }, left) {
  if (left === null) return `Progress ${progress}/5.`
  if (left < 0) return `Progress ${progress}/5, ${days(-left)} past due.`
  return left === 0 ? `Progress ${progress}/5, due today.` : `Progress ${progress}/5 with ${days(left)} left.`
}

function dueLabel(left, date) {
  if (left < 0) return 'Overdue'
  if (left <= 1) return left ? 'Due tomorrow' : 'Due today'
  const d = new Date(`${date}T00:00`)
  return `Due ${left < 7 ? d.toLocaleDateString('en-GB', { weekday: 'short' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

// A session row is new each day, so a drag on it lives on its project.
const noteOwner = (task, project) => (task?.session && project) || task

export function rank({ goals, projects, tasks }, now = Date.now()) {
  const ranked = rankedGoals(goals)
  return tasks.filter((t) => !t.done && !t.fun).map((task) => {
    const project = projects.find((p) => p.id === task.projectId)
    const r = ranked.findIndex((g) => g.id === (project?.goalId ?? task.goalId))
    const note = noteOwner(task, project)
    const importance = note.important === undefined ? importanceOf(ranked, r) : note.important ? 1 : NOT_LINKED
    const paced = project ? pace(project, now) : null
    const dueIn = isDate(task.due) ? daysLeft(task.due, now) : null
    const fromDue = dueIn === null ? 0 : urgencyOf(dueIn)
    const fromPace = paced ? urgencyOf(paced.perStep) : 0
    const urgency = note.urgent === undefined ? Math.max(fromDue, fromPace) : note.urgent ? URGENT : 0
    // The reason says where things stand, never how to do the work.
    const showProgress = project && (dueIn === null || (paced && fromDue <= fromPace))
    const when = showProgress ? progressWords(project, paced ? paced.daysLeft : null) : dueIn === null ? '' : dueWords(dueIn)
    const serves = r >= 0 ? `Serves goal #${r + 1}, ${ranked[r].title}.` : ''
    const short = showProgress && paced ? `${project.progress ?? 0}/5, ${paced.daysLeft < 0 ? 'overdue' : paced.daysLeft ? days(paced.daysLeft) : 'today'}`
      : dueIn !== null ? dueLabel(dueIn, task.due) : r >= 0 ? `#${r + 1} goal` : 'No goal'
    return {
      task, importance, urgency,
      score: round(importance * (1 + urgency)),
      date: [task.due, project?.date].filter(Boolean).sort()[0],
      box: (importance >= 0.5 ? 0 : 2) + (urgency >= URGENT ? 0 : 1), // an index into Q in ui.js
      why: [when, serves].filter(Boolean).join(' ') || (ranked.length ? 'Not linked to a goal.' : 'No date.'),
      short,
    }
  }).sort((a, b) => b.score - a.score || (a.date || '9').localeCompare(b.date || '9'))
}

function changeNote({ tasks, projects }, id, change) {
  const task = tasks.find((t) => t.id === id)
  const owner = noteOwner(task, projects.find((p) => p.id === task?.projectId))
  if (owner !== task) return { tasks, projects: projects.map((p) => (p === owner ? change(p) : p)) }
  return { tasks: tasks.map((t) => (t === task ? change(t) : t)), projects }
}

// Dropping a task in a matrix box (an index into Q) puts a note on it, which rank() reads. The drag wins at any date.
export const dragTo = (doc, id, box) => changeNote(doc, id, (x) => ({ ...x, important: box < 2, urgent: box % 2 === 0 }))

export const letAppDecide = (doc, id) => changeNote(doc, id, ({ important, urgent, manual, reason, ...rest }) => rest)

// Finished tasks and sessions this week (from Monday) per goal id, for the Goals page and the weekly review.
export function doneByGoal(tasks, projects, now = Date.now()) {
  const n = new Date(now), monday = new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7)).getTime()
  const counts = new Map()
  for (const t of tasks) {
    if (!t.done || t.fun || !(t.doneAt >= monday)) continue
    const goal = projects.find((p) => p.id === t.projectId)?.goalId ?? t.goalId
    counts.set(goal, (counts.get(goal) || 0) + 1)
  }
  return counts
}
