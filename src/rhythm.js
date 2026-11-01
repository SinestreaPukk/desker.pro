// The rhythm engine: learns how long this person's work really takes and when they focus best. Pure functions, no I/O.
// Data lives in data.rhythm = { outcomes, sessions, signals, archive, prefs } plus the existing data.energyLog.
//   outcome  { task, at, type, est, actual, src: 'timer'|'tap', pred? }   est/actual/pred in hours
//   session  { task, type, start, end, active, pauses, result: 'finished'|'abandoned', lag? }   start/end ms, active minutes, lag minutes
//   signal   { k: 'resched'|'accept'|'skip'|'done', at, task? }
//   archive  { [type]: { n, est, act } }   old outcomes folded into sums so the document stays small without forgetting
//   prefs    { off?: true, excluded: [{ from, to }] }   learning switched off / date ranges to ignore (exam week, illness)
// Every learned number starts from a prior and moves toward the data as it arrives: weight n / (n + K), K = 3.

export const TYPES = ['Reading', 'Problem set', 'Writing', 'Revision', 'Lab report', 'Group work', 'Admin', 'Other']
export const PRIOR_MULT = 1.3 // people underestimate: until we have data, plan 30% more than they said
const CAPS = { outcomes: 300, sessions: 150, signals: 150 }

// ---- task type ----------------------------------------------------------------------------------------------
// Cheap, offline guess from the title; an AI-assigned or user-set task.type always wins.
const RULES = [
  ['Lab report', /\blab(s)?\b/i],
  ['Group work', /\b(group|team|meeting|meet up|standup|presentation|pair)\b/i],
  ['Problem set', /\b(problems?|pset|p-set|exercises?|worksheet|homework|hw|quiz|calculus|derive|proofs?|questions)\b/i],
  ['Revision', /\b(revise|revision|review|study|flash ?cards?|past papers?|practice (exam|test)|exam prep|memori[sz]e)\b/i],
  ['Writing', /\b(write|writing|draft|essay|report|outline|reflection|abstract|summary|thesis|proposal)\b/i],
  ['Reading', /\b(read|reading|chapter|ch\.? ?\d+|article|paper|textbook|slides|lecture|watch)\b/i],
  ['Admin', /\b(email|e-mail|register|enrol+|book|submit|form|pay|print|schedule|sign ?up|apply|buy|call|clean|laundry|tidy|upload|renew)\b/i],
]
export const classify = (title = '') => (RULES.find(([, re]) => re.test(title)) || [])[0] || 'Other'
export const typeOf = (t) => (TYPES.includes(t?.type) ? t.type : classify(t?.title))
export const validType = (x) => (TYPES.includes(x) ? x : undefined)
// Deep work gets your best hours; admin and short odds and ends do not need them.
export const isDeep = (t) => { const y = typeOf(t); return y !== 'Admin' && !(y === 'Other' && (t.hours || 1) < 0.75) }

// ---- stored data ----------------------------------------------------------------------------------------------
export const rhythmOf = (data) => ({ outcomes: [], sessions: [], signals: [], archive: {}, ...data?.rhythm, prefs: { excluded: [], ...data?.rhythm?.prefs } })
export const isOff = (data) => !!data?.rhythm?.prefs?.off
// Whether Desker may ask "how is your energy?": learning is on and the user has not switched the questions off.
export const mayAsk = (data) => !isOff(data) && !data?.rhythm?.prefs?.noAsk
const dateOf = (ms) => new Date(ms).toLocaleDateString('sv')
export const isExcluded = (prefs, ms) => (prefs?.excluded || []).some((x) => x.from && x.to && dateOf(ms) >= x.from && dateOf(ms) <= x.to)

// The one rule for what may teach Desker anything (multipliers, accuracy, "learned this week"). est/actual are hours.
// Returns null when the sample is fine, else the reason: 'short' (a few seconds is not a timing), 'wild' (a forgotten timer), 'ignored', 'checkbox'.
export function invalidReason(o, prefs) {
  if (!o || !(o.est > 0) || !(o.actual >= 0)) return 'short'
  if (o.src !== 'timer' && o.src !== 'tap') return 'checkbox' // ticked off with no timer and no duration typed by the user
  if (o.actual * 60 < 5 || o.actual < o.est * 0.15) return 'short'
  if (o.actual > o.est * 6 || o.actual > 10 || o.est > 10) return 'wild'
  if (prefs && isExcluded(prefs, o.at)) return 'ignored'
  return null
}
export const isValidTimingSample = (o, prefs) => invalidReason(o, prefs) === null
export const INVALID_TEXT = { short: 'too short to learn from', wild: 'far longer than planned, likely a forgotten timer', ignored: 'in an ignored period', checkbox: 'no timer and no time entered' }
const usable = (o) => isValidTimingSample(o)

function fold(archive, o) {
  if (!usable(o)) return archive
  const a = archive[o.type] || { n: 0, est: 0, act: 0 }
  return { ...archive, [o.type]: { n: a.n + 1, est: Math.round((a.est + o.est) * 1000) / 1000, act: Math.round((a.act + o.actual) * 1000) / 1000 } }
}
// Oldest records beyond the cap are folded into `archive`, so the model keeps what they taught it.
export function addOutcome(r, o) {
  const outcomes = [...r.outcomes.filter((x) => !(x.task === o.task && x.src === o.src && Math.abs(x.at - o.at) < 6e4)), o]
  let archive = r.archive
  while (outcomes.length > CAPS.outcomes) archive = fold(archive, outcomes.shift())
  return { ...r, outcomes, archive }
}
const push = (key) => (r, x) => ({ ...r, [key]: [...r[key], x].slice(-CAPS[key]) })
export const addSession = push('sessions')
export const addSignal = push('signals')
// Apply a change to data.rhythm unless the user has switched learning off. Use inside setData((d) => record(d, (r) => addSignal(r, ...))).
export const record = (d, fn) => (isOff(d) ? d : { ...d, rhythm: fn(rhythmOf(d), d) })
// The record of a finished task: what was estimated (1h when there was no estimate, which is what the planner assumed), what it took, what Desker had reserved.
export function outcomeFor(t, d, actual, src, at = Date.now()) {
  const est = t.hours > 0 ? t.hours : 1
  const pl = plannerOf(d)
  const pred = t.block > 0 && t.blockOf === t.hours ? t.block / 60 : pl ? est * pl.scale(t) : undefined
  return { task: t.id, at, type: typeOf(t), est, actual: Math.round(actual * 1000) / 1000, src, ...(pred && { pred: Math.round(pred * 100) / 100 }) }
}
export const withPrefs = (r, p) => ({ ...r, prefs: { ...r.prefs, ...p } })
export const resetRhythm = (r) => ({ outcomes: [], sessions: [], signals: [], archive: {}, prefs: r.prefs })

// What the model is allowed to see: nothing when learning is off, and nothing from excluded periods.
function visible(data) {
  const r = rhythmOf(data)
  if (r.prefs.off) return { ...r, outcomes: [], sessions: [], signals: [], archive: {}, energy: [], tasks: [] }
  const ok = (ms) => !isExcluded(r.prefs, ms)
  return {
    ...r, outcomes: r.outcomes.filter((o) => ok(o.at)), sessions: r.sessions.filter((s) => ok(s.start)), signals: r.signals.filter((s) => ok(s.at)),
    energy: (data.energyLog || []).filter((e) => ok(e.at)), tasks: (data.tasks || []).filter((t) => t.done && t.doneAt && !t.fun && ok(t.doneAt)),
  }
}

// ---- duration multiplier ------------------------------------------------------------------------------------
export const K = 3 // the prior counts as this many samples
const clampM = (m) => Math.round(Math.min(3, Math.max(0.6, m)) * 100) / 100
// (prior * K + sum of actual/estimate over valid samples) / (K + n)
const shrink = (prior, n, ratios) => (prior * K + ratios) / (K + n)

export function durationModel(outcomes = [], archive = {}, prior = PRIOR_MULT) {
  const sums = {} // type -> { n, ratios } (the archive keeps sum act / sum est, so it counts as n samples at that ratio)
  for (const [type, a] of Object.entries(archive)) sums[type] = { n: a.n, ratios: a.est > 0 ? (a.n * a.act) / a.est : 0 }
  for (const o of outcomes) {
    if (!usable(o)) continue
    const s = (sums[o.type] ||= { n: 0, ratios: 0 })
    s.n++; s.ratios += o.actual / o.est
  }
  const all = Object.values(sums).reduce((a, s) => ({ n: a.n + s.n, ratios: a.ratios + s.ratios }), { n: 0, ratios: 0 })
  const overall = shrink(prior, all.n, all.ratios)
  const byType = Object.fromEntries(Object.entries(sums).map(([type, s]) => [type, { n: s.n, mult: clampM(shrink(prior, s.n, s.ratios)), raw: s.n ? Math.round((s.ratios / s.n) * 100) / 100 : null }]))
  return { prior, n: all.n, overall: clampM(overall), byType, multFor: (type) => byType[type]?.mult ?? clampM(prior) }
}

// ---- day-one guess ----------------------------------------------------------------------------------------
// Before anyone has tapped their energy, the Rhythm page still draws a plausible day: a typical student's (sharper mid-morning and in the
// evening, a dip after lunch), or the peak they named at sign-up. It is only ever shown, labelled "starting guess"; planning ignores it.
const TYPICAL = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.8, 1.2, 1.6, 1.6, 1.6, 1.2, 0.9, 0.5, 0.5, 0.9, 1.1, 1.2, 1.5, 1.5, 1.2, 0.8, 0.5]
export function startingGrid(sharpest) {
  if (PEAK[sharpest]) return energyCurve([], [], sharpest).grid
  return Array.from({ length: 7 }, () => [...TYPICAL])
}

// ---- energy curve (hour x weekday) --------------------------------------------------------------------------
const SCORE = { low: 0, medium: 1, high: 2 }
export const MIN_CHECKINS = 8
const PEAK = { Morning: [7, 12], Afternoon: [12, 17], Evening: [17, 21], 'Late night': [21, 26] }
// What someone says about themselves at sign-up is only a prior (weight 1); a handful of check-ins outweighs it.
const priorAt = (sharpest, h) => { const p = PEAK[sharpest]; return p && (h >= p[0] && h < p[1] || h + 24 >= p[0] && h + 24 < p[1]) ? 1.7 : 1 }

export function energyCurve(energy = [], doneTasks = [], sharpest) {
  const pts = energy.filter((e) => e.level in SCORE).map((e) => ({ h: new Date(e.at).getHours(), d: new Date(e.at).getDay(), s: SCORE[e.level], w: 1 }))
  for (const t of doneTasks) pts.push({ h: new Date(t.doneAt).getHours(), d: new Date(t.doneAt).getDay(), s: 1.6, w: 0.3 }) // finishing things is weak evidence of a good hour
  const n = energy.length
  const cell = (h, d) => {
    let sw = 1, sum = priorAt(sharpest, h)
    for (const p of pts) {
      const near = Math.min((p.h - h + 24) % 24, (h - p.h + 24) % 24)
      if (near > 1) continue
      const w = p.w * (near === 0 ? 1 : 0.4) * (p.d === d ? 3 : 1)
      sw += w; sum += p.s * w
    }
    return sum / sw
  }
  const grid = Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => cell(h, d)))
  const level = (v) => (v >= 1.35 ? 'high' : v <= 0.65 ? 'low' : 'medium')
  return {
    n, confident: n >= MIN_CHECKINS, grid,
    at: (date, min) => grid[new Date(`${date}T12:00:00`).getDay()][Math.min(23, Math.floor(min / 60))],
    levelAt: (date, min) => level(grid[new Date(`${date}T12:00:00`).getDay()][Math.min(23, Math.floor(min / 60))]),
    // hours of the day that are usually high / low across the week
    hours: (kind) => Array.from({ length: 24 }, (_, h) => [h, grid.reduce((a, row) => a + row[h], 0) / 7]).filter(([, v]) => (kind === 'high' ? v >= 1.35 : v <= 0.65)).map(([h]) => h),
  }
}

// ---- focus length, start lag --------------------------------------------------------------------------------
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
export function focusLength(sessions = []) {
  const m = sessions.filter((s) => s.active >= 5)
  return m.length >= 3 ? Math.min(60, Math.max(15, Math.round(median(m.map((s) => s.active)) / 5) * 5)) : null
}
export function startLag(sessions = []) {
  const l = sessions.filter((s) => Number.isFinite(s.lag))
  return l.length >= 3 ? Math.round(median(l.map((s) => s.lag))) : null
}

// ---- one profile for the whole app --------------------------------------------------------------------------
export const confidenceOf = (n) => { const c = n / (n + 5); return { score: Math.round(c * 100) / 100, label: n === 0 ? 'Just starting' : c < 0.4 ? 'Early days' : c < 0.6 ? 'Getting to know you' : 'Confident' } }

const slowPriorOf = (data) => ({ Rarely: 1.0, Sometimes: 1.3, 'Almost always': 1.6 })[data?.onboarding?.slow] ?? PRIOR_MULT
// Only the duration part of the profile (cheap): what getTaskTime in taskTime.js needs.
export function timeProfile(data) {
  const v = visible(data)
  return { off: !!v.prefs.off, dur: durationModel(v.outcomes, v.archive, slowPriorOf(data)) }
}

export function profile(data) {
  const v = visible(data)
  const sharpest = data?.onboarding?.sharpest
  const dur = durationModel(v.outcomes, v.archive, slowPriorOf(data))
  const energy = energyCurve(v.energy, v.tasks, sharpest)
  const lag = startLag(v.sessions)
  return { off: !!v.prefs.off, dur, energy, focus: focusLength(v.sessions), lag, confidence: confidenceOf(dur.n), prefs: v.prefs, visible: v }
}

// Hand these to the scheduler. null when learning is off, so planning falls back to the user's own numbers.
export function plannerOf(data) {
  const p = profile(data)
  if (p.off) return null
  const pad = p.lag != null && p.lag >= 10 ? Math.min(30, Math.round(p.lag / 15) * 15) : 0 // you tend to start late: leave slack at the end of the block
  return {
    scale: (t) => p.dur.multFor(typeOf(t)),
    pad,
    energy: p.energy.confident ? { at: p.energy.at, deep: isDeep } : undefined,
    focus: p.focus,
  }
}

// ---- reality check ------------------------------------------------------------------------------------------
// "You planned 5h for today. At your pace that is 7h, and you have 4h free."
export function realityCheck(tasks, planner, date, freeHours) {
  const day = tasks.filter((t) => !t.done && !t.fun && t.when === date)
  if (!planner || !day.length) return null
  const planned = day.reduce((n, t) => n + (t.hours > 0 ? t.hours : 1), 0)
  const real = day.reduce((n, t) => n + (t.hours > 0 ? t.hours : 1) * planner.scale(t), 0)
  const r = (x) => Math.round(x * 4) / 4
  return { planned: r(planned), real: r(real), free: freeHours, over: real > freeHours + 0.25 && real > planned * 1.05 }
}

// ---- weekly accuracy ----------------------------------------------------------------------------------------
const mondayOf = (ms) => { const d = new Date(ms); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dateOf(d.getTime()) }
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
// Per week: on average how many minutes off the user's own estimate was, and Desker's reserved time was. Only valid samples count;
// a week with none has n = 0 and the page says "Not enough timed tasks yet". Minutes, not percentages, so one odd task cannot blow it up.
export function accuracyByWeek(outcomes = [], prefs) {
  const weeks = new Map()
  for (const o of outcomes) { const k = mondayOf(o.at); (weeks.get(k) || weeks.set(k, []).get(k)).push(o) }
  return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, all]) => {
    const list = all.filter((o) => isValidTimingSample(o, prefs)), pl = list.filter((o) => o.pred > 0)
    return {
      week, n: list.length,
      estErr: list.length ? Math.round(mean(list.map((o) => Math.abs(o.est - o.actual))) * 60) : null,
      planErr: pl.length ? Math.round(mean(pl.map((o) => Math.abs(o.pred - o.actual))) * 60) : null,
    }
  })
}

// ---- "This week Desker learned" -----------------------------------------------------------------------------
const hoursText = (hs) => { const out = []; for (const h of hs) { const l = out[out.length - 1]; if (l && l[1] === h) l[1] = h + 1; else out.push([h, h + 1]) } return out.map(([a, b]) => `${a}:00-${b}:00`).join(', ') }
export const rangesText = hoursText
const dayName = (i) => ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][i]

// Compare what the model knew at the start of the week with what it knows now; say only what changed and is backed by data.
export function learnedThisWeek(data, now = Date.now()) {
  const mon = new Date(`${mondayOf(now)}T00:00:00`).getTime()
  const before = { ...data, rhythm: { ...rhythmOf(data), outcomes: rhythmOf(data).outcomes.filter((o) => o.at < mon), sessions: rhythmOf(data).sessions.filter((s) => s.start < mon) },
    energyLog: (data.energyLog || []).filter((e) => e.at < mon), tasks: (data.tasks || []).filter((t) => !t.doneAt || t.doneAt < mon) }
  const a = profile(data), b = profile(before)
  if (a.off) return []
  const out = []
  for (const [type, x] of Object.entries(a.dur.byType)) {
    const was = b.dur.byType[type]
    if (x.n >= 3 && (!was || was.n < 3 || Math.abs(x.mult - was.mult) >= 0.15)) out.push(`${type} takes you about ${x.mult}x what you estimate (from ${x.n} tasks).`)
  }
  if (a.focus && a.focus !== b.focus) out.push(`Your focus sessions usually run about ${a.focus} minutes.`)
  if (a.lag != null && b.lag == null) out.push(a.lag > 5 ? `You usually start about ${a.lag} minutes after the planned time.` : a.lag < -5 ? `You usually start about ${-a.lag} minutes early.` : 'You usually start right on time.')
  if (a.energy.confident && !b.energy.confident) { const hi = a.energy.hours('high'); if (hi.length) out.push(`Your energy is usually high at ${hoursText(hi)}.`) }
  const days = new Map()
  for (const o of a.visible.outcomes) if (o.at >= mon) { const d = new Date(o.at).getDay(); days.set(d, (days.get(d) || 0) + 1) }
  const best = [...days.entries()].sort((x, y) => y[1] - x[1])[0]
  if (best && best[1] >= 3) out.push(`You got the most timed work done on ${dayName(best[0])}.`)
  return out
}

// A short plain-language summary for the AI agent. Empty until there is something real to say.
export function summaryForAI(data) {
  const p = profile(data)
  if (p.off || p.dur.n < 3) return undefined
  const types = Object.entries(p.dur.byType).filter(([, x]) => x.n >= 3).map(([t, x]) => `${t} ${x.mult}x`)
  return [`Tasks take ${p.dur.overall}x the user's estimate overall${types.length ? ` (${types.join(', ')})` : ''}.`,
    p.focus && `Typical focus session: ${p.focus} min.`, p.energy.confident && `High energy hours: ${hoursText(p.energy.hours('high')) || 'unclear'}.`].filter(Boolean).join(' ')
}

// One-off cleanup, safe to run any time: stamps `bad` (the reason) on stored outcomes that may not teach anything, so lists can say so.
// The numbers themselves never depend on the stamp: they are recomputed from the samples on every read.
export function markInvalid(r) {
  let changed = false
  const outcomes = r.outcomes.map((o) => { const bad = invalidReason(o) || undefined; if (bad === o.bad) return o; changed = true; const { bad: _, ...rest } = o; return bad ? { ...rest, bad } : rest })
  return changed ? { ...r, outcomes } : r
}
