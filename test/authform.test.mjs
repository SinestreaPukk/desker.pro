import test from 'node:test'
import assert from 'node:assert/strict'
import { checkSignUp } from '../src/authForm.js'

const ok = { name: 'Tiger', username: 'tiger.p_1', email: 'a@b.co', password: 'correct horse battery', confirm: 'correct horse battery' }

test('a complete form has no errors', () => assert.deepEqual(checkSignUp(ok), {}))
test('each field is checked', () => {
  const e = checkSignUp({ name: ' ', username: 'a b', email: 'nope', password: 'short', confirm: 'x' })
  assert.deepEqual(Object.keys(e).sort(), ['email', 'name', 'password', 'username'])
})
test('passwords must match, and only once they are long enough', () => {
  assert.equal(checkSignUp({ ...ok, confirm: 'different horse battery' }).confirm, 'The two passwords do not match.')
  assert.equal(checkSignUp({ ...ok, password: 'x', confirm: 'y' }).confirm, undefined)
})
