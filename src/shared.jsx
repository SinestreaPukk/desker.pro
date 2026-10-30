import { post } from './api.js'
import { isMissed, timeRatio } from './tasks.js'
import { energyProfile } from './energy.js'
import { encodeFile } from './files.js'
import { LEVELS, Q } from './ui.js'

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
export const patternOf = (d) => { const p = energyProfile(d.energyLog); return p.enough && (p.high.length || p.low.length) ? { high: p.high, low: p.low } : undefined }
export const ratioOf = (tasks) => timeRatio(tasks)?.ratio
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
export const color = (t) => (t.fun ? 'bg-pale' : quadrant(t) === undefined ? 'bg-white border' : Q[quadrant(t)].cls)
export const minutes = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes() }
export const DATE = /^\d{4}-\d\d-\d\d$/
// Merge the AI agent's plan into the workspace.
export function applyPlan(d, o) {
  const ups = new Map((o.updates || []).map((u) => [u.id, u]))
  const tasks = d.tasks.map((t) => {
    const u = ups.get(t.id)
    if (!u) return t
    const p = {}
    if (Number.isFinite(u.readiness)) p.readiness = Math.min(100, Math.max(0, u.readiness))
    if (Number.isFinite(u.hours)) p.hours = u.hours
    if (DATE.test(u.when)) p.when = u.when
    if (/^\d\d:\d\d$/.test(u.start)) p.start = u.start
    return { ...t, ...p }
  })
  const fun = Array.isArray(o.fun)
    ? o.fun.filter((f) => f.title && DATE.test(f.when)).map((f, i) => ({ id: Date.now() + i, title: f.title, when: f.when, start: /^\d\d:\d\d$/.test(f.start) ? f.start : undefined, hours: Number(f.hours) || undefined, fun: true, done: false, happy: 100 }))
    : null
  return { ...d, tasks: fun ? [...tasks.filter((t) => !t.fun || t.done), ...fun] : tasks, freeHours: Number.isFinite(o.freeHours) ? o.freeHours : d.freeHours, freeToday: Number.isFinite(o.freeToday) ? { date: todayStr(), hours: o.freeToday } : d.freeToday, mood: typeof o.mood === 'string' && o.mood ? o.mood.slice(0, 80) : d.mood }
}

export const freeTodayOf = (d) => (d.freeToday?.date === todayStr() ? d.freeToday.hours : undefined)
export const QUICK = ['Help me plan my day', 'Replan my week', 'Weekly review', 'Help me set my goals', 'Help me find my goals', "I'm feeling stressed", "I'm low on energy"]

export { fmtDate } from './format.js'

export function Happy({ value = 50, onChange, label = 'How do you feel about this task?' }) {
  return (
    <label className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600" title={`Feeling: ${value} of 100`}>
      {label}
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="text-xs">Dread</span>
        <input type="range" aria-label="How do you feel about this task? Left is dreading it, right is looking forward to it" min="0" max="100" className="w-28" value={value} onChange={(e) => onChange(+e.target.value)} />
        <span aria-hidden="true" className="text-xs">Look forward</span>
      </span>
    </label>
  )
}
