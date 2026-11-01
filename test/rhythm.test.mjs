import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classify, typeOf, durationModel, energyCurve, focusLength, startLag, addOutcome, rhythmOf, profile, plannerOf, realityCheck,
  accuracyByWeek, learnedThisWeek, isExcluded, resetRhythm, withPrefs, summaryForAI, PRIOR_MULT, isValidTimingSample, invalidReason, markInvalid,
} from '../src/rhythm.js'
import { schedule, withSlot, lengthOf, planWeek } from '../src/schedule.js'

const NOW = new Date('2026-10-31T09:00:00') // a Saturday
const out = (type, est, actual, extra = {}) => ({ task: Math.random(), at: NOW.getTime(), type, est, actual, src: 'tap', ...extra })

test('classify guesses the type from the title and a set type wins', () => {
  assert.equal(classify('Read chapter 4'), 'Reading')
  assert.equal(classify('Statics problem set 3'), 'Problem set')
  assert.equal(classify('Write essay draft'), 'Writing')
  assert.equal(classify('Lab 2 report'), 'Lab report')
  assert.equal(classify('Email the registrar'), 'Admin')
  assert.equal(classify('Group meeting'), 'Group work')
  assert.equal(classify('Revise for midterm'), 'Revision')
  assert.equal(classify('Something odd'), 'Other')
  assert.equal(typeOf({ title: 'Read ch 2', type: 'Writing' }), 'Writing')
  assert.equal(typeOf({ title: 'Read ch 2', type: 'nonsense' }), 'Reading')
})

test('with no data the multiplier is the prior; it moves toward the data as samples arrive', () => {
  assert.equal(durationModel([]).overall, PRIOR_MULT)
  const some = durationModel(Array.from({ length: 5 }, () => out('Reading', 1, 2))).byType.Reading // (1.3*3 + 5*2) / 8
  assert.equal(some.mult, 1.74)
  const many = durationModel(Array.from({ length: 50 }, () => out('Reading', 1, 2))).byType.Reading
  assert.ok(many.mult > 1.9, `got ${many.mult}`)
  assert.equal(durationModel([out('Reading', 1, 1)]).byType.Reading.n, 1)
})

test('a type with no data falls back to the overall multiplier, and one wild sample cannot swing it', () => {
  const m = durationModel([...Array.from({ length: 6 }, () => out('Reading', 1, 1.5)), out('Writing', 1, 9)])
  assert.equal(m.multFor('Lab report'), PRIOR_MULT)
  assert.equal(m.byType.Writing, undefined) // 9x the estimate is a forgotten timer: not a sample
  assert.equal(durationModel([out('Reading', 1, 40)]).n, 0) // a forgotten timer is not a sample
})

test('old outcomes beyond the cap are folded into the archive, not forgotten', () => {
  let r = rhythmOf({})
  for (let i = 0; i < 320; i++) r = addOutcome(r, out('Reading', 1, 2, { task: i, at: NOW.getTime() + i * 1e5 }))
  assert.equal(r.outcomes.length, 300)
  assert.equal(r.archive.Reading.n, 20)
  const m = durationModel(r.outcomes, r.archive)
  assert.equal(m.byType.Reading.n, 320)
})

test('the same completion is not recorded twice', () => {
  let r = rhythmOf({})
  r = addOutcome(r, out('Reading', 1, 1, { task: 7 })); r = addOutcome(r, out('Reading', 1, 1.5, { task: 7 }))
  assert.equal(r.outcomes.length, 1)
  assert.equal(r.outcomes[0].actual, 1.5)
})

test('energy curve: prior from the sign-up answer, then check-ins outweigh it', () => {
  const none = energyCurve([], [], 'Morning')
  assert.equal(none.confident, false)
  assert.ok(none.at('2026-11-02', 9 * 60) > none.at('2026-11-02', 15 * 60))
  const log = []
  for (let i = 0; i < 12; i++) log.push({ at: new Date(`2026-10-${10 + i}T21:00:00`).getTime(), level: 'high' }, { at: new Date(`2026-10-${10 + i}T09:00:00`).getTime(), level: 'low' })
  const c = energyCurve(log, [], 'Morning')
  assert.equal(c.confident, true)
  assert.ok(c.at('2026-11-02', 21 * 60) > c.at('2026-11-02', 9 * 60), 'evening highs beat the morning prior')
  assert.equal(c.levelAt('2026-11-02', 21 * 60), 'high')
})

test('typical focus length and start lag need three sessions', () => {
  assert.equal(focusLength([{ active: 30 }, { active: 40 }]), null)
  assert.equal(focusLength([{ active: 28 }, { active: 31 }, { active: 33 }]), 30)
  assert.equal(startLag([{ lag: 10 }, { lag: 20 }]), null)
  assert.equal(startLag([{ lag: 10 }, { lag: 20 }, { lag: 30 }]), 20)
})

test('excluded periods and the off switch hide data from the model; reset clears it', () => {
  const outcomes = Array.from({ length: 6 }, (_, i) => out('Reading', 1, 3, { task: i }))
  const base = { onboarding: { slow: 'Sometimes' }, rhythm: { outcomes, sessions: [] } }
  assert.ok(profile(base).dur.byType.Reading.n === 6)
  const day = NOW.toLocaleDateString('sv')
  const ex = { ...base, rhythm: withPrefs(base.rhythm, { excluded: [{ from: day, to: day }] }) }
  assert.equal(isExcluded(ex.rhythm.prefs, NOW.getTime()), true)
  assert.equal(profile(ex).dur.n, 0)
  const off = { ...base, rhythm: withPrefs(base.rhythm, { off: true }) }
  assert.equal(plannerOf(off), null)
  assert.equal(profile(off).dur.n, 0)
  assert.equal(resetRhythm(rhythmOf(base)).outcomes.length, 0)
})

test('sign-up answer sets the starting multiplier', () => {
  assert.equal(profile({ onboarding: { slow: 'Rarely' } }).dur.overall, 1)
  assert.equal(profile({ onboarding: { slow: 'Almost always' } }).dur.overall, 1.6)
  assert.equal(profile({}).dur.overall, PRIOR_MULT)
})

test('weekly accuracy compares the user estimate with Desker\'s plan', () => {
  const w = accuracyByWeek([out('Reading', 1, 2, { pred: 1.9 }), out('Reading', 1, 2, { pred: 2.1 }), out('Reading', 2, 2, { pred: 2 })])
  assert.equal(w.length, 1)
  assert.equal(w[0].n, 3)
  assert.equal(w[0].estErr, 40) // minutes: (60 + 60 + 0) / 3
  assert.ok(w[0].planErr < w[0].estErr)
})

test('what Desker learned this week only names things that changed', () => {
  const lastWeek = new Date('2026-10-22T10:00:00').getTime()
  const outcomes = [...Array.from({ length: 4 }, (_, i) => out('Reading', 1, 1.5, { task: i, at: lastWeek })), ...Array.from({ length: 4 }, (_, i) => out('Writing', 1, 2, { task: 10 + i, at: NOW.getTime() }))]
  const lines = learnedThisWeek({ rhythm: { outcomes } }, NOW.getTime())
  assert.ok(lines.some((l) => l.startsWith('Writing takes you')), lines.join('|'))
  assert.ok(!lines.some((l) => l.startsWith('Reading')), 'Reading was already known last week')
  assert.deepEqual(learnedThisWeek({}, NOW.getTime()), [])
})

test('reality check compares planned hours with hours at your pace', () => {
  const planner = { scale: () => 1.5 }
  const tasks = [{ id: 1, title: 'a', hours: 2, when: '2026-10-31' }, { id: 2, title: 'b', hours: 2, when: '2026-10-31' }, { id: 3, title: 'c', hours: 1, when: '2026-11-01' }]
  const r = realityCheck(tasks, planner, '2026-10-31', 4)
  assert.deepEqual([r.planned, r.real, r.over], [4, 6, true])
  assert.equal(realityCheck(tasks, planner, '2026-11-01', 4).over, false)
  assert.equal(realityCheck(tasks, null, '2026-10-31', 4), null)
})

test('summary for the AI is empty until there is data and never contains task titles', () => {
  assert.equal(summaryForAI({}), undefined)
  const s = summaryForAI({ rhythm: { outcomes: Array.from({ length: 4 }, (_, i) => out('Reading', 1, 2, { task: i })) } })
  assert.match(s, /Reading/)
})

// ---- scheduler hooks ----
const task = (id, extra = {}) => ({ id, title: `T${id}`, hours: 1, ...extra })

test('the scheduler reserves the learned time and the length is remembered on the task', () => {
  const { plan } = schedule({ tasks: [task(1, { hours: 1 })], freeHours: 4, now: NOW, scale: () => 1.5 })
  assert.equal(plan[0].len, 90)
  const t = withSlot(task(1), plan[0])
  assert.equal(lengthOf(t), 90)
  assert.equal(lengthOf({ ...t, hours: 2 }), 120, 'editing the estimate drops the old reservation')
  assert.equal(withSlot(task(1), { when: '2026-10-31', start: '10:00', len: 60 }).block, undefined)
})

test('blocks that are longer than the estimate still never overlap each other', () => {
  const tasks = [task(1, { hours: 1 }), task(2, { hours: 1 }), task(3, { hours: 1 })]
  const { plan } = schedule({ tasks, freeHours: 6, now: NOW, scale: 1.5 })
  const iv = plan.map((p) => { const [h, m] = p.start.split(':').map(Number); return [p.when, h * 60 + m, h * 60 + m + p.len] }).sort()
  for (let i = 1; i < iv.length; i++) assert.ok(iv[i][0] !== iv[i - 1][0] || iv[i][1] >= iv[i - 1][2])
})

test('free time per day counts the reserved time, so the plan never overbooks the day', () => {
  const tasks = [task(1, { hours: 2 }), task(2, { hours: 2 })]
  const { plan } = schedule({ tasks, freeHours: 4, now: NOW, scale: 1.5 }) // 3h + 3h > 4h: second goes to the next day
  assert.notEqual(plan[0].when, plan[1].when)
})

test('deep work takes the best-energy slot of the day; admin stays early; no energy data changes nothing', () => {
  const energy = { at: (_d, m) => (m >= 14 * 60 && m < 16 * 60 ? 2 : 0.5), deep: (t) => !t.admin }
  const deep = schedule({ tasks: [task(1)], freeHours: 4, now: NOW, energy }).plan[0]
  assert.equal(deep.start, '14:00')
  const light = schedule({ tasks: [task(1, { admin: true })], freeHours: 4, now: NOW, energy }).plan[0]
  assert.equal(light.start, '09:00')
  assert.equal(schedule({ tasks: [task(1)], freeHours: 4, now: NOW }).plan[0].start, '09:00')
})

test('a best-energy slot never breaks a deadline or a calendar event', () => {
  const energy = { at: (_d, m) => (m >= 20 * 60 ? 2 : 0.5), deep: () => true }
  const busy = [{ t: 'Class', s: new Date('2026-10-31T20:00:00').getTime(), e: new Date('2026-10-31T22:00:00').getTime() }]
  const { plan } = schedule({ tasks: [task(1, { due: '2026-10-31' })], busy, freeHours: 4, now: NOW, energy })
  const [h] = plan[0].start.split(':').map(Number)
  assert.ok(h >= 22 || h + 1 <= 20, `got ${plan[0].start}`)
  assert.equal(plan[0].when, '2026-10-31')
})

test('planWeek forwards the planner (scale and padding)', () => {
  const r = planWeek({ tasks: [task(1)], busy: [], deadlines: [], freeHours: 4, now: NOW, scale: () => 1, pad: 15 })
  assert.equal(r.plan[0].len, 75)
})

test('a 4-second completion never affects any number', () => {
  const four = out('Problem set', 1, 4 / 3600, { src: 'timer', pred: 1.5 })
  assert.equal(isValidTimingSample(four), false)
  assert.equal(durationModel([four]).n, 0)
  assert.equal(durationModel([four]).byType['Problem set'], undefined)
  const w = accuracyByWeek([four])
  assert.equal(w[0].n, 0); assert.equal(w[0].estErr, null)
  assert.equal(profile({ rhythm: { outcomes: [four] } }).dur.overall, PRIOR_MULT)
})

test('sample validity: short, under 15%, over 6x, ignored period, checkbox', () => {
  assert.equal(isValidTimingSample(out('Reading', 1, 0.05)), false) // 3 min
  assert.equal(isValidTimingSample(out('Reading', 4, 0.5)), false) // under 15% of the estimate
  assert.equal(isValidTimingSample(out('Reading', 1, 6.5)), false)
  assert.equal(isValidTimingSample(out('Reading', 1, 1, { src: 'done' })), false)
  assert.equal(isValidTimingSample(out('Reading', 1, 1)), true)
  const day = new Date(NOW).toLocaleDateString('sv')
  assert.equal(isValidTimingSample(out('Reading', 1, 1), { excluded: [{ from: day, to: day }] }), false)
  assert.equal(invalidReason(out('Reading', 1, 0.05)), 'short')
})

test('no percentage can blow up: the accuracy is minutes, bounded by the samples', () => {
  const w = accuracyByWeek([out('Reading', 1, 1.2, { pred: 1.5 }), out('Reading', 1, 0.0011, { pred: 1.5 })])
  assert.equal(w[0].n, 1)
  assert.ok(w[0].estErr <= 600 && w[0].planErr <= 600)
})

test('markInvalid stamps stored bad samples and is idempotent', () => {
  const r = { outcomes: [out('Reading', 1, 0.001), out('Reading', 1, 1)], archive: {}, sessions: [], signals: [], prefs: {} }
  const m = markInvalid(r)
  assert.equal(m.outcomes[0].bad, 'short'); assert.equal(m.outcomes[1].bad, undefined)
  assert.equal(markInvalid(m), m)
})
