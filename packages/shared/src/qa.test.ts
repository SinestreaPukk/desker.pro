import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanQuestion, cleanAnswer, canResolve, QUESTION_MAX } from './qa.js'

test('question: trimmed, capped at 200, bad words masked, empty refused', () => {
  assert.deepEqual(cleanQuestion({ text: '  what   is a   shit? ' }), { ok: true, text: 'what is a ★★★★?', courseCode: null })
  assert.equal(cleanQuestion({ text: '   ' }).ok, false)
  assert.equal(cleanQuestion({}).ok, false)
  const r = cleanQuestion({ text: 'x'.repeat(300) }); assert.ok(r.ok && [...r.text].length === QUESTION_MAX)
})
test('question: course code is normalised or dropped', () => {
  assert.equal((cleanQuestion({ text: 'q', courseCode: 'dtip 122' }) as any).courseCode, 'DTIP122')
  assert.equal((cleanQuestion({ text: 'q', courseCode: '<b>' }) as any).courseCode, null)
})
test('answer: capped at 500', () => {
  const r = cleanAnswer({ text: 'a'.repeat(900) }); assert.ok(r.ok && [...r.text].length === 500)
  assert.equal(cleanAnswer({ text: '' }).ok, false)
})
test('resolve: asker or admins only', () => {
  assert.ok(canResolve('member', true) && canResolve('admin', false) && canResolve('owner', false))
  assert.ok(!canResolve('member', false) && !canResolve('guest', false))
})
