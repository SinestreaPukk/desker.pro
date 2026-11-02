// Safety (Phase 1 CP9): block, report, and the moderator's delete tools. /api/village/:slug/blocks[/:uid], /reports[/:id/resolve].
// Who may do what comes from packages/shared/src/permissions.js. A block is never announced to the blocked person.
import { sql } from '../../../../api/_store.js'
import { limit } from '../../../../api/_rate.js'
import { can } from '../../../../packages/shared/src/permissions.js'
import { cleanReport, MAX_BLOCKS } from '../../../../packages/shared/src/moderation.js'
import { notify } from './_qa.js'

const UID = /^[\w-]{1,64}$/
const ID = /^[0-9a-f-]{36}$/
export const blockedBy = async (uid) => (await sql.query('select blocked_id as id from village_block where blocker_id = $1 order by created_at limit $2', [uid, MAX_BLOCKS])).map((r) => r.id)
/** The room keeps each person's block list (their token carries it on connect); this keeps it current without a reconnect. */
const tellRoom = async (v, uid) => notify(v.id, { kind: 'blocks', qid: 'blocks', userId: uid, ids: await blockedBy(uid) })

export async function safety({ req, res, uid, v, parts, ev }) {
  const [a, b, c] = parts
  if (a === 'blocks') {
    if (!b && req.method === 'GET') return res.json({ blocks: await sql.query('select b.blocked_id as "userId", u.name from village_block b join "user" u on u.id = b.blocked_id where b.blocker_id = $1 order by b.created_at', [uid]) }), true
    if (!b && req.method === 'POST') {
      const target = req.body?.userId
      if (typeof target !== 'string' || !UID.test(target) || target === uid) return res.status(400).json({ error: 'Invalid' }), true
      const there = await sql.query('select 1 from village_member where village_id = $1 and user_id = $2', [v.id, target]) // you can only block someone you share this village with
      if (!there.length) return res.status(404).json({ error: 'not_found' }), true
      if ((await blockedBy(uid)).length >= MAX_BLOCKS && !(await blockedBy(uid)).includes(target)) return res.status(409).json({ error: 'too_many_blocks' }), true
      await sql.query('insert into village_block (blocker_id, blocked_id) values ($1, $2) on conflict do nothing', [uid, target])
      await tellRoom(v, uid)
      return res.json({ ok: true }), true
    }
    if (b && UID.test(b) && req.method === 'DELETE') { await sql.query('delete from village_block where blocker_id = $1 and blocked_id = $2', [uid, b]); await tellRoom(v, uid); return res.json({ ok: true }), true }
    return false
  }
  if (a === 'reports') {
    if (!b && req.method === 'POST') { // anyone in the village may report; owner and admins read them
      if (!(await limit(req, res, { scope: 'village-report', max: 10, id: uid }))) return true
      const r = cleanReport(req.body)
      if (!r || r.targetUserId === uid) return res.status(400).json({ error: 'bad_report' }), true
      const there = await sql.query('select 1 from village_member where village_id = $1 and user_id = $2', [v.id, r.targetUserId])
      if (!there.length) return res.status(404).json({ error: 'not_found' }), true
      await sql.query('insert into village_report (village_id, reporter_id, target_user_id, reason, context) values ($1, $2, $3, $4, $5::jsonb)', [v.id, uid, r.targetUserId, r.reason, JSON.stringify({ note: r.note, kind: r.kind, text: r.text, lines: r.lines })])
      await ev(v.id, uid, 'report_filed', { reason: r.reason })
      return res.json({ ok: true }), true
    }
    if (!can(v.role, 'moderate')) return res.status(403).json({ error: 'forbidden' }), true
    if (!b && req.method === 'GET') {
      const rows = await sql.query(
        `select r.id, r.reason, r.context, r.created_at as "createdAt", r.resolved_at as "resolvedAt", r.target_user_id as "targetUserId", t.name as "targetName", p.name as "reporterName"
           from village_report r join "user" t on t.id = r.target_user_id join "user" p on p.id = r.reporter_id
          where r.village_id = $1 order by (r.resolved_at is not null), r.created_at desc limit 50`, [v.id])
      return res.json({ reports: rows }), true
    }
    if (b && ID.test(b) && c === 'resolve' && req.method === 'POST') {
      const r = await sql.query('update village_report set resolved_at = now(), resolved_by = $3 where id = $1 and village_id = $2 and resolved_at is null returning id', [b, v.id, uid])
      if (r.length) await ev(v.id, uid, 'mod_report_resolved', {})
      return res.json({ ok: true }), true
    }
  }
  return false
}
