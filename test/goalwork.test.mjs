import test from 'node:test'
import assert from 'node:assert/strict'
import { goalHours, goalDay, freeForGoals } from '../src/goalwork.js'
import { dayStr } from '../src/milestones.js'

const today = dayStr(), now = Date.now()
const g = { id: 1 }

test('goalHours: finished tasks count in full, open ones by logged time, other tasks not at all', () => {
  const tasks = [{ id: 1, goalId: 1, hours: 4, done: true }, { id: 2, goalId: 1, hours: 4, spent: 1 }, { id: 3, hours: 9 }, { id: 4, goalId: 1, hours: 9, fun: true }]
  assert.deepEqual(goalHours(g, tasks), { total: 8, put: 5, pct: 63 })
  assert.equal(goalHours(g, []).pct, 0)
})

test('goalDay: null with nothing planned; reached once the planned goal time is put in', () => {
  assert.equal(goalDay({ tasks: [{ id: 1, goalId: 1, hours: 2 }] }), null)
  const open = { id: 1, goalId: 1, hours: 2, when: today }
  assert.equal(goalDay({ tasks: [open] }).reached, false)
  const half = { tasks: [open], rhythm: { sessions: [{ task: 1, start: now, active: 60 }] } }
  assert.equal(goalDay(half).pct, 50)
  assert.equal(goalDay({ tasks: [{ ...open, done: true, doneAt: now }] }).reached, true)
})

test('freeForGoals: needs a goal, a non-goal task finished today and none left open', () => {
  const done = { id: 1, title: 'laundry', done: true, doneAt: now }
  assert.equal(freeForGoals({ goals: [g], tasks: [done] }), true)
  assert.equal(freeForGoals({ goals: [], tasks: [done] }), false)
  assert.equal(freeForGoals({ goals: [g], tasks: [done, { id: 2, title: 'tax' }] }), false)
  assert.equal(freeForGoals({ goals: [g], tasks: [{ id: 2, goalId: 1, title: 'study' }] }), false)
})
