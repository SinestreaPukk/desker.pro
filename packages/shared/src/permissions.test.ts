import test from 'node:test'
import assert from 'node:assert/strict'
import { can, canModerate, canSetRole, inviteVerdict, ACTIONS } from './permissions.js'

// SPEC / phase-1 CP2 matrix, row by row: owner, admin, member, guest
const ROWS: Record<string, [boolean, boolean, boolean, boolean]> = {
  interact: [true, true, true, true], claimDesk: [true, true, true, false], addBoard: [true, true, true, false],
  editAnyBoard: [true, true, false, false], editOwnBoard: [true, true, true, false], announce: [true, true, false, false],
  startGroup: [true, true, true, false], moderate: [true, true, false, false], changeSettings: [true, true, false, false],
  manageAdmins: [true, false, false, false], transfer: [true, false, false, false], deleteVillage: [true, false, false, false],
}
test('every row of the role matrix', () => {
  for (const [action, want] of Object.entries(ROWS)) ['owner', 'admin', 'member', 'guest'].forEach((r, i) => assert.equal(can(r, action), want[i], `${r} ${action}`))
  assert.deepEqual([...ACTIONS].sort(), [...Object.keys(ROWS), 'invite'].sort()) // a new action must get a test row
})
test('invite: owner and admin always, member only if the village allows, guest never', () => {
  assert.deepEqual(['owner', 'admin', 'member', 'guest'].map((r) => can(r, 'invite')), [true, true, false, false])
  assert.deepEqual(['owner', 'admin', 'member', 'guest'].map((r) => can(r, 'invite', 'everyone')), [true, true, true, false])
})
test('unknown roles and actions are refused', () => { assert.equal(can('root', 'interact'), false); assert.equal(can('owner', 'fly'), false); assert.equal(can(undefined as never, 'interact'), false) })
test('kick/ban: must outrank the target; nobody touches the owner', () => {
  assert.ok(canModerate('owner', 'admin') && canModerate('owner', 'member') && canModerate('admin', 'member') && canModerate('admin', 'guest'))
  assert.ok(!canModerate('admin', 'admin') && !canModerate('admin', 'owner') && !canModerate('owner', 'owner') && !canModerate('member', 'guest') && !canModerate('guest', 'member'))
})
test('role changes: only the owner makes or unmakes admins; admins move people between member and guest', () => {
  assert.ok(canSetRole('owner', 'member', 'admin') && canSetRole('owner', 'admin', 'member') && canSetRole('admin', 'member', 'guest') && canSetRole('admin', 'guest', 'member'))
  assert.ok(!canSetRole('admin', 'member', 'admin') && !canSetRole('admin', 'admin', 'member') && !canSetRole('member', 'guest', 'member'))
  assert.ok(!canSetRole('owner', 'owner', 'member') && !canSetRole('owner', 'member', 'owner') && !canSetRole('owner', 'member', 'root'))
})
const NOW = Date.parse('2026-11-01T00:00:00Z'), inv = { revoked_at: null, expires_at: null, max_uses: null, uses: 0 }
const ctx = { now: NOW, members: 3, banned: false, member: false, joined: 1, maxMembers: 50, maxJoined: 20 }
test('invite verdicts: expiry, revoked, max uses, full, banned', () => {
  assert.equal(inviteVerdict(inv, ctx), 'ok')
  assert.equal(inviteVerdict({ ...inv, expires_at: new Date(NOW - 1).toISOString() }, ctx), 'expired')
  assert.equal(inviteVerdict({ ...inv, expires_at: new Date(NOW + 1000).toISOString() }, ctx), 'ok')
  assert.equal(inviteVerdict({ ...inv, revoked_at: new Date(NOW).toISOString() }, ctx), 'revoked')
  assert.equal(inviteVerdict({ ...inv, max_uses: 10, uses: 10 }, ctx), 'used_up')
  assert.equal(inviteVerdict({ ...inv, max_uses: 10, uses: 9 }, ctx), 'ok')
  assert.equal(inviteVerdict(inv, { ...ctx, members: 50 }), 'full')
  assert.equal(inviteVerdict(inv, { ...ctx, joined: 20 }), 'too_many_joined')
})
test('a banned person is refused first; an existing member just goes in, even on a dead link', () => {
  const dead = { ...inv, revoked_at: 'x', max_uses: 1, uses: 1 }
  assert.equal(inviteVerdict(dead, { ...ctx, banned: true, member: true }), 'banned')
  assert.equal(inviteVerdict(dead, { ...ctx, member: true, members: 50 }), 'already')
})

test('canBuild: owner always, admins unless owner-only, members only when everyone, guests never', async () => {
  const { canBuild } = await import('./permissions.js')
  assert.deepEqual(['owner', 'admin', 'member', 'guest'].map((r) => canBuild(r, 'owner')), [true, false, false, false])
  assert.deepEqual(['owner', 'admin', 'member', 'guest'].map((r) => canBuild(r, 'admins')), [true, true, false, false])
  assert.deepEqual(['owner', 'admin', 'member', 'guest'].map((r) => canBuild(r, 'everyone')), [true, true, true, false])
  assert.equal(canBuild('member'), true) // default: everyone
})
