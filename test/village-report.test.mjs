import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, threeTogether } from '../scripts/village-report.ts'

const T = Date.parse('2026-11-01T10:00:00Z'), M = 60_000
test('three together needs three different members present at the same moment', () => {
  const s = (user, startMin, endMin) => ({ user, from: T + startMin * M, to: T + endMin * M })
  assert.equal(threeTogether([s('a', 0, 30), s('b', 10, 40), s('c', 20, 50)]), true)
  assert.equal(threeTogether([s('a', 0, 30), s('b', 10, 40), s('c', 30, 50)]), false) // c arrives the instant a leaves
  assert.equal(threeTogether([s('a', 0, 30), s('a', 5, 20), s('b', 0, 30)]), false) // two tabs of one person count once
})
test('the report adds up a village-day', () => {
  const ev = (user, name, props, minAfter) => ({ village: 'v1', user, name, props, at: T + minAfter * M })
  const rows = buildReport([
    ev('a', 'village_opened', {}, 0), ev('b', 'village_opened', {}, 1), ev('b', 'bubble_sent', {}, 5), ev('a', 'bubble_sent', {}, 6),
    ev('a', 'session_minutes', { minutes: 30, focusMinutes: 25 }, 30), ev('b', 'session_minutes', { minutes: 20, focusMinutes: 0 }, 21),
  ])
  assert.equal(rows.length, 1)
  assert.deepEqual({ ...rows[0] }, { village: 'v1', day: '2026-11-01', members: 2, sessions: 2, minutesPresent: 50, focusMinutes: 25, bubbles: 2, threeTogether: false })
})
