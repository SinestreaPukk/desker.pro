import test from 'node:test'
import assert from 'node:assert/strict'
import { isMissed, timeRatio } from '../src/tasks.js'
import { validPlan, diff, risks, applyPlan } from '../src/replan.js'
import { logEnergy, energyProfile, ranges } from '../src/energy.js'
import { weekReview } from '../src/review.js'
import { validItems, spreadBlocks } from '../src/syllabus.js'

const ms = (s) => new Date(s).getTime()

test('isMissed: past day, passed slot, not yet, done, no day', () => {
  const now = ms('2026-10-26T15:00:00')
  assert.equal(isMissed({ when: '2026-10-25' }, now), true)
  assert.equal(isMissed({ when: '2026-10-26', start: '10:00', hours: 2 }, now), true) // ended 12:00
  assert.equal(isMissed({ when: '2026-10-26', start: '14:00', hours: 2 }, now), false) // still running
  assert.equal(isMissed({ when: '2026-10-26' }, now), false) // today, no time: not missed yet
  assert.equal(isMissed({ when: '2026-10-25', done: true }, now), false)
  assert.equal(isMissed({ due: '2026-10-25' }, now), false)
})

test('timeRatio needs 3 samples and clamps', () => {
  const t = (hours, spent) => ({ done: true, hours, spent })
  assert.equal(timeRatio([t(1, 2), t(1, 2)]), null)
  assert.deepEqual(timeRatio([t(1, 2), t(2, 4), t(1, 2)]), { ratio: 2, n: 3 })
  assert.equal(timeRatio([t(1, 9), t(1, 9), t(1, 9)]).ratio, 3)
})

test('replan: validate, diff, apply, risks', () => {
  const tasks = [
    { id: 1, title: 'a', when: '2026-10-24', due: '2026-10-30' }, { id: 2, title: 'b', when: '2026-10-27', start: '09:00', due: '2026-10-27' },
    { id: 3, title: 'c', due: '2026-10-20' }, { id: 4, title: 'd', done: true }, { id: 5, title: 'e', when: '2026-10-28', deadlineId: 7, hours: 10 },
  ]
  const plan = validPlan([{ id: 1, when: '2026-10-26', start: '10:00' }, { id: 2, when: '2026-10-28', start: 'x' }, { id: 4, when: '2026-10-26' }, { id: 9, when: '2026-10-26' }, { id: 1, when: '2026-10-27' }, { id: 3, when: '2026-10-01' }], tasks, '2026-10-26')
  assert.deepEqual(plan, [{ id: 1, when: '2026-10-26', start: '10:00' }, { id: 2, when: '2026-10-28', start: undefined }])
  const d = diff(tasks, plan)
  assert.deepEqual([d.moved.length, d.pushedBack.map((m) => m.t.id), d.fresh.length], [2, [1, 2], 0])
  const after = applyPlan(tasks, plan)
  assert.equal(after[0].when, '2026-10-26')
  const r = risks(after, [{ id: 7, title: 'quiz', date: '2026-10-28' }], 2, '2026-10-26')
  assert.deepEqual(r.map((x) => x.title), ['b', 'c', 'quiz'])
})

test('energy: dedupe, profile, ranges', () => {
  const at = (h, d = 1) => new Date(2026, 9, d, h, 0).getTime()
  assert.equal(logEnergy([{ at: at(9), level: 'low' }], 'high', at(9) + 60e3).length, 1)
  assert.equal(logEnergy([{ at: at(9), level: 'low' }], 'high', at(9) + 11 * 60e3).length, 2)
  assert.equal(energyProfile([{ at: at(9), level: 'low' }]).enough, false)
  const log = []
  for (const d of [1, 2, 3, 4]) { log.push({ at: at(9, d), level: 'high' }, { at: at(10, d), level: 'high' }, { at: at(15, d), level: 'low' }) }
  const p = energyProfile(log)
  assert.deepEqual([p.enough, p.high, p.low], [true, [9, 10], [15]])
  assert.equal(ranges([9, 10, 11, 15]), '9:00-12:00, 15:00-16:00')
})

test('weekReview splits hours and scores alignment', () => {
  const now = ms('2026-10-28T12:00:00') // Wednesday; week is Oct 26 - Nov 1
  const goals = [{ id: 1, level: 0 }, { id: 2, level: 3 }]
  const tasks = [
    { goalId: 1, when: '2026-10-27', hours: 2 }, { goalId: 2, when: '2026-10-29', hours: 1, done: true, doneAt: ms('2026-10-28T09:00:00'), spent: 1.5 },
    { when: '2026-10-30', hours: 1 }, { fun: true, when: '2026-10-31', hours: 2 }, { goalId: 1, when: '2026-11-02', hours: 5 },
  ]
  const r = weekReview(tasks, goals, now)
  assert.deepEqual([r.planned.Vision, r.planned['Short-term'], r.planned['No goal'], r.planned.Fun], [2, 1, 1, 2])
  assert.equal(r.done['Short-term'], 1.5)
  assert.equal(r.alignment, 75)
  assert.equal(weekReview([], [], now).empty, true)
})

test('syllabus: validate items and spread study blocks backwards', () => {
  const items = validItems([{ title: 'Midterm', date: '2026-11-05', hours: 6 }, { title: 'x', date: 'soon' }, { date: '2026-11-01' }, { title: 'Old', date: '2026-10-01' }], '2026-10-26')
  assert.deepEqual(items.map((i) => [i.title, i.hours, i.past]), [['Midterm', 6, false], ['Old', 4, true]])
  const b = spreadBlocks({ title: 'Midterm', date: '2026-11-05', hours: 6 }, '2026-10-26') // 10 days, 4 blocks
  assert.deepEqual(b.map((x) => x.when), ['2026-10-28', '2026-10-30', '2026-11-02', '2026-11-04'])
  assert.deepEqual([b[0].title, b[3].hours, b.every((x) => x.due === '2026-11-05')], ['Study: Midterm (1/4)', 1.5, true])
  const tight = spreadBlocks({ title: 'T', date: '2026-10-27', hours: 3 }, '2026-10-26')
  assert.equal(tight.every((x) => x.when === '2026-10-26'), true) // never before today
})

import { insight } from '../src/review.js'
test('insight names the biggest finding', () => {
  const z = { Vision: 0, 'Long-term': 0, 'Mid-term': 0, 'Short-term': 0, Fun: 0, 'No goal': 0 }
  assert.equal(insight(z), null)
  assert.equal(insight({ ...z, 'No goal': 3, 'Short-term': 2 }), '60% of your time had no goal')
  assert.equal(insight({ ...z, 'Short-term': 2 }), 'Nothing toward Fun this week')
  assert.equal(insight({ ...z, 'Short-term': 2, Fun: 1 }), 'Most of your time went to Short-term')
})
