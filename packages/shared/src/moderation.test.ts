import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanReport, MUTE, muteLeftMin, slowCheck, SLOW_MODE_MS, strike } from './moderation.js'

test('slow mode: one bubble per 30 s, and nothing changes when it is off', () => {
  assert.deepEqual(slowCheck(undefined, 1000, true), { ok: true, waitMs: 0 })
  assert.deepEqual(slowCheck(1000, 1000 + 10_000, true), { ok: false, waitMs: SLOW_MODE_MS - 10_000 })
  assert.equal(slowCheck(1000, 1000 + SLOW_MODE_MS, true).ok, true)
  assert.equal(slowCheck(1000, 1001, false).ok, true)
})
test('five "slow down" hits in a minute mute for ten minutes; spread out they do not', () => {
  let s: number[] = [], r = { strikes: s, muteUntil: null as number | null }
  for (let i = 0; i < 4; i++) { r = strike(r.strikes, 1000 + i * 1000); assert.equal(r.muteUntil, null) }
  r = strike(r.strikes, 5000); assert.equal(r.muteUntil, 5000 + MUTE.durationMs); assert.deepEqual(r.strikes, [])
  r = { strikes: [], muteUntil: null }; for (let i = 0; i < 8; i++) { r = strike(r.strikes, i * 20_000); assert.equal(r.muteUntil, null) } // one every 20 s never adds up
  assert.equal(muteLeftMin(5000 + MUTE.durationMs, 5000), 10); assert.equal(muteLeftMin(5000 + MUTE.durationMs, 5000 + MUTE.durationMs), 0); assert.equal(muteLeftMin(undefined, 1), 0)
})
test('reports: a known reason and person, short note, at most 10 context lines', () => {
  assert.equal(cleanReport({ targetUserId: 'u1', reason: 'rude' }), null); assert.equal(cleanReport({ reason: 'spam' }), null); assert.equal(cleanReport(null), null)
  const ctx = Array.from({ length: 15 }, (_, i) => ({ name: 'A', text: `line ${i}`, at: i, zone: 'library' })).concat([{ name: 'B', text: '  ', at: 1, zone: 'x' }])
  const r = cleanReport({ targetUserId: 'u1', reason: 'harassment', note: 'x'.repeat(900), kind: 'bubble', text: 'bad words', context: ctx })!
  assert.equal(r.lines.length, 10); assert.equal(r.lines.at(-1)!.text, 'line 14'); assert.equal([...r.note].length, 300); assert.equal(r.kind, 'bubble')
  assert.equal(cleanReport({ targetUserId: 'u1', reason: 'other', kind: 'weird' })!.kind, 'person')
})
