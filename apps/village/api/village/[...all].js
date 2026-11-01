// Village API: /api/village/mine, /:slug, /:slug/join, /:slug/me. One function (a Vercel project allows 12), same database and login as desker.dev.
// Membership is checked on every call; a banned or non-member gets the same answer as a village that does not exist.
import { userOf } from '../../../../api/_auth.js'
import { limit } from '../../../../api/_rate.js'
import { sql } from '../../../../api/_store.js'
import { keyMatches } from '../../../../packages/db/keys.js'

const MAX_MEMBERS = 50 // = VILLAGE_MAX_MEMBERS in packages/shared/src/constants.ts (plain JS here, no TS build step)
const COLOURS = ['snow', 'sky', 'moss', 'rose', 'amber', 'plum'] // = COLOURS in packages/shared/src/types.ts
const SHARING = ['full', 'basic', 'off']
const no = (res) => res.status(403).json({ error: 'not_member' })

const memberOf = async (slug, uid) => (await sql.query(
  `select v.id, v.slug, v.name, v.course_tags, v.settings, m.role, m.status_sharing, m.share_deadlines, m.desk_spot_id, m.settings as mine
     from village v join village_member m on m.village_id = v.id
    where v.slug = $1 and v.deleted_at is null and m.user_id = $2 and m.banned_at is null`, [slug, uid]))[0]

export default async function handler(req, res) {
  const uid = await userOf(req)
  if (!uid) return res.status(401).json({ error: 'Sign in first' })
  const [first, second] = new URL(req.url, 'http://x').pathname.replace(/^\/api\/village\/?/, '').split('/').filter(Boolean)

  if (first === 'mine' && !second && req.method === 'GET') {
    const rows = await sql.query(
      `select v.slug, v.name, m.role, (select count(*)::int from village_member where village_id = v.id and banned_at is null) as members
         from village v join village_member m on m.village_id = v.id
        where m.user_id = $1 and m.banned_at is null and v.deleted_at is null order by m.last_seen_at desc`, [uid])
    return res.json({ villages: rows })
  }
  if (!first || first === 'mine') return res.status(404).json({ error: 'Not found' })
  const slug = first.slice(0, 64)

  if (second === 'join' && req.method === 'POST') {
    if (!(await limit(req, res, { scope: 'village-join', max: 20, id: uid }))) return // a key is 24 random chars; this just stops guessing
    const v = (await sql.query('select id, settings from village where slug = $1 and deleted_at is null', [slug]))[0]
    if (!v || !keyMatches(req.body?.key, v.settings?.join_key_hash)) return res.status(403).json({ error: 'bad_key' })
    const mine = (await sql.query('select banned_at from village_member where village_id = $1 and user_id = $2', [v.id, uid]))[0]
    if (mine?.banned_at) return res.status(403).json({ error: 'bad_key' })
    if (mine) return res.json({ ok: true, joined: false })
    // Insert only while there is room, in one statement, so two people joining at once cannot pass the limit.
    const ins = await sql.query(
      `insert into village_member (village_id, user_id) select $1, $2
        where (select count(*) from village_member where village_id = $1 and banned_at is null) < $3 on conflict do nothing returning user_id`, [v.id, uid, MAX_MEMBERS])
    if (!ins.length) return res.status(409).json({ error: 'full' })
    return res.json({ ok: true, joined: true })
  }

  const v = await memberOf(slug, uid)
  if (!v) return no(res)

  if (!second && req.method === 'GET') {
    await sql.query('update village_member set last_seen_at = now() where village_id = $1 and user_id = $2', [v.id, uid])
    const members = await sql.query(
      `select m.user_id as "userId", u.name, coalesce(m.settings->>'colour', 'snow') as colour, m.role
         from village_member m join "user" u on u.id = m.user_id where m.village_id = $1 and m.banned_at is null order by m.joined_at`, [v.id])
    return res.json({
      village: { id: v.id, slug: v.slug, name: v.name, courseTags: v.course_tags, libraryAutoFocus: v.settings?.library_auto_focus !== false },
      me: { userId: uid, role: v.role, colour: v.mine?.colour ?? 'snow', statusSharing: v.status_sharing, shareDeadlines: v.share_deadlines, deskSpotId: v.desk_spot_id },
      members,
    })
  }

  if (second === 'me' && req.method === 'PATCH') {
    const b = req.body || {}, set = [], args = [v.id, uid]
    if (b.colour !== undefined) { if (!COLOURS.includes(b.colour)) return res.status(400).json({ error: 'Invalid colour' }); args.push(b.colour); set.push(`settings = settings || jsonb_build_object('colour', $${args.length}::text)`) }
    if (b.statusSharing !== undefined) { if (!SHARING.includes(b.statusSharing)) return res.status(400).json({ error: 'Invalid status sharing' }); args.push(b.statusSharing); set.push(`status_sharing = $${args.length}`) }
    if (b.shareDeadlines !== undefined) { if (typeof b.shareDeadlines !== 'boolean') return res.status(400).json({ error: 'Invalid' }); args.push(b.shareDeadlines); set.push(`share_deadlines = $${args.length}`) }
    if (!set.length) return res.status(400).json({ error: 'Nothing to change' })
    await sql.query(`update village_member set ${set.join(', ')} where village_id = $1 and user_id = $2`, args)
    return res.json({ ok: true })
  }
  res.status(404).json({ error: 'Not found' })
}
