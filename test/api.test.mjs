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

test('apply: a planned day counts as the due date when none is given', () => {
  assert.equal(apply([], 'create', 0, { title: 'x', when: '2026-11-03' }, 7).task.due, '2026-11-03')
  assert.equal(apply([], 'create', 0, { title: 'x', when: '2026-11-03', due: '2026-11-09' }, 7).task.due, '2026-11-09')
  const t = { id: 1, title: 'x', due: '2026-11-09' }
  assert.equal(apply([t], 'update', 1, { when: '2026-11-03' }).task.due, '2026-11-09')
})

test('apply: the 50-task limit counts only open tasks, so finished sessions never reach it', () => {
  assert.equal(apply(Array(60).fill({ id: 1, done: true }), 'create', 0, { title: 'x' }, 7).task.id, 7)
})

test('apply: finishing through the API stamps doneAt, as finishing in the app does, and reopening clears it', () => {
  const t = { id: 1, title: 'x' }
  const done = apply([t], 'update', 1, { done: true }, 99).task
  assert.equal(done.doneAt, 99)
  assert.equal(apply([done], 'update', 1, { done: true }, 200).task.doneAt, 99) // already done keeps its time
  assert.equal(apply([done], 'update', 1, { done: false }, 200).task.doneAt, undefined)
  assert.equal(apply([], 'create', 0, { title: 'y', done: true }, 7).task.doneAt, 7)
})
