// Who may do what in a village (Phase 1 CP2 role matrix). One table, used by the API, the room and the screens. Plain JS (no build step in the API) with permissions.d.ts.
export const ROLES = ['owner', 'admin', 'member', 'guest']
const RANK = { owner: 3, admin: 2, member: 1, guest: 0 }
// columns: owner, admin, member, guest. 1 yes, 0 no, 'if' = only when the village allows it (who_can_invite = everyone)
const MATRIX = {
  interact: [1, 1, 1, 1], // walk, sit, bubble, ask, emote
  claimDesk: [1, 1, 1, 0],
  addBoard: [1, 1, 1, 0],
  editAnyBoard: [1, 1, 0, 0],
  editOwnBoard: [1, 1, 1, 0],
  announce: [1, 1, 0, 0],
  invite: [1, 1, 'if', 0],
  startGroup: [1, 1, 1, 0],
  moderate: [1, 1, 0, 0], // remove a bubble, kick, ban
  changeSettings: [1, 1, 0, 0],
  manageAdmins: [1, 0, 0, 0], // promote / demote admins
  transfer: [1, 0, 0, 0],
  deleteVillage: [1, 0, 0, 0],
}
export const ACTIONS = Object.keys(MATRIX)
/** whoCanInvite: 'admins' (default) or 'everyone'. Unknown roles or actions are refused. */
export function can(role, action, whoCanInvite = 'admins') {
  const col = ROLES.indexOf(role), row = MATRIX[action]
  if (col < 0 || !row) return false
  return row[col] === 'if' ? whoCanInvite === 'everyone' : row[col] === 1
}
/** Kick or ban: you must be allowed to moderate and outrank the target (nobody touches the owner; admins cannot touch admins). */
export const canModerate = (actor, target) => can(actor, 'moderate') && RANK[actor] > (RANK[target] ?? 99)
/** Change someone's role to member / guest / admin. Only the owner makes or unmakes admins; the owner's role changes only by transfer. */
export function canSetRole(actor, target, next) {
  if (!['admin', 'member', 'guest'].includes(next) || !(target in RANK) || target === 'owner') return false
  if (target === 'admin' || next === 'admin') return can(actor, 'manageAdmins')
  return canModerate(actor, target)
}

/** What happens when someone opens an invite. inv: { revoked_at, expires_at, max_uses, uses }; ctx: { now, members, banned, member, joined, maxMembers, maxJoined }.
 *  An existing member opening an old link just goes in ('already'); a banned person is refused before anything else. */
export function inviteVerdict(inv, ctx) {
  if (ctx.banned) return 'banned'
  if (ctx.member) return 'already'
  if (inv.revoked_at) return 'revoked'
  if (inv.expires_at && new Date(inv.expires_at).getTime() <= ctx.now) return 'expired'
  if (inv.max_uses != null && inv.uses >= inv.max_uses) return 'used_up'
  if (ctx.members >= ctx.maxMembers) return 'full'
  if (ctx.joined >= ctx.maxJoined) return 'too_many_joined'
  return 'ok'
}
