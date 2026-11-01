import test from 'node:test'
import assert from 'node:assert/strict'
import { checkHello, countBad, parseClient, MAX_MESSAGE_BYTES } from './logic.ts'
import { signToken } from '@desker/shared/src/token.js'

const S = 'a-test-secret-of-sufficient-length', now = 1_800_000_000_000
const tok = (claims = { sub: 'u1', vid: 'v1', role: 'member' }, at = now) => signToken(claims, S, 600, at)

test('hello: valid token passes', async () => {
  const r = await checkHello({ t: 'hello', v: 1, token: await tok() }, 'v1', S, now + 1000)
  assert.ok(r.ok && r.claims.sub === 'u1')
})
test('hello: wrong signature, wrong village, expired are refused as auth', async () => {
  const t = await tok()
  for (const [token, vid, secret, at] of [[t + 'x', 'v1', S, now], [t, 'other', S, now], [t, 'v1', S, now + 700_000], [t, 'v1', 'x'.repeat(20), now]] as const) {
    const r = await checkHello({ t: 'hello', v: 1, token }, vid, secret, at)
    assert.ok(!r.ok && r.code === 'auth')
  }
})
test('hello: protocol version mismatch gets the refresh message', async () => {
  const r = await checkHello({ t: 'hello', v: 2, token: await tok() }, 'v1', S, now)
  assert.ok(!r.ok && r.code === 'version' && /refresh/i.test(r.message))
})
test('parseClient drops junk, oversized and unknown messages', () => {
  assert.ok(parseClient(JSON.stringify({ t: 'ping', ts: 1 })))
  for (const bad of ['nope', '{"t":"zzz"}', JSON.stringify({ t: 'say', text: 'x'.repeat(121) }), 'x'.repeat(MAX_MESSAGE_BYTES + 1), new ArrayBuffer(4)]) assert.equal(parseClient(bad as string), null)
})
test('countBad disconnects on the 10th bad message in a minute, and the window slides', () => {
  let a = { bad: 0, badAt: 0 }, last
  for (let i = 0; i < 10; i++) { last = countBad(a, now + i); a = last }
  assert.ok(last!.disconnect)
  assert.equal(countBad({ bad: 9, badAt: now }, now + 61_000).disconnect, false)
})
