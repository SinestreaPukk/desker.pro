import test from 'node:test'
import assert from 'node:assert/strict'
import { checkSignUp, deriveAccount } from '../src/authForm.js'

const ok = { email: 'a@b.co', password: 'correct horse battery' }

test('email and password are all sign-up needs', () => assert.deepEqual(checkSignUp(ok), {}))
test('each given field is checked', () => {
  const e = checkSignUp({ name: ' ', username: 'a b', email: 'nope', password: 'short', confirm: 'x' })
  assert.deepEqual(Object.keys(e).sort(), ['email', 'name', 'password', 'username'])
})
test('passwords must match when a confirmation is asked, and only once they are long enough', () => {
  assert.equal(checkSignUp({ ...ok, confirm: 'different horse battery' }).confirm, 'The two passwords do not match.')
  assert.equal(checkSignUp({ ...ok, password: 'x', confirm: 'y' }).confirm, undefined)
})
test('name and username come from the email and always satisfy the server rules', () => {
  assert.deepEqual(deriveAccount('Mika.Tanaka@uni.edu'), { name: 'Mika', username: 'mika.tanaka' })
  assert.equal(deriveAccount('mika@x.co', 2).username, 'mika2')
  for (const m of ['a@b.co', '1234@x.co', 'x+tag-é@x.co', `${'a'.repeat(50)}@x.co`, '.@x.co']) for (const n of [0, 7, 123]) assert.match(deriveAccount(m, n).username, /^[a-z0-9_.]{3,30}$/, m)
  assert.equal(deriveAccount('1234@x.co').name, 'Student')
})
