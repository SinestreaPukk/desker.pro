import test from 'node:test'
import assert from 'node:assert/strict'
import { unlink } from '../src/projects.js'

test('unlink keeps tasks, drops the link', () => {
  const out = unlink([{ id: 1, projectId: 9 }, { id: 2, projectId: 5 }], 9)
  assert.equal(out.length, 2)
  assert.equal(out[0].projectId, undefined)
  assert.equal(out[1].projectId, 5)
})
