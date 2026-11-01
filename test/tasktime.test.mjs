import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getMultiplier, getPlannedMinutes, getTaskTime, fmtMin, timeLabel, timeSentence, workLeft, workLeftText, withPlanned } from '../src/taskTime.js'
import { timeProfile, plannerOf, profile, typeOf, PRIOR_MULT } from '../src/rhythm.js'
import { lengthOf } from '../src/schedule.js'
import { risks } from '../src/replan.js'
import { weekReview } from '../src/review.js'

const fresh = timeProfile({}) // day one: nothing learned, the starting guess
const off = timeProfile({ rhythm: { prefs: { off: true } } })
const outcomes = (type, n, est, actual) => Array.from({ length: n }, (_, i) => ({ task: i, at: 1e12 + i, type, est, actual, src: 'tap' }))
const learned = timeProfile({ rhythm: { outcomes: outcomes('Reading', 12, 1, 2) } })
const T = (o) => ({ id: 1, title: 'Read chapter 4', ...o })

test('day one: 1h becomes 1h 30m at the starting guess, and it says so', () => {
  const t = getTaskTime(T({ hours: 1 }), fresh)
  assert.equal(t.userEstimate, 60)
  assert.equal(t.plannedMinutes, 80) // 60 x 1.3 = 78, to the nearest 5 minutes
  assert.equal(t.multiplier, PRIOR_MULT)
  assert.equal(t.adjusted, true)
  assert.equal(t.confidence.guessing, true)
  assert.match(t.reason, /Starting guess/)
  assert.equal(timeLabel(t), '1h → 1h 20m')
  assert.equal(timeSentence(t), 'Your guess 1h → Desker plans 1h 20m (1.3x, still guessing).')
})

test('planned time goes to the nearest 5 minutes, never under 15', () => {
  for (const [hours, planned] of [[0.1, 15], [0.25, 20], [1 / 3, 25], [0.5, 40], [0.75, 60], [2, 155], [3, 235], [1.5, 115]]) {
    const m = getTaskTime(T({ hours }), fresh).plannedMinutes
    assert.equal(m, planned, `${hours}h`)
    assert.equal(m % 5, 0)
  }
})

test('learning off: the user\'s own guess, nothing adjusted', () => {
  const t = getTaskTime(T({ hours: 1 }), off)
  assert.equal(t.plannedMinutes, 60); assert.equal(t.multiplier, 1); assert.equal(t.adjusted, false)
  assert.equal(timeLabel(t), '1h'); assert.equal(timeSentence(t), 'Your guess 1h.')
  assert.equal(getTaskTime(T({ hours: 1 }), null).plannedMinutes, 60) // no rhythm at all behaves the same
  assert.equal(getTaskTime(T({ hours: 0.33 }), off).plannedMinutes, 20)
})

test('enough timings of that kind of work: confident, with a reason that names them', () => {
  const t = getTaskTime(T({ hours: 1 }), learned)
  assert.ok(t.multiplier > 1.7, `got ${t.multiplier}`)
  assert.equal(t.confidence.guessing, false)
  assert.match(t.reason, /12 timings/)
  assert.ok(t.plannedMinutes >= 105 && t.plannedMinutes % 5 === 0)
  const other = getTaskTime({ id: 2, title: 'Email the registrar', hours: 1 }, learned) // a kind of work with no timings falls back to the overall number
  assert.equal(other.confidence.guessing, true)
})

test('no estimate: assumed 1h, said plainly', () => {
  const t = getTaskTime(T({}), fresh)
  assert.equal(t.assumed, true); assert.equal(t.userEstimate, null); assert.equal(t.plannedMinutes, 80)
  assert.equal(timeLabel(t), 'plans 1h 20m')
  assert.equal(timeSentence(t), 'No estimate yet. Desker plans 1h 20m.')
})

test('a block stored on an older task is ignored: the planned time is always worked out from the current model', () => {
  const t = getTaskTime(T({ hours: 1, block: 120, blockOf: 1 }), fresh)
  assert.equal(t.plannedMinutes, 80); assert.equal(t.multiplier, PRIOR_MULT)
})

test('the buffer for starting late is shown next to the planned time, not hidden in it', () => {
  const lag = timeProfile({ rhythm: { sessions: [30, 30, 30].map((l, i) => ({ start: 1e12 + i, end: 1e12 + i, active: 25, lag: l })) } })
  const t = getTaskTime(T({ hours: 1 }), lag)
  assert.equal(t.bufferMinutes, 30); assert.equal(t.plannedMinutes, 80); assert.equal(t.slotMinutes, 110)
  assert.match(timeSentence(t), /1h 20m \(1\.3x, still guessing\) \+ 30 min buffer\./)
})

test('the multiplier a task shows is the one Rhythm shows, on every page', () => {
  const data = { rhythm: { outcomes: [...outcomes('Reading', 4, 1, 1.5), ...outcomes('Problem set', 1, 1, 1)] } }
  const tp = timeProfile(data), p = profile(data)
  for (const t of [{ id: 1, title: 'Review notes for quiz', hours: 1 }, { id: 2, title: 'Work practice problems', hours: 2 }, T({ hours: 1 }), T({ hours: 3 })]) {
    const shown = getTaskTime(t, tp).multiplier // Today, Tasks, Calendar, Deadlines, Projects all print this
    assert.equal(shown, getMultiplier(t, tp))
    assert.equal(shown, p.dur.multFor(typeOf(t))) // Rhythm's table
    assert.equal(shown, plannerOf(data).scale(t)) // the planner and the AI prompt
    assert.equal(getPlannedMinutes(t, tp), lengthOf(t, shown))
  }
  assert.equal(getTaskTime(T({ hours: 1 }), tp).confidence.guessing, false)
  assert.equal(getTaskTime({ id: 2, title: 'Work practice problems', hours: 1 }, tp).confidence.guessing, true) // 1 timing: still guessing everywhere
})

test('one function: it agrees with what the scheduler reserves', () => {
  for (const data of [{}, { rhythm: { outcomes: outcomes('Reading', 12, 1, 2) } }, { onboarding: { slow: 'Almost always' } }, { rhythm: { prefs: { off: true } } }]) {
    const rhythm = timeProfile(data), planner = plannerOf(data)
    for (const t of [T({ hours: 1 }), T({ hours: 0.5 }), T({ hours: 2.5 }), { id: 3, title: 'Write essay', hours: 1.25 }, T({})]) {
      assert.equal(getTaskTime(t, rhythm).plannedMinutes, lengthOf(t, planner ? planner.scale : 1))
    }
  }
})

test('the sign-up answer about being slow is the starting guess', () => {
  assert.equal(getTaskTime(T({ hours: 1 }), timeProfile({ onboarding: { slow: 'Rarely' } })).plannedMinutes, 60)
  assert.equal(getTaskTime(T({ hours: 1 }), timeProfile({ onboarding: { slow: 'Almost always' } })).plannedMinutes, 95) // 60 x 1.6 = 96, to the nearest 5
})

test('time is written one way', () => {
  assert.deepEqual([0, 15, 45, 60, 75, 90, 120, 135].map(fmtMin), ['0 min', '15 min', '45 min', '1h', '1h 15m', '1h 30m', '2h', '2h 15m'])
})

test('work left: planned time minus what was already focused, with the user\'s guesses beside it', () => {
  const tasks = [T({ id: 1, hours: 1 }), T({ id: 2, hours: 2, spent: 0.5 }), T({ id: 3, hours: 1, done: true })]
  const w = workLeft(tasks, fresh)
  assert.equal(w.plannedMinutes, 210) // 1h->1h20, 2h->2h35 minus 30 min focused = 205 min, up to the next 15; the done task does not count
  assert.equal(w.guessMinutes, 60 + 90) // 1h, and 2h minus 30 min
  assert.equal(w.differs, true)
  assert.equal(workLeftText(w), '3h 30m of work left (your guesses: 2h 30m)')
  assert.equal(workLeftText(workLeft(tasks, off)), '2h 30m of work left') // nothing to compare when nothing was adjusted
  assert.equal(workLeft([T({ hours: 1, done: true })], fresh).plannedMinutes, 0)
})

test('the other places that use a duration read it from the same function', () => {
  const dl = [{ id: 9, title: 'Quiz', date: '2030-01-10' }]
  const tasks = [T({ id: 1, hours: 4, deadlineId: 9 })]
  const r = risks(tasks, dl, 2, '2030-01-09', fresh) // needs 4h x 1.3 = 5h 15m (planned), 2 free hours a day, 2 days
  assert.match(r[0].why, /needs about 5\.25h/)
  assert.equal(risks(tasks, dl, 2, '2030-01-09', off).length, 0) // on the user's own 4h it fits in 4h of free time
  const mon = new Date('2026-10-26T12:00:00').getTime()
  const rev = (rhythm) => weekReview([T({ hours: 1, when: '2026-10-27' })], [], mon, rhythm).planned['No goal']
  assert.equal(Math.round(rev(fresh) * 100) / 100, 1.33); assert.equal(rev(off), 1)
  assert.equal(withPlanned([T({ hours: 1 })], fresh)[0].plannedMinutes, 80)
})

// Guard against drift: every place that shows or uses a task's time must go through taskTime.js.
test('every display spot uses getTaskTime, timeLabel or workLeft', () => {
  const spots = ['src/screens/Today.jsx', 'src/components/Row.jsx', 'src/screens/Calendar.jsx', 'src/screens/Deadlines.jsx', 'src/screens/Projects.jsx',
    'src/components/Ritual.jsx', 'src/components/Agent.jsx', 'src/Replan.jsx', 'src/replan.js', 'src/review.js', 'api/_ics.js']
  for (const f of spots) assert.match(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /taskTime\.js/, f)
  assert.doesNotMatch(readFileSync(new URL('../src/screens/Calendar.jsx', import.meta.url), 'utf8'), /lengthOf\(/)
})
