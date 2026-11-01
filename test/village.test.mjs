import test from 'node:test'
import assert from 'node:assert/strict'
import { slugify } from '../packages/db/keys.js'

test('slugify: url-safe and unique-ish', () => {
  assert.match(slugify('Med Year 1 Study Den'), /^med-year-1-study-den-[0-9a-f]{4}$/)
  assert.match(slugify('ห้องอ่านหนังสือ'), /^village-[0-9a-f]{4}$/)
})
