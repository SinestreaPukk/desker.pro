import test from 'node:test'
import assert from 'node:assert/strict'
import { planPush, inQuiet } from '../src/pushPlan.js'

const DAY = '2026-10-31'
const NOW = new Date(`${DAY}T12:00:00`).getTime()
const doc = (extra = {}) => ({ push: { on: true, sub: { endpoint: 'x' } }, tasks: [{ id: 1, title: 'a', hours: 1, when: DAY }], kodama: { name: 'Moss', lastSeen: NOW - 864e5 }, ...extra })

test('quiet hours wrap past midnight', () => {
  assert.equal(inQuiet(23), true); assert.equal(inQuiet(3), true); assert.equal(inQuiet(8), false); assert.equal(inQuiet(12), false)
  assert.equal(inQuiet(13, { from: '13:00', to: '15:00' }), true)
})

test('one morning note and one evening note, in the kodama\'s name, and nothing at other hours', () => {
  const m = planPush(doc(), { day: DAY, hour: 8 }, NOW)
  assert.equal(m.title, 'Moss'); assert.match(m.body, /1 thing is planned/)
  assert.match(planPush(doc(), { day: DAY, hour: 19 }, NOW).body, /How did today go/)
  for (const h of [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23]) assert.equal(planPush(doc(), { day: DAY, hour: h }, NOW), null, `hour ${h}`)
})

test('never when off, without a subscription, in quiet hours, or after a ritual was done', () => {
  assert.equal(planPush(doc({ push: { on: false, sub: {} } }), { day: DAY, hour: 8 }, NOW), null)
  assert.equal(planPush(doc({ push: { on: true } }), { day: DAY, hour: 8 }, NOW), null)
  assert.equal(planPush(doc({ push: { on: true, sub: {}, quiet: { from: '07:00', to: '09:00' } } }), { day: DAY, hour: 8 }, NOW), null)
  assert.equal(planPush(doc({ kodama: { lastSeen: NOW, rituals: { morning: [DAY] } } }), { day: DAY, hour: 8 }, NOW), null)
  assert.equal(planPush(doc({ kodama: { lastSeen: NOW, rituals: { evening: [DAY] } } }), { day: DAY, hour: 19 }, NOW), null)
})

test('someone who has been away 5+ days is left in peace', () => {
  assert.equal(planPush(doc({ kodama: { lastSeen: NOW - 6 * 864e5 } }), { day: DAY, hour: 8 }, NOW), null)
  assert.ok(planPush(doc({ kodama: { lastSeen: NOW - 4 * 864e5 } }), { day: DAY, hour: 8 }, NOW))
})

test('nothing to plan, nothing to say', () => {
  assert.equal(planPush(doc({ tasks: [] }), { day: DAY, hour: 8 }, NOW), null)
})
