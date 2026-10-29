import test from 'node:test'
import assert from 'node:assert/strict'
import { progress, unlink } from '../src/projects.js'

test('progress counts only the project\'s own tasks', () => {
  const tasks = [{ id: 1, projectId: 9, done: true }, { id: 2, projectId: 9, hours: 3 }, { id: 3, projectId: 5 }, { id: 4, projectId: 9, fun: true }]
  assert.deepEqual(progress({ id: 9 }, tasks), { total: 2, done: 1, pct: 50, hoursLeft: 3 })
  assert.equal(progress({ id: 7 }, tasks).pct, 0)
})

test('unlink keeps tasks, drops the link', () => {
  const out = unlink([{ id: 1, projectId: 9 }, { id: 2, projectId: 5 }], 9)
  assert.equal(out.length, 2)
  assert.equal(out[0].projectId, undefined)
  assert.equal(out[1].projectId, 5)
})
