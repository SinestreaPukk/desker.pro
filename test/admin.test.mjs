import test from 'node:test'
import assert from 'node:assert/strict'
import { isAdmin, adminEmails } from '../api/_admin.js'

const env = { ADMIN_EMAILS: ' Me@Uni.edu, other@uni.edu ,' }
const user = (email, emailVerified = true) => ({ email, emailVerified })

test('only a verified account on the ADMIN_EMAILS list is an admin, whatever the letter case', () => {
  assert.deepEqual(adminEmails(env), ['me@uni.edu', 'other@uni.edu'])
  assert.equal(isAdmin(user('ME@uni.edu'), env), true)
  assert.equal(isAdmin(user('other@uni.edu'), env), true)
  assert.equal(isAdmin(user('me@uni.edu', false), env), false) // an unverified address proves nothing
  assert.equal(isAdmin(user('friend@uni.edu'), env), false)
  assert.equal(isAdmin(null, env), false) // signed out
  assert.equal(isAdmin(undefined, env), false)
})

test('nothing configured means nobody is an admin; the old single-address variable still works', () => {
  assert.equal(isAdmin(user('me@uni.edu'), {}), false)
  assert.equal(isAdmin(user('me@uni.edu'), { ADMIN_EMAILS: '' }), false)
  assert.equal(isAdmin(user('me@uni.edu'), { DSB_ADMIN_EMAIL: 'me@uni.edu' }), true)
  assert.equal(isAdmin(user('me@uni.edu'), { ADMIN_EMAILS: 'a@b.c', DSB_ADMIN_EMAIL: 'me@uni.edu' }), false) // the new list wins
})
