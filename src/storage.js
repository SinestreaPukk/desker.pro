import { isExam } from './sessions.js'
import { addTasks, day } from './tasks.js'

// Pyramid -> ranked list. Afterwards every goal but the Vision sits at the same level, so the array order alone is the rank.
export function convertGoals(d) {
  const goals = d.goals || []
  const vision = goals.find((g) => g.level === 0)
  const rest = goals.filter((g) => g !== vision)
  if (rest.every((g) => g.level === 3 && !g.top)) return d
  const place = (g) => (g.top ? -1 : g.level) // starred first; spare Visions (level 0) next, then long-term to short-term
  const ranked = [...rest].sort((a, b) => place(a) - place(b)).map(({ top, ...g }) => ({ ...g, level: 3 }))
  return { ...d, goals: vision ? [vision, ...ranked] : ranked, checkGoalOrder: true }
}

// A deadline becomes a dated task in its project; or a dated project if it has tasks or an exam-like title; or else a dated task.
function convertDeadlines({ deadlines = [], tasks = [], projects = [] }) {
  const newTasks = [], newProjects = [], linkTo = new Map()
  let nextId = Math.max(0, ...projects.map((p) => p.id)) + 1
  for (const x of deadlines) {
    const link = { ...(x.goalId && { goalId: x.goalId }), ...(x.time && { time: x.time }) }
    const inProject = projects.some((p) => p.id === x.projectId)
    if (!inProject && (tasks.some((t) => t.deadlineId === x.id) || isExam(x.title))) {
      const id = nextId++
      newProjects.push({ id, title: x.title, date: x.date, ...link, ...(x.done && { progress: 5 }) })
      linkTo.set(x.id, id)
    } else {
      newTasks.push({ title: x.title, due: x.date, done: !!x.done, ...link, ...(inProject && { projectId: x.projectId }) })
      if (inProject) linkTo.set(x.id, x.projectId)
    }
  }
  const finished = new Set(deadlines.filter((x) => x.done).map((x) => x.id)) // finishing a deadline finishes its tasks, as the old screen did
  const relinked = tasks.map(({ deadlineId, ...t }) => (linkTo.has(deadlineId) ? { ...t, projectId: t.projectId ?? linkTo.get(deadlineId), ...(finished.has(deadlineId) && { done: true }) } : t))
  return { tasks: addTasks(relinked, newTasks), projects: [...projects, ...newProjects] }
}

// Planned days from today on become due dates; a missed plan was never a deadline, so it stays saved and unused.
// Flags the AI set would otherwise act as drags forever. Fun sessions stay as saved.
function convertTask(t, today) {
  if (t.fun) return t
  const { important, urgent, reason, ...rest } = t
  const task = t.manual ? t : rest
  return t.when && !t.due && t.when >= today ? { ...task, due: t.when } : task
}

// Everything but the goals. saveDoc deletes rows missing from the document, so a safety copy of the deadlines is kept.
export function convertData(d, now = Date.now()) {
  const { tasks, projects } = convertDeadlines(d)
  return {
    ...d, projects, tasks: tasks.map((t) => convertTask(t, day(new Date(now)))), deadlines: [],
    ...(d.deadlines?.length && { legacyDeadlines: [...(d.legacyDeadlines || []), ...d.deadlines] }),
  }
}

// Each step runs once, tracked by `schema`, so nothing later has to look like it was never converted: a due date you
// clear stays cleared, and flags set through the public API stay. A backup with no stamp converts when restored.
const STEPS = [convertGoals, convertData]
export function upgrade(d, upTo = STEPS.length) {
  const from = d.schema || 0
  return from >= upTo ? d : { ...STEPS.slice(from, upTo).reduce((doc, step) => step(doc), d), schema: upTo }
}

// Upgrades a saved workspace document to the current shape, on load and on backup import. Every new field must be optional so old data keeps working.
export function migrate(d) {
  return upgrade({ ...d, goals: d.goals || [], tasks: d.tasks || [], hobbies: d.hobbies || [], deadlines: d.deadlines || [], projects: d.projects || [], events: d.events || [], freeHours: d.freeHours ?? 4 })
}
