import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanEvent, CLIENT_EVENTS } from '../apps/village/api/village/_events.js'

test('unknown events are refused and unknown props are dropped, so message text cannot be stored', () => {
  assert.equal(cleanEvent('nope', {}), null)
  assert.deepEqual(cleanEvent('bubble_sent', { zoneId: 'library', length: 42, text: 'secret', extra: 1 }), { zoneId: 'library', length: 42 })
  assert.deepEqual(cleanEvent('bubble_sent', { zoneId: '<script>', length: -3 }), {})
})
test('numbers are rounded and capped, booleans kept', () => {
  assert.deepEqual(cleanEvent('session_minutes', { minutes: 12.6, focusMinutes: 99999 }), { minutes: 13, focusMinutes: 1440 })
  assert.deepEqual(cleanEvent('focus_completed', { plannedMin: 25, actualMin: 24, valid: true }), { plannedMin: 25, actualMin: 24, valid: true })
})
test('a browser may only report the events that are about the browser', () => {
  assert.ok(CLIENT_EVENTS.includes('session_minutes') && !CLIENT_EVENTS.includes('focus_completed') && !CLIENT_EVENTS.includes('desk_claimed'))
})
