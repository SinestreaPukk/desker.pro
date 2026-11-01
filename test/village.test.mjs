import test from 'node:test'
import assert from 'node:assert/strict'
import { newKey, hashKey, keyMatches, slugify } from '../packages/db/keys.js'

test('join key: 24 chars, only the hash matches', () => {
  const k = newKey()
  assert.equal(k.length, 24)
  assert.ok(keyMatches(k, hashKey(k)))
  assert.ok(!keyMatches(k + 'x', hashKey(k)))
  assert.ok(!keyMatches('', hashKey(k)) && !keyMatches(undefined, hashKey(k)) && !keyMatches(k, undefined))
})
test('slugify: url-safe and unique-ish', () => {
  assert.match(slugify('Med Year 1 Study Den'), /^med-year-1-study-den-[0-9a-f]{4}$/)
  assert.match(slugify('ห้องอ่านหนังสือ'), /^village-[0-9a-f]{4}$/)
})
