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

import { buildCohort } from '../scripts/village-report.ts'
test('cohort: size, weekly active (3+ min), the gate, invites and chat-to-focus', () => {
  const D = 86_400_000, t0 = Date.parse('2026-01-05T03:00:00Z'), now = t0 + 40 * D
  const v = [{ id: 'a', slug: 'a', createdAt: t0 }, { id: 'b', slug: 'b', createdAt: t0 + D }]
  const m = ['u1', 'u2', 'u3'].map((u) => ({ village: 'a', user: u, joinedAt: t0 + 1 })).concat([{ village: 'b', user: 'u4', joinedAt: t0 + D }, { village: 'a', user: 'late', joinedAt: t0 + 20 * D }])
  const wk4 = t0 + 22 * D
  const ev = [
    ...['u1', 'u2', 'u3'].map((u) => ({ village: 'a', user: u, name: 'session_minutes', props: { minutes: 30, focusMinutes: 20 }, at: wk4 })),
    { village: 'b', user: 'u4', name: 'session_minutes', props: { minutes: 2, focusMinutes: 0 }, at: wk4 }, // under 3 minutes: not active
    { village: 'a', user: 'u1', name: 'invite_created', props: {}, at: t0 }, { village: 'a', user: 'u2', name: 'invite_accepted', props: {}, at: t0 },
    { village: 'a', user: 'u1', name: 'bubble_sent', props: {}, at: wk4 },
  ]
  const [r] = buildCohort(v, m, ev, [{ village: 'a', user: 'u1', minutes: 60, at: wk4 }], now)
  assert.equal(r.villages, 2); assert.equal(r.size7, 2); assert.equal(r.size28, 2.5) // a has 4 by day 28 (one joined on day 20), b has 1
  assert.equal(r.gate, 50) // village a has 3 active in week 4, b does not
  assert.deepEqual(r.invites, { created: 1, accepted: 1 })
  assert.equal(r.togetherPerActive, 20) // 60 minutes / 3 active in a's week 4
  assert.equal(r.bubblesPerFocusHour, 1) // 1 bubble over 60 focus minutes
})
