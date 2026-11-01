// The one place that decides WHEN a task happens. Pure and deterministic: nothing here talks to the AI.
// Rules every plan obeys, whoever proposed it (rule-based "Replan", the AI's replan, the chat agent):
//   - no two planned tasks overlap, and none overlaps a timed calendar event;
//   - a day never holds more task hours than the user's free time (today's own number wins today);
//   - a task ends before its due date (and before the linked deadline's time on the last day);
//   - starts stay inside the day window (07:00-23:00 unless told otherwise), and not in the past today.
// A task that cannot meet its deadline is still given the earliest free slot after it, but it comes back
// in `problems` ("Can't fit X before its deadline: 2h short") so the UI can say so instead of hiding it.

export const DAY_START = 7 * 60, DAY_END = 23 * 60
const STEP = 15, MAX_LATE_DAYS = 60

const iso = (d) => d.toLocaleDateString('sv')
const addDays = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d) }
const TIME = /^(\d\d):(\d\d)$/
const mins = (s) => { const m = TIME.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null }
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const up = (m) => Math.ceil(m / STEP) * STEP
// Planned length in minutes: the estimate (1h when there is none) x the learned multiplier, to the nearest 5 minutes, never under 15.
// scale: a number or (task) => number. Nothing is stored on the task: the length is always worked out from the current estimate and
// multiplier, so a changed multiplier can never leave a stale block behind. (Older tasks may carry block/blockOf; they are ignored.)
export const lengthOf = (t, scale = 1) => {
  const k = typeof scale === 'function' ? scale(t) : scale
  return Math.max(STEP, Math.round(((t.hours > 0 ? t.hours : 1) * 60 * k) / 5) * 5)
}
// What a task occupies on the calendar: its planned length plus the buffer (pad) for starting late. Everything that places or
// draws a task uses this one number.
export const slotLength = (t, scale = 1, pad = 0) => lengthOf(t, scale) + pad
// The task with a planned slot written onto it. `pin`: the user chose the time by hand, so planners leave it alone.
export const withSlot = (t, p, pin) => ({ ...t, when: p.when, start: p.start, block: undefined, blockOf: undefined, ...(pin !== undefined && { pinned: pin || undefined }) })
const hoursText = (m) => `${Math.round((m / 60) * 4) / 4}h`

// Imported events ({ t, s, e } in epoch ms; all-day { d } never blocks) -> Map(date -> [{ s, e, title }]) in minutes.
export function busyDays(busy = []) {
  const out = new Map()
  for (const x of busy) {
    if (!x || !Number.isFinite(x.s) || !Number.isFinite(x.e)) continue
    const end = Math.max(x.e, x.s + 60_000)
    let date = iso(new Date(x.s)), n = 0
    while (n++ < MAX_LATE_DAYS) {
      const ds = new Date(`${date}T00:00:00`).getTime()
      const s = Math.max(x.s, ds) - ds, e = Math.min(end, ds + 864e5) - ds
      if (e > s) { if (!out.has(date)) out.set(date, []); out.get(date).push({ s: Math.round(s / 6e4), e: Math.round(e / 6e4), title: x.t || 'Calendar event' }) }
      if (end <= ds + 864e5) break
      date = addDays(date, 1)
    }
  }
  return out
}

const clash = (list, s, e) => list.some(([a, b]) => s < b && a < e)

// tasks: the open tasks to place. fixed: other tasks that stay where they are (they block time and use free hours).
// prefer: { [taskId]: { when, start? } } a proposed slot (from the AI); kept only if it is valid.
// scale: number | (task) => number, how much longer than estimated each task really takes. pad: extra minutes at the end of
// every block (a known tendency to start late). energy: { at(date, minute) -> 0..2, deep(task) -> bool }; deep work then
// takes the highest-energy free slot of its day instead of the earliest one (the day itself is still the earliest that works).
// Returns { plan: [{ id, when, start, len, late?, assumed? }], problems: [{ id, title, why, short? }] }.
export function schedule({ tasks, fixed = [], busy = [], deadlines = [], freeHours = 4, freeToday, prefer = {}, now = new Date(), dayStart = DAY_START, dayEnd = DAY_END, horizon = 14, scale = 1, pad = 0, energy }) {
  const today = iso(now), nowMin = now.getHours() * 60 + now.getMinutes()
  const occ = new Map(), used = new Map() // date -> [[s, e]] blocked intervals / minutes charged to free time
  const block = (date, s, e) => { if (!occ.has(date)) occ.set(date, []); occ.get(date).push([s, e]) }
  for (const [date, list] of busyDays(busy)) list.forEach(({ s, e }) => block(date, s, e))
  for (const t of fixed) {
    if (t.done || !t.when) continue
    const d = slotLength(t, scale, pad), s = mins(t.start)
    if (s != null) block(t.when, s, s + d)
    if (!t.fun) used.set(t.when, (used.get(t.when) || 0) + d)
  }
  const capOf = (date) => Math.max(0, (date === today && freeToday != null ? freeToday : freeHours) * 60)
  const roomOn = (date) => Math.max(0, capOf(date) - (used.get(date) || 0))
  const floorOn = (date) => Math.max(dayStart, date === today ? up(nowMin) : 0)
  const avgEnergy = (date, s, d) => { let sum = 0, n = 0; for (let m = s; m < s + d; m += 30) { sum += energy.at(date, m); n++ } return sum / n }
  const slot = (date, d, floor, ceil, t) => {
    const list = occ.get(date) || []
    const pick = energy && t && energy.deep(t)
    let best = null, top = -1
    for (let s = up(floor); s + d <= ceil; s += STEP) {
      if (clash(list, s, s + d)) continue
      if (!pick) return s
      const v = avgEnergy(date, s, d)
      if (v > top + 0.05) { best = s; top = v } // only a real improvement moves it, so ties keep the earliest time
    }
    return best
  }
  const lastDayOf = (t) => {
    const dl = deadlines.find((x) => x.id === t.deadlineId)
    return [t.due, dl?.date].filter(Boolean).sort()[0] || null
  }
  const limitOn = (t, date, last) => {
    const dl = deadlines.find((x) => x.id === t.deadlineId)
    const m = dl && dl.date === date && date === last ? mins(dl.time) : null
    return m != null ? Math.min(dayEnd, m) : dayEnd
  }

  const plan = [], problems = []
  const order = [...tasks].filter((t) => !t.done).sort((a, b) =>
    (lastDayOf(a) || '9999').localeCompare(lastDayOf(b) || '9999') || (b.important ? 1 : 0) - (a.important ? 1 : 0) || lengthOf(b, scale) - lengthOf(a, scale))
  for (const t of order) {
    const d = slotLength(t, scale, pad), last = lastDayOf(t), assumed = !(t.hours > 0)
    if (!t.fun && d > freeHours * 60) { // longer than any day's free time: it can never fit as one block
      problems.push({ id: t.id, title: t.title, short: (d - freeHours * 60) / 60, why: freeHours > 0 ? `${t.title} needs ${hoursText(d)}, more than your ${hoursText(freeHours * 60)} of free time in a day. Split it into smaller tasks.` : `${t.title} cannot be planned: free time per day is 0.` })
      continue
    }
    const place = (date, s, late) => {
      block(date, s, s + d)
      if (!t.fun) used.set(date, (used.get(date) || 0) + d)
      plan.push({ id: t.id, when: date, start: hm(s), len: d, ...(late && { late: true }), ...(assumed && { assumed: true }) })
    }
    const fits = (date, late) => {
      if (!t.fun && roomOn(date) < d) return null
      return slot(date, d, floorOn(date), late || !(date === last) ? dayEnd : limitOn(t, date, last), t)
    }
    // 1. the proposed slot, if it is valid as it stands
    const p = prefer[t.id]
    if (p && /^\d{4}-\d\d-\d\d$/.test(p.when) && p.when >= today && p.when <= addDays(today, horizon - 1) && (!last || p.when <= last)) {
      const ps = mins(p.start)
      const ok = ps != null
        && ps >= floorOn(p.when) && ps + d <= limitOn(t, p.when, last) && !clash(occ.get(p.when) || [], ps, ps + d) && (t.fun || roomOn(p.when) >= d)
      if (ok) { place(p.when, ps, false); continue }
      if (ps == null) { const s = fits(p.when, false); if (s != null) { place(p.when, s, false); continue } } // right day, no time given: first free time that day
    }
    // 2. the earliest free slot on time
    let done = false, availMin = 0
    for (let i = 0; i < horizon && !done; i++) {
      const date = addDays(today, i)
      if (last && date > last) break
      const s = fits(date, false)
      if (s != null) { place(date, s, false); done = true }
      else { // how much time that day could still have given, for the "N h short" figure
        const list = occ.get(date) || []; let free = 0
        for (let m = up(floorOn(date)); m + STEP <= limitOn(t, date, last); m += STEP) if (!clash(list, m, m + STEP)) free += STEP
        availMin += Math.min(free, roomOn(date))
      }
    }
    if (done) continue
    // 3. it cannot be on time: earliest slot after the deadline, and say so
    const short = Math.max(STEP, d - availMin)
    const first = last ? (last >= today ? addDays(last, 1) : today) : addDays(today, horizon)
    let end = false
    for (let i = 0; i < MAX_LATE_DAYS && !end; i++) {
      const date = addDays(first, i)
      const s = fits(date, true)
      if (s != null) { place(date, s, true); end = true }
    }
    problems.push({ id: t.id, title: t.title, short: short / 60, why: last
      ? `${t.title} doesn't fit before ${new Date(`${last}T12:00:00`).toLocaleDateString('en', { weekday: 'short' })}${last < today ? '' : ` (${hoursText(short)} short)`}. Want to free up time?${end ? '' : ' There is no free time in the next two months.'}`
      : `No free time for ${t.title} in the next ${horizon} days${end ? '' : ' or after'}` })
  }
  return { plan, problems }
}

// Planned tasks that overlap each other or a timed calendar event, as [{ a, b, date }] where a is a task and b a task or { title }.
export function overlaps(tasks, busy = [], scale = 1, pad = 0) {
  const byDate = new Map()
  const push = (date, item) => { if (!byDate.has(date)) byDate.set(date, []); byDate.get(date).push(item) }
  for (const t of tasks) {
    const s = mins(t.start)
    if (t.done || !t.when || s == null) continue
    push(t.when, { s, e: s + slotLength(t, scale, pad), task: t })
  }
  for (const [date, list] of busyDays(busy)) list.forEach((x) => push(date, { s: x.s, e: x.e, event: { title: x.title } }))
  const out = []
  for (const [date, list] of byDate) {
    list.sort((x, y) => x.s - y.s)
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length && list[j].s < list[i].e; j++) {
      const [x, y] = [list[i], list[j]]
      if (x.task || y.task) out.push({ date, a: x.task || y.task, b: x.task && y.task ? y.task : x.event || y.event })
    }
  }
  return out
}

// A whole-week plan: every open work task gets a slot. aiPlan ([{ id, when, start }], optional) is honoured where it is valid.
export function planWeek({ tasks, busy, deadlines, freeHours, freeToday, aiPlan, scale, pad, energy, now, dayStart, dayEnd }) {
  const open = tasks.filter((t) => !t.done)
  const pinned = open.filter((t) => t.pinned && t.when && t.start && !t.fun) // times the user set by hand stay where they are
  // a task keeps its current slot when that is still valid; the AI's proposal, where there is one, wins over it
  const prefer = Object.fromEntries([...open.filter((t) => t.when).map((t) => [t.id, { when: t.when, start: t.start }]), ...(aiPlan || []).map((p) => [p.id, p])])
  return schedule({ tasks: open.filter((t) => !t.fun && !pinned.includes(t)), fixed: [...open.filter((t) => t.fun), ...pinned], busy, deadlines, freeHours, freeToday, prefer, scale, pad, energy, now, dayStart, dayEnd })
}

// Check a handful of tasks whose time was just set by someone else (the chat agent). `changed` = ids to verify; the rest stay put.
// Returns { tasks, problems } with the changed tasks moved only where their proposed slot was invalid.
export function repair({ tasks, changed, busy, deadlines, freeHours, freeToday, now, scale, pad, energy }) {
  const set = new Set(changed)
  const mine = tasks.filter((t) => set.has(t.id) && !t.done)
  const prefer = Object.fromEntries(mine.filter((t) => t.when).map((t) => [t.id, { when: t.when, start: t.start }]))
  const { plan, problems } = schedule({ tasks: mine, fixed: tasks.filter((t) => !set.has(t.id) && !t.done), busy, deadlines, freeHours, freeToday, prefer, now, scale, pad, energy })
  const by = new Map(plan.map((p) => [p.id, p]))
  return { tasks: tasks.map((t) => (by.has(t.id) ? withSlot(t, by.get(t.id), false) : t)), problems }
}

// The invariant: after this, no planned task overlaps another task or a calendar event, except two that the user pinned by hand.
// Call it whenever a planned length may have changed (a new multiplier, an edited estimate). Of each clashing pair, the later
// unpinned task is moved to the next free slot; pinned times never move. Returns { tasks, problems } (tasks is the same array when nothing clashed).
export function settleOverlaps({ tasks, busy = [], scale = 1, pad = 0, ...rest }) {
  const movers = new Set()
  for (const { a, b } of overlaps(tasks, busy, scale, pad)) {
    const mover = [a, b].filter((x) => x.id != null && !x.pinned).at(-1)
    if (mover) movers.add(mover.id)
  }
  if (!movers.size) return { tasks, problems: [] }
  return repair({ tasks, changed: [...movers], busy, scale, pad, ...rest })
}

// "Move the other one": the user pinned an overlap; this moves the later of the two (unpinned) to a free slot.
export function moveOther({ tasks, busy = [], scale = 1, pad = 0, ...rest }, a, b) {
  const id = b.id != null ? b.id : a.id
  return repair({ tasks: tasks.map((t) => (t.id === id ? { ...t, pinned: undefined, when: undefined, start: undefined } : t)), changed: [id], busy, scale, pad, ...rest })
}
