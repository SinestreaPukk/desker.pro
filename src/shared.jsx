import { post } from './api.js'
import { isMissed, timeRatio } from './tasks.js'
import { profile, plannerOf } from './rhythm.js'
import { repair } from './schedule.js'
import { encodeFile } from './files.js'
import { LEVELS, Q, CAL } from './ui.js'

// Plain-language answer to "where does this belong?", shown where work is created.
export const WorkHelp = ({ className = '' }) => (
  <details className={className}>
    <summary className="underline">Task, deadline or project?</summary>
    <ul className="mt-2 space-y-1 text-base text-slate-700">
      <li><b className="font-semibold">Task:</b> one thing to do. Give it a date if it has to be done by then.</li>
      <li><b className="font-semibold">Deadline:</b> an exam, quiz or assignment date. It holds the tasks that lead up to it.</li>
      <li><b className="font-semibold">Project:</b> a course or group project that holds several deadlines and shows your progress. Create one on the Projects page.</li>
    </ul>
  </details>
)

// undefined until the AI has ranked the task
export const quadrant = (t) => t.important === undefined ? undefined : (t.important ? 0 : 2) + (t.urgent ? 0 : 1)

export async function prioritise(goals, tasks) {
  const out = await post('/api/prioritise', { goals: goals.map(({ id, title, level, happiness }) => ({ id, level: LEVELS[level].name, kind: happiness ? 'happiness' : 'work', title })), tasks: tasks.map(({ id, title, due }) => ({ id, title, due })) })
  if (!Array.isArray(out)) throw new Error('The AI gave an unreadable answer. Please try again.')
  return out
}

// Photos, PDFs, text files and web pages -> plain notes the planner can use.
export async function readSource({ file, url }) {
  let body = { url }
  if (!url) {
    body = await encodeFile(file)
    if (body.text !== undefined) return body.text.slice(0, 6000)
  }
  return (await post('/api/read', body)).text
}

// Imported calendar events: { t: title, d: 'yyyy-mm-dd' } (all-day) or { t, s, e } (epoch ms).
export const evDay = (e) => e.d || new Date(e.s).toLocaleDateString('sv')
export const hhmm = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
export const hm24 = (ms) => new Date(ms).toLocaleTimeString('sv').slice(0, 5)
// What the AI sees: the next two weeks, in the user's local time.
export function busyForAI(busy = []) {
  const from = new Date().toLocaleDateString('sv'), to = new Date(Date.now() + 14 * 864e5).toLocaleDateString('sv')
  return busy.filter((e) => evDay(e) >= from && evDay(e) <= to).slice(0, 60)
    .map((e) => (e.d ? { date: e.d, allDay: true, title: e.t } : { date: evDay(e), start: hm24(e.s), end: hm24(e.e), title: e.t }))
}
export async function importCalendar(body) {
  return (await post('/api/import', body)).events
}


export const REPEATS = [['', 'Never'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]
export const patternOf = (d) => { const e = profile(d).energy; const high = e.confident ? e.hours('high') : [], low = e.confident ? e.hours('low') : []; return high.length || low.length ? { high, low } : undefined }
// How much longer than estimated this person's work takes. The rhythm model's number once it has 3+ finished tasks to go on
// (App publishes it with setLiveRatio each render, so the six screens that ask the AI to break work down do not need it passed in), else the old timer-based ratio.
let live
export const setLiveRatio = (r) => { live = r }
export const ratioOf = (tasks) => live ?? timeRatio(tasks)?.ratio
// scheduler options from what Desker has learned (nothing when the user switched learning off)
export const plannerArgs = (d) => { const p = plannerOf(d); return p ? { scale: p.scale, pad: p.pad, energy: p.energy } : {} }
export const todayStr = () => new Date().toLocaleDateString('sv')
// Calendar-based suggestion: what the schedule says to do now.
export function fromCalendar(tasks) {
  const open = tasks.filter((t) => !t.done)
  const due = open.filter((t) => dateKey(t) && dateKey(t) <= todayStr())
  const pool = due.length ? due : open.filter((t) => !t.fun)
  const best = [...pool].sort((a, b) => (quadrant(a) ?? 9) - (quadrant(b) ?? 9) || (dateKey(a) || '9').localeCompare(dateKey(b) || '9'))[0]
  return best && { taskId: best.id, title: best.title, method: 'Calendar plan',
    why: due.length ? (dateKey(best) < todayStr() ? 'Overdue on your calendar.' : 'Planned for today on your calendar.') : 'Top of your priority list.', minutes: best.hours ? Math.round(best.hours * 60) : undefined }
}

export const dateKey = (t) => t.when || t.due
export const color = (t) => (t.fun ? CAL.fun : CAL.task)
export const minutes = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes() }
export const DATE = /^\d{4}-\d\d-\d\d$/
// Merge the AI agent's plan into the workspace.
export const applyPlan = (d, o) => applyPlanChecked(d, o).data
// The AI's times are proposals: every slot it set is checked by the scheduler (overlaps, free time, deadlines) and moved if invalid.
// Returns { data, problems } where problems are plain sentences for things that could not be made to fit.
export function applyPlanChecked(d, o) {
  const ups = new Map((o.updates || []).map((u) => [u.id, u]))
  const changed = []
  const tasks = d.tasks.map((t) => {
    const u = ups.get(t.id)
    if (!u) return t
    const p = {}
    if (Number.isFinite(u.readiness)) p.readiness = Math.min(100, Math.max(0, u.readiness))
    if (Number.isFinite(u.hours)) p.hours = u.hours
    if (DATE.test(u.when)) p.when = u.when
    if (/^\d\d:\d\d$/.test(u.start)) p.start = u.start
    if (p.when || p.start) changed.push(t.id)
    return { ...t, ...p }
  })
  const fun = Array.isArray(o.fun)
    ? o.fun.filter((f) => f.title && DATE.test(f.when)).map((f, i) => ({ id: Date.now() + i, title: f.title, when: f.when, start: /^\d\d:\d\d$/.test(f.start) ? f.start : undefined, hours: Number(f.hours) || undefined, fun: true, done: false, happy: 100 }))
    : null
  const merged = { ...d, tasks: fun ? [...tasks.filter((t) => !t.fun || t.done), ...fun] : tasks, freeHours: Number.isFinite(o.freeHours) ? o.freeHours : d.freeHours, freeToday: Number.isFinite(o.freeToday) ? { date: todayStr(), hours: o.freeToday } : d.freeToday, mood: typeof o.mood === 'string' && o.mood ? o.mood.slice(0, 80) : d.mood }
  const ids = [...changed, ...(fun || []).map((f) => f.id)]
  if (!ids.length) return { data: merged, problems: [] }
  const fixed = repair({ tasks: merged.tasks, changed: ids, busy: merged.busy || [], deadlines: merged.deadlines || [], freeHours: merged.freeHours ?? 4, freeToday: freeTodayOf(merged), ...plannerArgs(merged) })
  return { data: { ...merged, tasks: fixed.tasks }, problems: fixed.problems.map((p) => p.why) }
}

export const freeTodayOf = (d) => (d.freeToday?.date === todayStr() ? d.freeToday.hours : undefined)
export const QUICK = ['Help me plan my day', 'Replan my week', 'Weekly review', 'Help me set my goals', 'Help me find my goals', "I'm feeling stressed", "I'm low on energy"]

// "Fri 31 Oct" from yyyy-mm-dd
// One date format everywhere, English: "Sat, Oct 31" (with the year when it is not this year).
export const fmtDate = (d) => (d ? new Date(`${d}T00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(d.slice(0, 4) !== String(new Date().getFullYear()) && { year: 'numeric' }) }) : '')
// Same, with "Today", "Tomorrow" and "Yesterday" where they read better (date fields, lists).
export const fmtDay = (d) => { const n = Math.round((new Date(`${d}T12:00`) - new Date(`${todayStr()}T12:00`)) / 864e5); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : fmtDate(d) }

export function Happy({ value = 50, onChange, label = 'How do you feel about this task?' }) {
  return (
    <label className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-slate-600" title={`Feeling: ${value} of 100`}>
      {label}
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="text-xs">Dread</span>
        <input type="range" aria-label="How do you feel about this task? Left is dreading it, right is looking forward to it" min="0" max="100" className="w-28" value={value} onChange={(e) => onChange(+e.target.value)} />
        <span aria-hidden="true" className="text-xs">Look forward</span>
      </span>
    </label>
  )
}
