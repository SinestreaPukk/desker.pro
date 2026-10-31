import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getTaskTime, fmtMin, timeLabel, timeSentence, workLeft, workLeftText, withPlanned } from '../src/taskTime.js'
import { timeProfile, plannerOf, PRIOR_MULT } from '../src/rhythm.js'
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
  assert.equal(t.plannedMinutes, 90) // 60 x 1.3 = 78, up to the next 15 minutes
  assert.equal(t.multiplier, PRIOR_MULT)
  assert.equal(t.adjusted, true)
  assert.equal(t.confidence.guessing, true)
  assert.match(t.reason, /Starting guess/)
  assert.equal(timeLabel(t), '1h → 1h 30m')
  assert.equal(timeSentence(t), 'Your guess 1h → Desker plans 1h 30m (~1.3x, still guessing).')
})

test('planned time always goes up to the next 15 minutes', () => {
  for (const [hours, planned] of [[0.25, 30], [1 / 3, 30], [0.5, 45], [0.75, 60], [2, 165], [3, 240], [1.5, 120]]) {
    const m = getTaskTime(T({ hours }), fresh).plannedMinutes
    assert.equal(m, planned, `${hours}h`)
    assert.equal(m % 15, 0)
  }
})

test('learning off: the user\'s own guess, nothing adjusted', () => {
  const t = getTaskTime(T({ hours: 1 }), off)
  assert.equal(t.plannedMinutes, 60); assert.equal(t.multiplier, 1); assert.equal(t.adjusted, false)
  assert.equal(timeLabel(t), '1h'); assert.equal(timeSentence(t), 'Your guess 1h.')
  assert.equal(getTaskTime(T({ hours: 1 }), null).plannedMinutes, 60) // no rhythm at all behaves the same
  assert.equal(getTaskTime(T({ hours: 0.33 }), off).plannedMinutes, 30)
})

test('enough timings of that kind of work: confident, with a reason that names them', () => {
  const t = getTaskTime(T({ hours: 1 }), learned)
  assert.ok(t.multiplier > 1.7, `got ${t.multiplier}`)
  assert.equal(t.confidence.guessing, false)
  assert.match(t.reason, /12 timings/)
  assert.ok(t.plannedMinutes >= 105 && t.plannedMinutes % 15 === 0)
  const other = getTaskTime({ id: 2, title: 'Email the registrar', hours: 1 }, learned) // a kind of work with no timings falls back to the overall number
  assert.equal(other.confidence.guessing, true)
})

test('no estimate: assumed 1h, said plainly', () => {
  const t = getTaskTime(T({}), fresh)
  assert.equal(t.assumed, true); assert.equal(t.userEstimate, null); assert.equal(t.plannedMinutes, 90)
  assert.equal(timeLabel(t), 'plans 1h 30m')
  assert.equal(timeSentence(t), 'No estimate yet. Desker plans 1h 30m.')
})

test('a slot Desker reserved on the calendar is the planned time while it is still valid', () => {
  const t = getTaskTime(T({ hours: 1, block: 120, blockOf: 1 }), fresh)
  assert.equal(t.plannedMinutes, 120); assert.equal(t.multiplier, 2)
  assert.equal(getTaskTime(T({ hours: 2, block: 120, blockOf: 1 }), fresh).plannedMinutes, 165) // estimate changed since: the old slot is ignored
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
  assert.equal(getTaskTime(T({ hours: 1 }), timeProfile({ onboarding: { slow: 'Almost always' } })).plannedMinutes, 105) // 60 x 1.6 = 96, up to 105
})

test('time is written one way', () => {
  assert.deepEqual([0, 15, 45, 60, 75, 90, 120, 135].map(fmtMin), ['0 min', '15 min', '45 min', '1h', '1h 15m', '1h 30m', '2h', '2h 15m'])
})

test('work left: planned time minus what was already focused, with the user\'s guesses beside it', () => {
  const tasks = [T({ id: 1, hours: 1 }), T({ id: 2, hours: 2, spent: 0.5 }), T({ id: 3, hours: 1, done: true })]
  const w = workLeft(tasks, fresh)
  assert.equal(w.plannedMinutes, 90 + (165 - 30)) // 1h->1h30, 2h->2h45 minus 30 min focused; the done task does not count
  assert.equal(w.guessMinutes, 60 + 90) // 1h, and 2h minus 30 min
  assert.equal(w.differs, true)
  assert.equal(workLeftText(w), '3h 45m of work left (your guesses: 2h 30m)')
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
  assert.equal(rev(fresh), 1.5); assert.equal(rev(off), 1)
  assert.equal(withPlanned([T({ hours: 1 })], fresh)[0].plannedMinutes, 90)
})

// Guard against drift: every place that shows or uses a task's time must go through taskTime.js.
test('every display spot uses getTaskTime, timeLabel or workLeft', () => {
  const spots = ['src/screens/Today.jsx', 'src/components/Row.jsx', 'src/screens/Calendar.jsx', 'src/screens/Deadlines.jsx', 'src/screens/Projects.jsx',
    'src/components/Ritual.jsx', 'src/components/Agent.jsx', 'src/Replan.jsx', 'src/replan.js', 'src/review.js', 'api/_ics.js']
  for (const f of spots) assert.match(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /taskTime\.js/, f)
  assert.doesNotMatch(readFileSync(new URL('../src/screens/Calendar.jsx', import.meta.url), 'utf8'), /lengthOf\(/)
})
