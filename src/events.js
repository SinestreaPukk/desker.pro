// What sits on the calendar, for one day. Meetings happen at a time, with no tick or progress. Tasks and projects with a due date sit there like reminders. Pure.
export const toMinutes = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m }
const pad = (n) => String(n).padStart(2, '0')
const weekday = (date) => new Date(`${date}T12:00`).getDay()
const localDay = (ms) => new Date(ms).toLocaleDateString('sv')
const ofDay = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes() }

export function addHour(hm) {
  const end = toMinutes(hm) + 60
  return end >= 1440 ? '23:59' : `${pad(Math.floor(end / 60))}:${pad(end % 60)}`
}

// 840 -> "2pm", 570 -> "9:30am"
export function clock(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ''}${h < 12 ? 'am' : 'pm'}`
}

export const happensOn = (e, day) => (e.weekly ? day >= e.date && weekday(day) === weekday(e.date) : e.date === day)

// Whole-day events first, then by start time. `source` is your own event, for editing; imported ones have none.
export function meetingsOn(day, events = [], busy = []) {
  const own = events.filter((e) => happensOn(e, day)).map((e) => ({ id: `m${e.id}`, title: e.title, s: toMinutes(e.start), e: toMinutes(e.end || addHour(e.start)), imported: false, source: e }))
  const imported = busy.flatMap((x, i) => {
    if ((x.d || localDay(x.s)) !== day) return []
    if (x.d) return [{ id: `i${i}`, title: x.t, allDay: true, imported: true }]
    const s = ofDay(x.s), e = localDay(x.e) === day ? ofDay(x.e) : 1440
    return [{ id: `i${i}`, title: x.t, s, e: e > s ? e : s + 30, imported: true }]
  })
  return [...own, ...imported].sort((a, b) => (a.allDay ? -1 : a.s) - (b.allDay ? -1 : b.s))
}

const REMINDER_MINUTES = 30
// A reminder is one small mark at its time. A project meeting runs to its end.
const timed = (hm, end) => (hm ? { s: toMinutes(hm), e: end > hm ? toMinutes(end) : Math.min(1440, toMinutes(hm) + REMINDER_MINUTES) } : { allDay: true })
// A task's time: its own, or one carried over from an old deadline.
export const taskClock = (t) => t.time || (t.when === t.due && t.start) || ''

// Does a repeating task come back on this later date? Only the next one is a real task, made when you finish the one before. Monthly matches nextDate in tasks.js: a short month uses its last day.
export function repeatsOn(t, date) {
  if (!t.repeat || !t.due || date <= t.due) return false
  if (t.repeat === 'daily') return true
  if (t.repeat === 'weekdays') return ![0, 6].includes(weekday(date))
  if (t.repeat === 'weekly') return weekday(date) === weekday(t.due)
  if (t.repeat !== 'monthly') return false
  const [y, m, d] = date.split('-').map(Number)
  return d === Math.min(+t.due.slice(8), new Date(y, m, 0).getDate())
}

// Open tasks and projects due on this day: whole-day ones first, then by time. Sessions have no date, so they never come here.
// `future` marks a later time of a repeating task: you can see it and open it, but only the current one can be ticked or moved.
export function dueOn(date, tasks, projects, today = date) {
  const list = [
    ...tasks.filter((t) => (t.due === date || repeatsOn(t, date)) && !t.done && !t.fun && !t.session).map((t) => ({ id: `t${t.id}`, title: t.title, task: t, ...timed(taskClock(t)), ...(t.due !== date && { future: true }) })),
    ...projects.filter((p) => p.date === date && (date >= today || (p.progress ?? 0) < 5)).map((p) => ({ id: `p${p.id}`, title: p.title, project: p, ...timed(p.time, p.end) })),
  ]
  return list.sort((a, b) => (a.allDay ? -1 : a.s) - (b.allDay ? -1 : b.s))
}

const toHm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
const SNAP = 30

// A task's time lives in when + start, which is what reminders read. It replaces any time carried over from an old deadline.
export const taskTime = (date, hm) => ({ when: hm ? date : undefined, start: hm || undefined, time: undefined })

// What changes when something on the calendar is dropped on a day and time. An empty time means the all-day row.
export const movedDue = ({ task, project }, date, hm) => (task ? { due: date, ...taskTime(date, hm) }
  : { date, time: hm || undefined, ...(project?.end && { end: movedEnd(project.time, project.end, hm) }) })

// The new end when a meeting's start moves: it stays as long as it was.
export const movedEnd = (start, end, hm) => toHm(Math.min(1439, toMinutes(hm) + toMinutes(end) - toMinutes(start)))
export const movedMeeting = (e, date, hm) => ({ ...e, date, start: hm, end: movedEnd(e.start, e.end || addHour(e.start), hm) })

// The minute of the day a drop lands on, from how far down the hour grid it is.
export function dropMinutes(y, px, firstHour, lastHour) {
  const steps = Math.floor((y / px) * (60 / SNAP))
  return Math.max(firstHour * 60, Math.min((lastHour * 60) - SNAP, firstHour * 60 + steps * SNAP))
}
export const hmFromMinutes = toHm

// There are two choices. Task or project: a task is one thing, a project has progress and sessions. Reminder or meeting: one fixed time, or a start and an end.
export const typeOf = (x) => (x.project ? (x.project.end ? 'projectMeeting' : 'projectReminder')
  : x.task ? 'taskReminder'
    : x.imported || x.meeting?.imported ? 'imported' : 'taskMeeting')

const DAY_START = '09:00' // reminders treat 9am as the start of the day too
const withGoal = (x) => (x.goalId ? { goalId: x.goalId } : {})

// A task meeting lives in the events list, so a task switches over through a draft that has no id until it is saved. Its first end is an hour on.
// A meeting has only one repeat, so a task with any other stays a task.
export const canBeMeeting = (t) => !!t.due && (!t.repeat || t.repeat === 'weekly')
export function taskToMeeting(t) {
  const start = taskClock(t) || DAY_START
  return { title: t.title, date: t.due, start, end: addHour(start), ...(t.repeat === 'weekly' && { weekly: true }), ...withGoal(t) }
}
export const meetingToTask = (e) => ({ type: 'task', title: e.title, ...(e.date && { due: e.date }), ...(e.date && e.start && { when: e.date, start: e.start }), ...(e.weekly && { repeat: 'weekly' }), ...(e.projectId && { projectId: e.projectId }), ...withGoal(e) })

// A project stays a project either way. Being a meeting only adds an end.
export const meetingTimes = (start, end) => { const time = start || DAY_START; return { time, end: end > time ? end : addHour(time) } }
export const projectAsMeeting = (p) => meetingTimes(p.time)
export const meetingToProject = (x, kind) => ({ type: 'project', title: x.title, ...(x.date && { due: x.date }), ...(x.start && { time: x.start }), ...(kind === 'Meeting' && { end: x.end }), ...withGoal(x) })

// The one place a project is built from an added item.
export const newProject = (i, id) => ({ id, title: i.title, ...(i.due && { date: i.due }), ...(i.time && { time: i.time }), ...(i.end && { end: i.end }), ...(i.goalId && { goalId: i.goalId }) })

// A task or task meeting turning into a project, all in one change so the old item can't come back. `from` is { task: id } or { event: id }.
export const becomeProject = (d, from, x, kind, id = Math.max(Date.now(), ...d.projects.map((p) => p.id + 1))) => ({
  ...d,
  tasks: d.tasks.filter((t) => t.id !== from.task),
  events: d.events.filter((e) => e.id !== from.event),
  projects: [...d.projects, newProject(meetingToProject(x, kind), id)],
})
