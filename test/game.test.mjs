import test from 'node:test'
import assert from 'node:assert/strict'
import { totalXp, xpOf, levelOf, questOf, badgesOf } from '../src/game.js'

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
test('total xp never drops below the saved high-water mark', () => {
  assert.equal(totalXp({ xp: 120, tasks: [] }), 120)
  assert.equal(totalXp({ xp: 5, tasks: [{ done: true }] }), 10)
  assert.equal(totalXp({ xp: 'x', tasks: [] }), 0)
})

import { doneStats } from '../src/tasks.js'
import { learned, recap } from '../src/insights.js'
import { sceneChoice } from '../src/game.js'

const at = (d, h = 10) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime()
const doneOn = (...ds) => ds.map((d, i) => ({ id: i, done: true, doneAt: at(d) }))
test('streak: one rest day a week is forgiven, two in a row break it', () => {
  const now = at('2026-10-30', 15) // a Friday
  assert.equal(doneStats(doneOn('2026-10-30', '2026-10-29', '2026-10-28'), now).streak, 3)
  assert.equal(doneStats(doneOn('2026-10-30', '2026-10-28', '2026-10-27'), now).streak, 3, 'Thursday rested, streak lives (the rest day itself is not counted)')
  assert.equal(doneStats(doneOn('2026-10-30', '2026-10-27'), now).streak, 1, 'two missed days in a row break it')
  assert.equal(doneStats(doneOn('2026-10-30', '2026-10-28', '2026-10-26'), now).streak, 2, 'a second rest day in the same week breaks it')
})
test('insights: only says what the data supports', () => {
  assert.deepEqual(learned({ tasks: [] }), [])
  const mornings = Array.from({ length: 6 }, (_, i) => ({ done: true, doneAt: at('2026-10-2' + i, 9) }))
  assert.match(learned({ tasks: mornings })[0], /morning/)
  const r = recap({ tasks: doneOn('2026-10-26', '2026-10-27', '2026-10-20'), goals: [{ milestones: [{ at: '2026-10-27' }, { at: '2026-10-01' }] }] }, at('2026-10-30'))
  assert.deepEqual([r.done, r.last, r.milestones], [2, 1, 1])
})
test('scene choices need the level', () => {
  const low = { scene: { variant: 'night', season: 'winter' }, tasks: [] }
  assert.deepEqual(sceneChoice(low), { variant: undefined, season: undefined })
  assert.deepEqual(sceneChoice({ ...low, xp: 100 }), { variant: 'night', season: 'winter' })
})
