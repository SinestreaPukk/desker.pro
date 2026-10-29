import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, clean } from '../api/_tasks.js'

test('clean: whitelists and validates', () => {
  assert.deepEqual(clean({ title: ' a ', hours: 2, evil: 1 }), { title: 'a', hours: 2 })
  assert.equal(clean({ due: '26-10-01' }), null)
  assert.equal(clean({ hours: -1 }), null)
  assert.equal(clean({ start: '25:00' }), null)
})

test('apply: create, update, delete, errors', () => {
  let r = apply([], 'create', 0, { title: 'x', urgent: true }, 7)
  assert.deepEqual(r.task, { id: 7, title: 'x', urgent: true })
  assert.equal(apply([], 'create', 0, {}).status, 400)
  r = apply(r.tasks, 'update', 7, { done: true })
  assert.equal(r.task.done, true)
  assert.equal(apply(r.tasks, 'update', 9, {}).status, 404)
  assert.equal(apply(r.tasks, 'delete', 7).tasks.length, 0)
  assert.equal(apply(Array(50).fill({ id: 1 }), 'create', 0, { title: 'x' }).status, 409)
})
