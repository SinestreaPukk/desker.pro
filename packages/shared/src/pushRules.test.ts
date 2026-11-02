import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanPrefs, decide, defaultPrefs, isQuiet, localDayStart } from './pushRules.js'

const at = (iso: string) => Date.parse(iso) // Bangkok is UTC+7: 05:00Z is noon there, 17:00Z is midnight
const NOON = at('2026-11-02T05:00:00Z'), MIDNIGHT = at('2026-11-02T17:00:00Z'), TZ = 'Asia/Bangkok', P = defaultPrefs()
test('quiet hours wrap midnight: 23:00 to 08:00 by default, and are editable', () => {
  for (const h of [23, 0, 3, 7]) assert.ok(isQuiet({ from: 23, to: 8 }, h), String(h))
  for (const h of [8, 12, 22]) assert.ok(!isQuiet({ from: 23, to: 8 }, h), String(h))
  assert.ok(isQuiet({ from: 13, to: 15 }, 14) && !isQuiet({ from: 13, to: 15 }, 15)); assert.ok(!isQuiet({ from: 5, to: 5 }, 5))
})
test('nothing is sent in the person\'s own quiet hours, whatever the server clock says', () => {
  assert.deepEqual(decide({ kind: 'answered', prefs: P, now: NOON, tz: TZ }), { send: true })
  assert.deepEqual(decide({ kind: 'answered', prefs: P, now: MIDNIGHT, tz: TZ }), { send: false, why: 'quiet' })
  assert.equal(decide({ kind: 'answered', prefs: P, now: MIDNIGHT, tz: 'Europe/London' }).send, true) // it is 17:00 there
  assert.equal(decide({ kind: 'answered', prefs: P, now: NOON, tz: 'Not/AZone' }).why, 'tz')
  assert.equal(decide({ kind: 'answered', prefs: { ...P, quiet: { from: 12, to: 14 } }, now: NOON, tz: TZ }).why, 'quiet')
})
test('each type has its own switch', () => {
  assert.equal(decide({ kind: 'group', prefs: cleanPrefs({ types: { group: false } }), now: NOON, tz: TZ }).why, 'off')
  assert.equal(decide({ kind: 'answered', prefs: cleanPrefs({ types: { group: false } }), now: NOON, tz: TZ }).send, true)
  assert.equal(decide({ kind: 'knock', prefs: P, now: NOON, tz: TZ }).send, false)
})
test('caps: group 2 a day per village, busy 1 a day and not if you were here, deadline once per item', () => {
  assert.equal(decide({ kind: 'group', prefs: P, now: NOON, tz: TZ, sentToday: 1 }).send, true); assert.equal(decide({ kind: 'group', prefs: P, now: NOON, tz: TZ, sentToday: 2 }).why, 'cap')
  assert.equal(decide({ kind: 'busy', prefs: P, now: NOON, tz: TZ, sentToday: 1 }).why, 'cap'); assert.equal(decide({ kind: 'busy', prefs: P, now: NOON, tz: TZ, openedToday: true }).why, 'opened')
  assert.equal(decide({ kind: 'busy', prefs: P, now: NOON, tz: TZ }).send, true)
  assert.equal(decide({ kind: 'deadline', prefs: P, now: NOON, tz: TZ, already: true }).why, 'already'); assert.equal(decide({ kind: 'deadline', prefs: P, now: NOON, tz: TZ }).send, true)
})
test('prefs from the browser are cleaned', () => {
  assert.deepEqual(cleanPrefs(null), defaultPrefs())
  const c = cleanPrefs({ types: { answered: false, evil: true, group: 'yes' }, quiet: { from: 99, to: 6 }, extra: 1 })
  assert.deepEqual(c, { types: { answered: false, group: true, busy: true, deadline: true }, quiet: { from: 23, to: 6 } })
})
test('local midnight', () => { assert.equal(localDayStart(NOON, TZ), at('2026-11-01T17:00:00Z')) })
