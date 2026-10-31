import test from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL ||= 'postgres://x:x@localhost/x'
const { clean } = await import('../api/_feedback.js')

test('clean: needs a kind and a few words, caps length, honours reply=false', () => {
  assert.equal(clean({ kind: 'bug', message: ' ' }), null)
  assert.equal(clean({ kind: 'nope', message: 'hello there' }), null)
  assert.equal(clean({ kind: 'idea', message: 'x'.repeat(5000) }).message.length, 2000)
  assert.equal(clean({ kind: 'bug', message: 'It broke', reply: false }).reply, false)
  assert.equal(clean({ kind: 'bug', message: 'It broke' }).reply, true)
})
