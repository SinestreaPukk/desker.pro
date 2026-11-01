import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBoard, courseOf, urgency } from './board.js'

const NOW = Date.parse('2026-11-01T10:00:00Z'), H = 3_600_000, D = 24 * H
const row = (userId: string, title: string, dueAt: number, courseCode: string | null = 'DTIP 122') => ({ userId, title, dueAt, courseCode })

test('course codes parse with or without a space', () => { assert.equal(courseOf('DTIP122 report'), 'DTIP 122'); assert.equal(courseOf('read dtip 122'), 'DTIP 122'); assert.equal(courseOf('buy milk'), null) })

test('two members with the same deadline become one item with both people', () => {
  const b = buildBoard([row('a', 'DTIP 122 Report', NOW + 10 * H), row('b', 'dtip 122 report!', NOW + 10 * H + 20 * H)], ['DTIP 122'], NOW)
  assert.equal(b.length, 1); assert.deepEqual(b[0].userIds, ['a', 'b'])
})
test('a different day or title stays separate; the same person counts once', () => {
  const b = buildBoard([row('a', 'Report', NOW + D), row('a', 'Report', NOW + D), row('b', 'Report', NOW + 3 * D), row('b', 'Slides', NOW + D)], ['DTIP 122'], NOW)
  assert.equal(b.length, 3); assert.deepEqual(b[0].userIds, ['a'])
})
test('only the village courses, nothing over a day past, due within a week and exams within 60 days', () => {
  const b = buildBoard([
    row('a', 'Other course', NOW + D, 'ABCD 101'), row('a', 'No course', NOW + D, null), row('a', 'Old', NOW - 2 * D), row('a', 'Just past', NOW - 2 * H),
    row('a', 'Far off', NOW + 8 * D), row('a', 'Midterm exam', NOW + 40 * D), row('a', 'Too far exam', NOW + 70 * D),
  ], ['DTIP122'], NOW)
  assert.deepEqual(b.map((e) => e.title), ['Just past', 'Midterm exam']); assert.equal(b[1].kind, 'exam')
})
test('urgency: red under 24 h, amber under 3 days, else blue', () => {
  assert.equal(urgency(NOW + 23 * H, NOW), 'red'); assert.equal(urgency(NOW + 25 * H, NOW), 'amber'); assert.equal(urgency(NOW + 3 * D, NOW), 'blue'); assert.equal(urgency(NOW - H, NOW), 'red')
})
