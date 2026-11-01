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

import { findDuplicate, normTitle, parseDue, plannerDeadline, plannerHas } from './board.js'
const man = (userId: string, title: string, dueAt: number, extra: object = {}) => ({ userId, title, dueAt, courseCode: 'DTIP 122', manual: true, itemId: 'i1', createdBy: userId, confirmers: [userId], ...extra })

test('titles normalise: case, punctuation, spaces, and Thai keeps its vowel and tone marks', () => {
  assert.equal(normTitle('  Static   QUIZ!! '), 'static quiz')
  assert.equal(normTitle('สอบ กลางภาค (ครั้งที่ 1)'), 'สอบ กลางภาค ครั้งที่ 1')
  assert.notEqual(normTitle('ไก่'), normTitle('ไข่')); assert.notEqual(normTitle('ปู่'), normTitle('ปุ')) // marks are not stripped
})
test('a manual item shows even far ahead, and an auto row for the same thing merges into it', () => {
  const b = buildBoard([man('a', 'Static quiz', NOW + 20 * D), row('b', 'Static quiz', NOW + 20 * D + H)], ['DTIP 122'], NOW)
  assert.equal(b.length, 1); assert.equal(b[0].itemId, 'i1'); assert.deepEqual(b[0].userIds.sort(), ['a', 'b']); assert.deepEqual(b[0].confirmedBy, ['a'])
  assert.equal(buildBoard([row('b', 'Static report', NOW + 20 * D)], ['DTIP 122'], NOW).length, 0) // auto rows keep the window
})
test('confirmers are counted once, and sharing off only removes the auto people', () => {
  const m = man('a', 'Static quiz', NOW + D, { confirmers: ['a', 'c'] })
  assert.deepEqual(buildBoard([m, row('a', 'Static quiz', NOW + D)], ['DTIP 122'], NOW)[0].userIds, ['a', 'c'])
  assert.deepEqual(buildBoard([m], ['DTIP 122'], NOW)[0].userIds, ['a', 'c']) // b stopped sharing; the confirms stay
})
test('dedupe: same course + title + date within a day is "already there"', () => {
  const e = buildBoard([man('a', 'Static quiz', NOW + 2 * D)], ['DTIP 122'], NOW)
  assert.ok(findDuplicate(e, { courseCode: 'DTIP 122', title: 'static QUIZ.', dueAt: NOW + 2 * D + 20 * H }))
  assert.ok(!findDuplicate(e, { courseCode: 'DTIP 122', title: 'static quiz', dueAt: NOW + 4 * D }))
  assert.ok(!findDuplicate(e, { courseCode: 'ANAT 101', title: 'static quiz', dueAt: NOW + 2 * D }))
})
test('planner: dates are Bangkok time, an existing deadline is not added twice, ids never clash', () => {
  const due = parseDue('2026-11-05', '14:30'); assert.equal(due, Date.parse('2026-11-05T07:30:00Z')); assert.ok(Number.isNaN(parseDue('2026-13', null)))
  const mine = [{ id: 5, title: 'Static Quiz', date: '2026-11-05', time: '14:30' }]
  assert.ok(plannerHas(mine, { title: 'static quiz!', dueAt: due })); assert.ok(!plannerHas(mine, { title: 'Other', dueAt: due }))
  const d = plannerDeadline(mine, { title: 'Report', courseCode: 'DTIP 122', dueAt: parseDue('2026-11-06', '') }, 1)
  assert.deepEqual(d, { id: 6, title: 'Report', date: '2026-11-06', hours: null, context: 'DTIP 122' }) // no time given = no time stored
  assert.equal(plannerDeadline(mine, { title: 'T', courseCode: null, dueAt: due }, 1).time, '14:30')
})
