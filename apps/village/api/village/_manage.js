// Village management (Phase 1 CP2): invites, members and roles, transfer, leave, close. Called by [...all].js once it knows who is asking.
// Who may do what is decided only by packages/shared/src/permissions.js (the same table the room uses).
import { randomBytes } from 'node:crypto'
import { sql } from '../../../../api/_store.js'
import { limit } from '../../../../api/_rate.js'
import { signToken } from '../../../../packages/shared/src/token.js'
import { can, canModerate, canSetRole, inviteVerdict } from '../../../../packages/shared/src/permissions.js'
import { MAX_JOINED_VILLAGES } from '../../../../packages/shared/src/create.js'

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alikes (0/o, 1/l/i)
export const newCode = () => Array.from(randomBytes(10), (b) => ALPHABET[b % ALPHABET.length]).join('') // 10 chars; 31^10 is not guessable
const EXPIRY = { '24h': '24 hours', '7d': '7 days', never: null }
const MAX_ACTIVE_INVITES = 20
const UID = /^[\w-]{1,64}$/

/** Tell the room right now (kick, ban, role change, closed village). Without it the change still lands when the 10-minute room token runs out. */
export async function revoke(vid, uid, op = 'remove') {
  const base = process.env.VILLAGE_REALTIME_HTTP ?? process.env.VITE_REALTIME_URL?.replace(/^ws/, 'http')
  if (!base || !process.env.VILLAGE_ROOM_SECRET) return
  try {
    const t = await signToken({ sub: uid, vid, role: 'revoke', op }, process.env.VILLAGE_ROOM_SECRET, 60)
    await fetch(`${base}/room/${vid}/revoke`, { method: 'POST', headers: { authorization: `Bearer ${t}` } })
  } catch { /* best effort */ }
}

const verdictCtx = async (inv, uid, maxMembers) => {
  const [c] = await sql.query(
    `select (select count(*)::int from village_member where village_id = $1 and banned_at is null) as members,
            (select banned_at is not null from village_member where village_id = $1 and user_id = $2) as banned,
            exists(select 1 from village_member where village_id = $1 and user_id = $2 and banned_at is null) as member,
            (select count(*)::int from village_member m join village v on v.id = m.village_id where m.user_id = $2 and m.banned_at is null and v.deleted_at is null) as joined`, [inv.village_id, uid])
  return { now: Date.now(), members: c.members, banned: !!c.banned, member: c.member, joined: c.joined, maxMembers, maxJoined: MAX_JOINED_VILLAGES }
}

/** /api/village/invite/:code (preview) and /invite/:code/accept. Anyone signed in may look; the verdict says whether the link still works for them. */
export async function inviteRoutes({ req, res, uid, code, action, ev, maxMembers, defaultSharing }) {
  if (!/^[a-z0-9]{10}$/.test(code ?? '')) return res.status(404).json({ error: 'not_found' })
  if (!(await limit(req, res, { scope: 'village-invite', max: 60, id: uid }))) return
  const inv = (await sql.query(
    `select i.code, i.village_id, i.expires_at, i.max_uses, i.uses, i.revoked_at, i.as_guest, v.slug, v.name, v.settings, v.deleted_at, u.name as owner
       from village_invite i join village v on v.id = i.village_id join "user" u on u.id = v.owner_id where i.code = $1`, [code]))[0]
  if (!inv) return res.status(404).json({ error: 'not_found' })
  if (inv.deleted_at) return res.json({ verdict: 'closed' })
  const verdict = inviteVerdict(inv, await verdictCtx(inv, uid, maxMembers))
  if (req.method === 'GET' && !action) {
    if (verdict === 'banned') return res.json({ verdict }) // nothing about the village is shown to someone who was banned
    const [n] = await sql.query(`select count(*)::int as members, count(*) filter (where last_seen_at > now() - interval '10 minutes')::int as online from village_member where village_id = $1 and banned_at is null`, [inv.village_id])
    return res.json({ verdict, slug: inv.slug, village: { name: inv.name, owner: inv.owner, members: n.members, online: n.online }, guest: inv.as_guest })
  }
  if (req.method !== 'POST' || action !== 'accept') return res.status(404).json({ error: 'not_found' })
  if (verdict === 'already') return res.json({ ok: true, joined: false, slug: inv.slug })
  if (verdict !== 'ok') return res.status(409).json({ error: verdict })
  // Spend one use first (one statement checks expiry, revoked and the cap, so two people cannot take the last use), then take the seat; give the use back if the village filled up meanwhile.
  const used = await sql.query(
    `update village_invite set uses = uses + 1 where code = $1 and revoked_at is null and (expires_at is null or expires_at > now()) and (max_uses is null or uses < max_uses) returning code`, [code])
  if (!used.length) return res.status(409).json({ error: 'used_up' })
  const ins = await sql.query(
    `insert into village_member (village_id, user_id, role, status_sharing) select $1, $2, $5, $4
      where (select count(*) from village_member where village_id = $1 and banned_at is null) < $3 on conflict do nothing returning user_id`,
    [inv.village_id, uid, maxMembers, defaultSharing(inv.settings), inv.as_guest ? 'guest' : 'member'])
  if (!ins.length) { await sql.query('update village_invite set uses = uses - 1 where code = $1', [code]); return res.status(409).json({ error: 'full' }) }
  await ev(inv.village_id, uid, 'village_joined', { via: 'link' }); await ev(inv.village_id, uid, 'invite_accepted', {})
  return res.json({ ok: true, joined: true, slug: inv.slug, guest: inv.as_guest })
}

/** Routes for a member of a village. Returns true if it handled the request. parts = the path after the slug, e.g. ['members', uid, 'kick']. */
export async function manage({ req, res, uid, v, parts, ev }) {
  const [a, b, c] = parts, who = v.settings?.who_can_invite === 'everyone' ? 'everyone' : 'admins', M = req.method
  const deny = () => (res.status(403).json({ error: 'forbidden' }), true)

  if (a === 'invites') {
    if (!can(v.role, 'invite', who)) return deny()
    const mod = can(v.role, 'moderate')
    if (!b && M === 'GET') {
      const rows = await sql.query(
        `select i.code, i.expires_at as "expiresAt", i.max_uses as "maxUses", i.uses, i.as_guest as "asGuest", i.created_at as "createdAt", u.name as "createdBy"
           from village_invite i join "user" u on u.id = i.created_by
          where i.village_id = $1 and i.revoked_at is null and (i.expires_at is null or i.expires_at > now()) and (i.max_uses is null or i.uses < i.max_uses) and ($3 or i.created_by = $2)
          order by i.created_at desc`, [v.id, uid, mod])
      res.json({ invites: rows }); return true
    }
    if (!b && M === 'POST') {
      if (!(await limit(req, res, { scope: 'village-invite-new', max: 30, id: uid }))) return true
      const exp = req.body?.expiresIn, max = req.body?.maxUses
      if (!(exp in EXPIRY) || ![null, 1, 10, 50].includes(max ?? null)) { res.status(400).json({ error: 'Invalid' }); return true }
      const asGuest = req.body?.asGuest === true
      if (asGuest && !mod) return deny()
      const [n] = await sql.query(`select count(*)::int as n from village_invite where village_id = $1 and revoked_at is null and (expires_at is null or expires_at > now()) and (max_uses is null or uses < max_uses)`, [v.id])
      if (n.n >= MAX_ACTIVE_INVITES) { res.status(409).json({ error: 'too_many_invites' }); return true }
      for (let i = 0; i < 3; i++) {
        const code = newCode()
        try {
          await sql.query(`insert into village_invite (code, village_id, created_by, expires_at, max_uses, as_guest) values ($1, $2, $3, case when $4::text is null then null else now() + $4::interval end, $5, $6)`, [code, v.id, uid, EXPIRY[exp], max ?? null, asGuest])
          await ev(v.id, uid, 'invite_created', {})
          res.json({ code }); return true
        } catch (e) { if (e?.code !== '23505') throw e }
      }
      res.status(500).json({ error: 'Try again' }); return true
    }
    if (b && M === 'DELETE') { // the owner and admins revoke any link; everyone else only their own
      const r = await sql.query(`update village_invite set revoked_at = now() where code = $1 and village_id = $2 and revoked_at is null and ($4 or created_by = $3) returning code`, [b, v.id, uid, mod])
      res.json({ ok: r.length > 0 }); return true
    }
  }

  if (a === 'members') {
    if (!can(v.role, 'moderate')) return deny()
    if (!b && M === 'GET') {
      const rows = await sql.query(
        `select m.user_id as "userId", u.name, m.role, m.joined_at as "joinedAt", m.last_seen_at as "lastSeenAt", m.banned_at is not null as banned
           from village_member m join "user" u on u.id = m.user_id where m.village_id = $1 order by m.banned_at nulls first, m.joined_at`, [v.id])
      res.json({ members: rows }); return true
    }
    if (b && UID.test(b)) {
      const t = (await sql.query('select role, banned_at from village_member where village_id = $1 and user_id = $2', [v.id, b]))[0]
      if (!t || b === uid) { res.status(404).json({ error: 'not_found' }); return true }
      if (!c && M === 'PATCH') {
        const next = req.body?.role
        if (!canSetRole(v.role, t.role, next)) return deny()
        await sql.query('update village_member set role = $3 where village_id = $1 and user_id = $2', [v.id, b, next])
        await revoke(v.id, b, 'refresh'); res.json({ ok: true }); return true
      }
      if (M === 'POST' && (c === 'kick' || c === 'ban' || c === 'unban')) {
        if (!canModerate(v.role, t.role)) return deny()
        if (c === 'kick') await sql.query('delete from village_member where village_id = $1 and user_id = $2', [v.id, b]) // can rejoin with an invite
        else if (c === 'ban') await sql.query('update village_member set banned_at = now(), desk_spot_id = null where village_id = $1 and user_id = $2', [v.id, b])
        else await sql.query('update village_member set banned_at = null where village_id = $1 and user_id = $2', [v.id, b])
        await ev(v.id, uid, `mod_${c}`, {})
        if (c !== 'unban') await revoke(v.id, b)
        res.json({ ok: true }); return true
      }
    }
  }

  if (a === 'transfer' && M === 'POST') {
    if (!can(v.role, 'transfer')) return deny()
    const to = req.body?.userId
    if (typeof to !== 'string' || !UID.test(to) || to === uid) { res.status(400).json({ error: 'Invalid' }); return true }
    if (String(req.body?.confirm ?? '').trim() !== v.name) { res.status(400).json({ error: 'name_mismatch' }); return true }
    const [r] = await sql.query(
      `with t as (update village_member set role = 'owner' where village_id = $1 and user_id = $2 and banned_at is null and role in ('admin', 'member') returning user_id),
            o as (update village_member set role = 'admin' where village_id = $1 and user_id = $3 and exists (select 1 from t) returning user_id),
            w as (update village set owner_id = $2 where id = $1 and exists (select 1 from t) returning id)
       select (select count(*)::int from t) as n`, [v.id, to, uid])
    if (!r.n) { res.status(409).json({ error: 'not_eligible' }); return true }
    await ev(v.id, uid, 'mod_transfer', {}); await revoke(v.id, uid, 'refresh'); await revoke(v.id, to, 'refresh')
    res.json({ ok: true }); return true
  }

  if (a === 'leave' && M === 'POST') {
    if (v.role === 'owner') { res.status(409).json({ error: 'owner_cannot_leave' }); return true }
    await sql.query('delete from village_member where village_id = $1 and user_id = $2', [v.id, uid])
    await revoke(v.id, uid); res.json({ ok: true }); return true
  }
  return false
}

/** Close a village (owner): soft delete, undoable for 7 days. */
export async function closeVillage({ res, uid, v }) {
  if (!can(v.role, 'deleteVillage')) return res.status(403).json({ error: 'forbidden' })
  await sql.query('update village set deleted_at = now() where id = $1', [v.id])
  await revoke(v.id, '*'); return res.json({ ok: true })
}
