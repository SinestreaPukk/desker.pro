import test from 'node:test'
import assert from 'node:assert/strict'
import { addTasks } from '../src/tasks.js'
import { migrate } from '../src/storage.js'

test('addTasks gives unique ids, trims and skips blanks', () => {
  const out = addTasks([{ id: Date.now() + 5 }], [{ title: ' a ' }, { title: '  ' }, { title: 'b' }])
  assert.deepEqual(out.slice(1).map((t) => t.title), ['a', 'b'])
  assert.equal(new Set(out.map((t) => t.id)).size, 3)
})
test('migrate fills missing fields and keeps data', () => {
  const d = migrate({ tasks: [{ id: 1 }] })
  assert.deepEqual([d.goals, d.hobbies, d.deadlines, d.events, d.freeHours], [[], [], [], [], 4])
  assert.equal(migrate({ goals: [], tasks: [], freeHours: 2 }).freeHours, 2)
})
