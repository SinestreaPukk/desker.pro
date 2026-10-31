// The kodama companion, as pure functions over the workspace document: its name, how it feels, what it says, which ritual is due,
// and how it grows. Growth rewards honest habits (real times, wrap-ups, energy taps), not how many tasks were ticked: there is no score to lose,
// nothing is deducted for time away, and no line here mentions missed days.
import { cleanName } from './persona.js'
import { dayStr, kodamaMood } from './milestones.js'
import { realityCheck, plannerOf, profile } from './rhythm.js'

export const nameOf = (data) => cleanName(data?.kodama?.name)

// ---- growth -------------------------------------------------------------------------------------------------
export const STAGES = [
  { name: 'Seedling', from: 0, unlock: 'It follows the clock for the view from your window.' },
  { name: 'Sprout', from: 25, unlock: 'Choose the time of day in your window view.' },
  { name: 'Sapling', from: 70, unlock: 'Choose the season in your window view.' },
  { name: 'Young tree', from: 150, unlock: 'A leaf crown is on its way.' },
  { name: 'Elder', from: 300, unlock: 'A small lantern is on its way.' },
]
const DAILY_CAP = { done: 5, energy: 2 } // volume is capped per day: ticking 40 tiny tasks in an hour is not more growth than 5 real ones
const days = (list, key, cap) => { const by = {}; for (const x of list) { const d = dayStr(new Date(key(x))); by[d] = Math.min(cap, (by[d] || 0) + 1) } return Object.values(by).reduce((a, b) => a + b, 0) }

export function growthOf(data) {
  const r = data?.rhythm || {}, k = data?.kodama || {}
  const timings = (r.outcomes || []).length + Object.values(r.archive || {}).reduce((n, a) => n + (a.n || 0), 0)
  const rituals = (k.rituals?.morning || []).length + (k.rituals?.evening || []).length
  const points = (k.legacy || 0) + timings * 3 + rituals * 4
    + days(data?.energyLog || [], (e) => e.at, DAILY_CAP.energy)
    + days((data?.tasks || []).filter((t) => t.done && t.doneAt && !t.fun), (t) => t.doneAt, DAILY_CAP.done)
  const index = STAGES.reduce((i, s, n) => (points >= s.from ? n : i), 0)
  const next = STAGES[index + 1]
  return { points, index, stage: STAGES[index], next, toNext: next ? next.from - points : 0, pct: next ? Math.round(((points - STAGES[index].from) / (next.from - STAGES[index].from)) * 100) : 100 }
}
// What the old XP total becomes the first time this runs: kept as a one-time gift so nobody starts over.
export const legacyGrowth = (xp) => Math.round((Number.isFinite(xp) ? xp : 0) / 8)

// The window view on Today: time of day unlocks at Sprout, the season at Sapling; below that it follows the clock and the calendar.
export const sceneChoice = (data) => {
  const i = growthOf(data).index, c = data?.scene || {}
  return { variant: i >= 1 ? c.variant : undefined, season: i >= 2 ? c.season : undefined }
}

// ---- rituals --------------------------------------------------------------------------------------------------
const doneToday = (data, kind, today) => (data?.kodama?.rituals?.[kind] || []).includes(today)
const skippedToday = (data, kind, today) => data?.kodama?.skip?.[kind] === today
// 'morning' (05:00-13:00, there is something to plan) or 'evening' (from 17:00, something was planned or done today); null otherwise.
export function ritualDue(data, now = new Date()) {
  const today = dayStr(now), h = now.getHours(), tasks = (data?.tasks || []).filter((t) => !t.fun)
  const open = tasks.some((t) => !t.done)
  const mine = tasks.some((t) => t.when === today || (t.done && t.doneAt && dayStr(new Date(t.doneAt)) === today))
  if (h >= 5 && h < 13 && open && !doneToday(data, 'morning', today) && !skippedToday(data, 'morning', today)) return 'morning'
  if (h >= 17 && h < 24 && mine && !doneToday(data, 'evening', today) && !skippedToday(data, 'evening', today)) return 'evening'
  return null
}
const cap = (list, x) => [...list, x].slice(-120)
export const finishRitual = (data, kind, day = dayStr()) => ({ ...data, kodama: { ...data.kodama, rituals: { ...data.kodama?.rituals, [kind]: cap((data.kodama?.rituals?.[kind] || []).filter((d) => d !== day), day) } } })
export const skipRitual = (data, kind, day = dayStr()) => ({ ...data, kodama: { ...data.kodama, skip: { ...data.kodama?.skip, [kind]: day } } })

// ---- how it feels and what it says ------------------------------------------------------------------------
// 'focus' while the timer runs, 'sleepy' late at night, 'happy'/'lucky' for milestones and for a task just finished,
// 'cozy' once the evening wrap-up is done, 'calm' when the day looks heavy (it is concerned, never alarmed), else 'idle'.
export function stateOf(data, { focusing = false, now = new Date(), heavy = false } = {}) {
  const h = now.getHours(), today = dayStr(now)
  if (focusing) return 'focus'
  if (h >= 23 || h < 5) return 'sleepy'
  const m = kodamaMood(data?.goals || [], today)
  if (m.mood !== 'idle') return m.mood
  const justDone = (data?.tasks || []).some((t) => t.done && t.doneAt && now - t.doneAt < 36e5)
  if (justDone) return 'happy'
  if (doneToday(data, 'evening', today)) return 'cozy'
  return heavy ? 'calm' : 'idle'
}

export function lineFor(data, { now = new Date(), focusing = false } = {}) {
  const name = nameOf(data), h = now.getHours(), today = dayStr(now)
  const tasks = (data?.tasks || []).filter((t) => !t.fun), open = tasks.filter((t) => !t.done)
  if (focusing) return 'I am right here. Take your time.'
  if (h >= 23 || h < 5) return 'It is late. Whatever is left can wait until tomorrow. Rest well.'
  if ((data?.kodama?.away || 0) >= 3) return 'Welcome back. No rush: we can start with one small thing.'
  const p = profile(data)
  const check = realityCheck(tasks, plannerOf(data), today, (data?.freeToday?.date === today ? data.freeToday.hours : undefined) ?? data?.freeHours ?? 4)
  if (check?.over && h < 17) return `Today is about ${check.real} hours at your pace, and you have ${check.free} free. Want me to spread it out?`
  const due = ritualDue(data, now)
  if (due === 'morning') return 'Good morning. Shall we look at today together?'
  if (due === 'evening') return 'How did today go? Tell me what got done, and what can wait.'
  if (!tasks.length && !(data?.deadlines || []).length) return `Hi, I am ${name}. Tell me what is due and I will find the time.`
  if (!open.length) return 'Everything is done. Enjoy the quiet.'
  if (!p.off && p.energy.confident) {
    const lvl = p.energy.levelAt(today, h * 60 + now.getMinutes())
    if (lvl === 'high') return 'You usually have good energy around now. A good time for something that needs thinking.'
    if (lvl === 'low') return 'Energy tends to dip around now. Something small and light would suit.'
  }
  const m = kodamaMood(data?.goals || [], today)
  if (m.happy) return 'A milestone. That took real work.'
  if (doneToday(data, 'evening', today)) return 'That is a wrap for today. Be kind to yourself.'
  return 'Ready when you are.'
}
