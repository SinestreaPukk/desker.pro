// The one place that says how long a task takes. Everything that shows or uses a task's time (Today, Right now, Coming up, the task
// lists and matrix, the calendar, deadline and project headers, the AI's context, replanning) asks here, so the numbers always agree.
//
//   userEstimate    minutes the user guessed, or null when they gave none
//   plannedMinutes  what Desker plans for: the guess x the learned multiplier, to the nearest 5 minutes (60 x multiplier when there is
//                   no guess). Always worked out now from the current model; nothing reserved earlier is read back.
//   bufferMinutes   slack added after it because you tend to start late (0 when unknown); slotMinutes = planned + buffer is what a
//                   block occupies on the calendar, for the planner and the calendar alike
//   multiplier      the learned multiplier for this kind of work: exactly the number the Rhythm page shows
//   confidence      { label, guessing } from how many timings of this kind of task Desker has
//   reason          one plain sentence for a tooltip
// `rhythm` is timeProfile(data) from rhythm.js (null / learning off means: use the user's own guess).
import { lengthOf } from './schedule.js'
import { typeOf, confidenceOf } from './rhythm.js'

const STEP = 15
const round2 = (x) => Math.round(x * 100) / 100

export function getTaskTime(task, rhythm) {
  const userEstimate = task?.hours > 0 ? Math.round(task.hours * 60) : null
  const off = !rhythm || rhythm.off
  const type = typeOf(task)
  const m = off ? 1 : rhythm.dur.multFor(type)
  const n = off ? 0 : rhythm.dur.byType[type]?.n ?? 0
  const plannedMinutes = lengthOf(task || {}, m)
  const bufferMinutes = off ? 0 : rhythm.pad || 0
  const multiplier = round2(m)
  const adjusted = off ? false : !!userEstimate && plannedMinutes > userEstimate
  const conf = confidenceOf(n)
  const guessing = !off && n < 3
  const confidence = { label: off ? 'learning is off' : guessing ? 'still guessing' : conf.label.toLowerCase(), guessing }
  const k = `${Math.round(m * 10) / 10}x`
  const reason = off ? 'Learning from how you work is switched off, so Desker uses your own guess.'
    : !userEstimate ? `You gave no estimate, so Desker assumes 1h and plans ${k} of it.`
    : n === 0 ? `Starting guess: people usually need about ${k} what they plan. Desker will adjust it as it times your ${type.toLowerCase()} tasks.`
    : guessing ? `Early days: ${n} timing${n === 1 ? '' : 's'} of ${type.toLowerCase()} tasks so far suggest about ${k} your guess.`
    : `Your ${type.toLowerCase()} tasks have taken about ${k} your guess (from ${n} timings).`
  return { userEstimate, plannedMinutes, bufferMinutes, slotMinutes: plannedMinutes + bufferMinutes, multiplier, adjusted, confidence, reason, type, assumed: !userEstimate }
}

// "45 min", "1h", "1h 30m"
export function fmtMin(m) {
  const t = Math.max(0, Math.round(m))
  if (t < 60) return `${t} min`
  const h = Math.floor(t / 60), r = t % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

// One short label for a list row: "1h" when nothing changes, "1h → 1h 30m" when Desker plans more than you guessed, "plans 1h" with no guess.
export function timeLabel(tt) {
  if (tt.assumed) return `plans ${fmtMin(tt.plannedMinutes)}`
  return tt.adjusted ? `${fmtMin(tt.userEstimate)} → ${fmtMin(tt.plannedMinutes)}` : fmtMin(tt.userEstimate)
}

// The full sentence for Right now: "Your guess 1h → Desker plans 1h 30m (~1.3x, still guessing)".
export function timeSentence(tt) {
  const buf = tt.bufferMinutes ? ` + ${fmtMin(tt.bufferMinutes)} buffer` : ''
  if (tt.assumed) return `No estimate yet. Desker plans ${fmtMin(tt.plannedMinutes)}${buf}.`
  if (!tt.adjusted) return `Your guess ${fmtMin(tt.userEstimate)}${buf}.`
  return `Your guess ${fmtMin(tt.userEstimate)} → Desker plans ${fmtMin(tt.plannedMinutes)} (${tt.multiplier}x, ${tt.confidence.label})${buf}.`
}

// "Work left" for a group of tasks (a deadline, a project): Desker's planned time for what is not done, minus time already focused,
// taken up to the next 15 minutes. `guesses` is the same sum using only the user's own estimates (a task with no guess counts as 1h in both).
export function workLeft(tasks, rhythm) {
  let planned = 0, guesses = 0
  for (const t of tasks) {
    if (t.done) continue
    const tt = getTaskTime(t, rhythm), spent = Math.round((t.spent || 0) * 60)
    planned += Math.max(0, tt.plannedMinutes - spent)
    guesses += Math.max(0, (tt.userEstimate ?? 60) - spent)
  }
  const up = (x) => Math.ceil(x / STEP) * STEP
  return { plannedMinutes: up(planned), guessMinutes: up(guesses), differs: up(planned) !== up(guesses) }
}

// "2h of work left" or "2h of work left (your guesses: 1h 30m)"
export function workLeftText(w) {
  return `${fmtMin(w.plannedMinutes)} of work left${w.differs ? ` (your guesses: ${fmtMin(w.guessMinutes)})` : ''}`
}

// Tasks as the AI should see them: the user's own hours plus plannedMinutes, which already includes the learned multiplier.
export const withPlanned = (tasks, rhythm) => tasks.map((t) => (t.hours > 0 || !t.fun ? { ...t, plannedMinutes: getTaskTime(t, rhythm).plannedMinutes } : t))

// The two questions every page asks, by name.
export const getMultiplier = (task, rhythm) => getTaskTime(task, rhythm).multiplier
export const getPlannedMinutes = (task, rhythm) => getTaskTime(task, rhythm).plannedMinutes
