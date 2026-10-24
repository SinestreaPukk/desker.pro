import test from 'node:test'
import assert from 'node:assert/strict'
import { METHODS } from '../src/methods.js'
import { addTasks } from '../src/tasks.js'
import { migrate } from '../src/storage.js'

const T = [
  { id: 1, title: 'tax', important: true, urgent: true, hours: 3, happy: 10, due: '2026-11-01' },
  { id: 2, title: 'email', important: false, urgent: true, hours: 0.25, happy: 60 },
  { id: 3, title: 'plan', important: true, urgent: false, hours: 1, happy: 80 },
  { id: 4, title: 'done', important: true, urgent: true, done: true },
]
const pick = (name, o) => METHODS.find((m) => m.name === name).pick(T, o)?.t.title

test('methods pick different tasks and skip done ones', () => {
  assert.equal(pick('Eisenhower'), 'tax')
  assert.equal(pick('Eat the Frog'), 'tax')
  assert.equal(pick('Quick wins'), 'email')
  assert.equal(pick('Fits my energy', { minutes: 120, energy: 'low' }), 'plan')
  assert.equal(pick('Fits my energy', { minutes: 30, energy: 'high' }), 'email')
})
test('methods cope with no tasks', () => METHODS.forEach((m) => assert.equal(m.pick([]), undefined)))
test('addTasks gives unique ids, trims and skips blanks', () => {
  const out = addTasks([{ id: Date.now() + 5 }], [{ title: ' a ' }, { title: '  ' }, { title: 'b' }])
  assert.deepEqual(out.slice(1).map((t) => t.title), ['a', 'b'])
  assert.equal(new Set(out.map((t) => t.id)).size, 3)
})
test('migrate fills missing fields and keeps data', () => {
  const d = migrate({ tasks: [{ id: 1 }] })
  assert.deepEqual([d.goals, d.hobbies, d.deadlines, d.freeHours], [[], [], [], 4])
  assert.equal(migrate({ goals: [], tasks: [], freeHours: 2 }).freeHours, 2)
})
