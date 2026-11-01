import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanCreate, slugSuggest, tagOf } from './create.js'

const ok = (b: object) => cleanCreate({ name: 'Study Den', slug: 'study-den', ...b })

test('name is 3 to 40 characters after trimming', () => {
  assert.deepEqual(ok({ name: ' ab ' }), { ok: false, error: 'bad_name' })
  assert.deepEqual(ok({ name: 'x'.repeat(41) }), { ok: false, error: 'bad_name' })
  assert.equal(ok({ name: '  Med   Den ' }).ok, true)
  assert.deepEqual(cleanCreate({ slug: 'abc' }), { ok: false, error: 'bad_name' })
})
test('slug: a-z 0-9 hyphens, 3 to 40, no hyphen at the ends or doubled', () => {
  for (const s of ['ab', '-abc', 'abc-', 'a--b', 'Abc d', 'ไทย', 'x'.repeat(41), 5]) assert.deepEqual(ok({ slug: s }), { ok: false, error: 'bad_slug' }, String(s))
  for (const s of ['abc', 'a-b', 'med-1', 'x'.repeat(40)]) assert.equal(ok({ slug: s }).ok, true, s)
})
test('slugSuggest: url-safe, empty for Thai-only names', () => {
  assert.equal(slugSuggest('Med Year 1 Study Den!'), 'med-year-1-study-den')
  assert.equal(slugSuggest('ห้องอ่านหนังสือ'), '')
  assert.ok(slugSuggest('a'.repeat(60)).length <= 40)
})
test('courses: normalised, unique, junk dropped, capped', () => {
  assert.deepEqual(tagOf('dtip 122'), 'DTIP122')
  const r = ok({ courses: ['dtip 122', 'DTIP122', 'x', '<b>', 5, 'ANAT101'] })
  assert.ok(r.ok && JSON.stringify(r.value.courses) === JSON.stringify(['DTIP122', 'ANAT101']))
  assert.ok(ok({ courses: Array.from({ length: 30 }, (_, i) => `AB${100 + i}`) }).ok)
})
test('rules default to admins-invite, library auto-focus on, basic sharing', () => {
  const r = ok({}); assert.ok(r.ok)
  assert.deepEqual(r.ok && r.value.settings, { library_auto_focus: true, who_can_invite: 'admins', default_status_sharing: 'basic' })
  const s = ok({ whoCanInvite: 'everyone', libraryAutoFocus: false, defaultSharing: 'full' })
  assert.deepEqual(s.ok && s.value.settings, { library_auto_focus: false, who_can_invite: 'everyone', default_status_sharing: 'full' })
  assert.deepEqual(ok({ whoCanInvite: 'x', defaultSharing: 'off' }).ok && (ok({ whoCanInvite: 'x', defaultSharing: 'off' }) as any).value.settings.default_status_sharing, 'basic')
})
