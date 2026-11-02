import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanGroup, minutesLeft, phaseAt, totalMs } from './groupSession.js'

const M = 60_000, S = { startedAt: 1_000_000, focusMin: 50, breakMin: 10, rounds: 3 }
test('settings: whole numbers inside the limits, else null', () => {
  assert.deepEqual(cleanGroup({ focusMin: 25, breakMin: 5, rounds: 4 }), { focusMin: 25, breakMin: 5, rounds: 4 })
  for (const b of [{ focusMin: 9, breakMin: 5, rounds: 1 }, { focusMin: 121, breakMin: 5, rounds: 1 }, { focusMin: 25, breakMin: 0, rounds: 1 }, { focusMin: 25, breakMin: 5, rounds: 7 }, { focusMin: 25.5, breakMin: 5, rounds: 1 }, { focusMin: '25', breakMin: 5, rounds: 1 }, null]) assert.equal(cleanGroup(b), null)
})
test('the timeline is focus, break, focus, break, focus; three 50/10 rounds last 170 minutes', () => {
  assert.equal(totalMs(S), 170 * M)
  const at = (min: number) => phaseAt(S, S.startedAt + min * M)
  assert.deepEqual([at(0).kind, at(0).round], ['focus', 1]); assert.deepEqual([at(49.9).kind, at(49.9).round], ['focus', 1])
  assert.deepEqual([at(50).kind, at(50).round], ['break', 1]); assert.equal(at(50).endsAt, S.startedAt + 60 * M)
  assert.deepEqual([at(60).kind, at(60).round], ['focus', 2]); assert.deepEqual([at(110).kind, at(110).round], ['break', 2])
  assert.deepEqual([at(120).kind, at(120).round], ['focus', 3]); assert.equal(at(169.9).kind, 'focus')
  assert.equal(at(170).kind, 'done'); assert.equal(at(1000).kind, 'done'); assert.equal(at(170).endsAt, S.startedAt + 170 * M)
})
test('before the start counts as the first round; one round has no break', () => {
  assert.equal(phaseAt(S, S.startedAt - 5000).kind, 'focus')
  const one = { ...S, rounds: 1 }; assert.equal(phaseAt(one, one.startedAt + 49 * M).kind, 'focus'); assert.equal(phaseAt(one, one.startedAt + 50 * M).kind, 'done')
})
test('restart recovery: the phase depends only on started_at, so any machine gives the same answer', () => {
  const rebuilt = { startedAt: Date.parse(new Date(S.startedAt).toISOString()), focusMin: 50, breakMin: 10, rounds: 3 } // what a row read back from the database gives
  for (const min of [0, 33, 55, 61, 119, 125, 171]) assert.deepEqual(phaseAt(rebuilt, S.startedAt + min * M), phaseAt(S, S.startedAt + min * M))
})
test('joining mid-round: the timer is what is left of the round, at least one minute', () => {
  const p = phaseAt(S, S.startedAt + 20 * M + 1000); assert.equal(minutesLeft(p, S.startedAt + 20 * M + 1000), 30)
  assert.equal(minutesLeft(p, p.endsAt - 100), 1)
})
