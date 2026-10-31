import test from 'node:test'
import assert from 'node:assert/strict'
import { xpOf, levelOf, questOf, badgesOf } from '../src/game.js'

test('xp: harder tasks pay more, milestones and the guide add on top', () => {
  assert.equal(xpOf({ tasks: [{ done: true }] }), 10)
  assert.equal(xpOf({ tasks: [{ done: true, important: true, urgent: true, hours: 1 }] }), 22)
  assert.equal(xpOf({ tasks: [{ done: false }, { done: true, fun: true }] }), 5)
  assert.equal(xpOf({ goals: [{ milestones: [{ at: 'x' }, {}] }], guide: { done: true } }), 75)
})
test('levels: 25 XP is level 2, progress is within the level', () => {
  assert.equal(levelOf(0).level, 1)
  assert.deepEqual(levelOf(25), { level: 2, xp: 25, from: 25, to: 100, pct: 0 })
  assert.equal(levelOf(99).level, 2)
  assert.equal(levelOf(100).level, 3)
})
test('quest: counts only today, caps at 3', () => {
  const at = new Date('2026-10-31T10:00:00').getTime()
  const t = (doneAt) => ({ done: true, doneAt })
  assert.deepEqual(questOf([t(at), t(at - 864e5)], '2026-10-31'), { done: 1, goal: 3, complete: false })
  assert.equal(questOf([t(at), t(at), t(at), t(at)], '2026-10-31').complete, true)
})
test('badges: earned from the data', () => {
  const got = (d) => badgesOf(d).filter((b) => b.got).map((b) => b.id)
  assert.deepEqual(got({}), [])
  assert.deepEqual(got({ tasks: [{ done: true, spent: 6 }], guide: { done: true } }).sort(), ['first', 'focus', 'guide'])
})
