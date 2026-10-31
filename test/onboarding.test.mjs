import test from 'node:test'
import assert from 'node:assert/strict'
import { startFrom } from '../src/onboarding.js'

const NOW = new Date('2026-10-31T09:00:00')
test('a first task without a time gets a slot; one with a time keeps it; a deadline is just saved', () => {
  const a = startFrom({ tasks: [], deadlines: [] }, { at: 1 }, { task: { title: 'Read chapter 4', due: '2026-11-03' } }, NOW)
  assert.equal(a.tasks.length, 1); assert.equal(a.tasks[0].when, '2026-10-31'); assert.match(a.tasks[0].start, /^\d\d:\d\d$/)
  const b = startFrom({ tasks: [], deadlines: [] }, { at: 1 }, { task: { title: 'Call', due: '2026-11-01', when: '2026-11-01', start: '15:00' } }, NOW)
  assert.equal(b.tasks[0].start, '15:00')
  const c = startFrom({ tasks: [], deadlines: [] }, { at: 1 }, { deadline: { id: 7, title: 'Quiz', date: '2026-11-05' } }, NOW)
  assert.deepEqual([c.tasks.length, c.deadlines.length, c.onboarding.at], [0, 1, 1])
  assert.equal(startFrom({ tasks: [], deadlines: [] }, { skipped: true, at: 1 }, undefined, NOW).onboarding.skipped, true)
})
