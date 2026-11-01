import test from 'node:test'
import assert from 'node:assert/strict'
import { emoteVisible, knockResult, EMOTES } from './social.ts'
import { KNOCK_COOLDOWN_MS } from './constants.ts'

const P = (x: number, y: number, zone = 'plaza' as const, table: number | null = null) => ({ x, y, zone, table })
const o = { receiverDnd: false, aimedAtReceiver: false }
test('eight emotes, ids 1 to 8', () => assert.deepEqual(EMOTES.map((e) => e.id), [1, 2, 3, 4, 5, 6, 7, 8]))
test('emotes: within 5 tiles, nothing beyond; the Library is fine because they are silent', () => {
  assert.ok(emoteVisible(P(0, 0), P(3, 4), o)); assert.ok(!emoteVisible(P(0, 0), P(6, 0), o))
  assert.ok(emoteVisible(P(0, 0, 'library'), P(1, 0, 'library'), o))
})
test('emotes: from a table seat only that table sees it', () => {
  assert.ok(emoteVisible(P(0, 0, 'tables', 2), P(1, 0, 'tables', 2), o)); assert.ok(!emoteVisible(P(0, 0, 'tables', 2), P(1, 0, 'tables', 3), o)); assert.ok(!emoteVisible(P(0, 0, 'tables', 2), P(1, 0), o))
})
test('emotes: DND sees nothing, even when aimed at them; an aimed emote reaches from far away', () => {
  assert.ok(!emoteVisible(P(0, 0), P(1, 0), { receiverDnd: true, aimedAtReceiver: true }))
  assert.ok(emoteVisible(P(0, 0), P(30, 0), { receiverDnd: false, aimedAtReceiver: true }))
})
test('knock: delivered, held while focusing, dropped in DND, once per 2 minutes, nobody there', () => {
  const t = { present: true, dnd: false, focusing: false }
  assert.equal(knockResult(t, undefined, 1000), 'deliver')
  assert.equal(knockResult({ ...t, focusing: true }, undefined, 1000), 'queue')
  assert.equal(knockResult({ ...t, dnd: true, focusing: true }, undefined, 1000), 'dnd')
  assert.equal(knockResult(t, 1000, 1000 + KNOCK_COOLDOWN_MS - 1), 'slow'); assert.equal(knockResult(t, 1000, 1000 + KNOCK_COOLDOWN_MS), 'deliver')
  assert.equal(knockResult({ ...t, present: false }, undefined, 1), 'gone')
})
