import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitize, EVENTS, track } from '../src/analytics.js'

test('unknown events are dropped', () => {
  assert.equal(sanitize({ name: 'password_typed', props: {} }), null)
  assert.equal(sanitize(null), null)
})

test('properties are numbers, booleans or words from a fixed list; free text cannot get in', () => {
  const e = sanitize({ name: 'task_created', props: { source: 'ai', count: 3.7, title: 'Statics midterm for Prof Smith', note: 'x' }, at: 5 })
  assert.deepEqual(e, { name: 'task_created', props: { source: 'ai', count: 4 }, at: 5 })
  assert.deepEqual(sanitize({ name: 'task_created', props: { source: 'my secret essay' } }).props, {}, 'a word that is not on the list is dropped')
  assert.deepEqual(sanitize({ name: 'task_completed', props: { timed: 'yes' } }).props, {}, 'wrong type is dropped')
  assert.equal(sanitize({ name: 'focus_session_completed', props: { minutes: 1e9 } }).props.minutes, 100000)
})

test('no event in the spec accepts a free-text property', () => {
  for (const [name, spec] of Object.entries(EVENTS)) for (const [k, kind] of Object.entries(spec)) assert.ok(kind === 'bool' || kind === 'int' || Array.isArray(kind), `${name}.${k}`)
})

test('every event the brief asks for exists', () => {
  const need = 'signed_up onboarding_completed syllabus_imported task_created task_completed right_now_started plan_generated agent_message_sent session_started focus_session_completed duration_logged energy_logged morning_plan_opened wrapup_completed kodama_named rhythm_page_viewed notification_opened'.split(' ')
  assert.deepEqual(need.filter((n) => !(n in EVENTS)), [])
})

test('tracking is a no-op outside a browser with analytics on', () => {
  assert.equal(track('session_started', { device: 'phone' }), undefined)
})
