import test from 'node:test'
import assert from 'node:assert/strict'
import { finishSession, todaysTasks, courseOf } from '../apps/village/api/village/_session.js'
import { invalidReason } from '../src/rhythm.js'

const NOW = Date.parse('2026-11-01T10:00:00')
const doc = (t = {}) => ({ tasks: [{ id: 7, title: 'DTIP 122 reading ch3', done: false, hours: 1, when: '2026-11-01', ...t }] })
const run = (d, active, done = true) => finishSession(d, { taskId: 7, start: NOW - active * 6e4, end: NOW, active, pauses: 0, done }, NOW)

test('timing validity edges: 4:59, 15%, 6x', () => {
  const o = (est, mins) => ({ est, actual: mins / 60, src: 'timer', at: NOW })
  assert.equal(invalidReason(o(1, 4.98)), 'short') // 4 min 59 s
  assert.equal(invalidReason(o(1, 5)), 'short') // 5 min but under 15% of an hour
  assert.equal(invalidReason(o(0.5, 5)), null) // 5 min and 16.7% of 30 min
  assert.equal(invalidReason(o(1, 8.99)), 'short') // just under 15% of 60 min
  assert.equal(invalidReason(o(1, 9.01)), null)
  assert.equal(invalidReason(o(0.5, 180)), null) // exactly 6x
  assert.equal(invalidReason(o(0.5, 181)), 'wild')
})

test('Done writes one rhythm session, the spent hours, doneAt and one outcome', () => {
  const { doc: d, reason } = run(doc(), 50)
  assert.equal(d.rhythm.sessions.length, 1)
  assert.equal(d.rhythm.sessions[0].result, 'finished')
  assert.equal(d.rhythm.outcomes.length, 1)
  assert.equal(d.tasks[0].done, true); assert.equal(d.tasks[0].doneAt, NOW); assert.equal(d.tasks[0].spent, 0.833)
  assert.equal(reason, null)
})

test('a short Done is recorded but flagged, so it does not teach the pace', () => {
  assert.equal(run(doc(), 3).reason, 'short')
})

test('Stop keeps the task open and logs the time as abandoned', () => {
  const { doc: d } = run(doc(), 20, false)
  assert.equal(d.tasks[0].done, false); assert.equal(d.tasks[0].spent, 0.333)
  assert.equal(d.rhythm.sessions[0].result, 'abandoned'); assert.equal(d.rhythm.outcomes.length, 0)
})

test('learning off: time is logged on the task but nothing reaches rhythm', () => {
  const d = { ...doc(), rhythm: { prefs: { off: true } } }
  const out = run(d, 30).doc
  assert.equal(out.tasks[0].spent, 0.5); assert.equal(out.rhythm.sessions, undefined)
})

test("the picker shows only today's open tasks, with the course parsed", () => {
  const d = { tasks: [...doc().tasks, { id: 8, title: 'x', when: '2026-11-02' }, { id: 9, title: 'y', when: '2026-11-01', done: true }] }
  const l = todaysTasks(d, '2026-11-01')
  assert.deepEqual(l.map((t) => t.id), ['7']); assert.equal(l[0].courseCode, 'DTIP 122'); assert.equal(courseOf({ title: 'no code' }), undefined)
})
