import test from 'node:test'
import assert from 'node:assert/strict'
import { signToken, verifyToken } from '../packages/shared/src/token.js'

const S = 'a-test-secret-of-sufficient-length', now = 1_800_000_000_000, c = { sub: 'u1', vid: 'v1', role: 'member', n: 'Ann', c: 'moss' }
test('valid token verifies', async () => {
  const r = await verifyToken(await signToken(c, S, 600, now), S, 'v1', now + 1000)
  assert.ok(r.ok); assert.equal(r.claims.sub, 'u1'); assert.equal(r.claims.role, 'member')
})
test('wrong signature, wrong secret, tampered claims are refused', async () => {
  const t = await signToken(c, S, 600, now)
  assert.equal((await verifyToken(t, 'another-secret-of-enough-length', 'v1', now)).reason, 'signature')
  const [h, b, s] = t.split('.'), forged = Buffer.from(JSON.stringify({ ...c, role: 'owner', exp: 9e9 })).toString('base64url')
  assert.equal((await verifyToken(`${h}.${forged}.${s}`, S, 'v1', now)).reason, 'signature')
  assert.equal((await verifyToken(`${h}.${b}.${s.slice(0, -2)}AA`, S, 'v1', now)).ok, false)
})
test('wrong village and expired are refused', async () => {
  const t = await signToken(c, S, 600, now)
  assert.equal((await verifyToken(t, S, 'v2', now)).reason, 'village')
  assert.equal((await verifyToken(t, S, 'v1', now + 601_000)).reason, 'expired')
})
test('garbage and a missing secret are refused; a short secret cannot sign', async () => {
  for (const g of [undefined, '', 'a.b', 'a.b.c', 'x'.repeat(3000), 42]) assert.equal((await verifyToken(g, S, 'v1', now)).ok, false)
  assert.equal((await verifyToken(await signToken(c, S), '', 'v1')).ok, false)
  await assert.rejects(signToken(c, 'short'))
})
