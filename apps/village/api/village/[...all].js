// Village API: /api/village/mine, /:slug, /:slug/join, /:slug/me, /:slug/desk. One function (a Vercel project allows 12), same database and login as desker.dev.
// Membership is checked on every call; a banned or non-member gets the same answer as a village that does not exist.
import { userOf } from '../../../../api/_auth.js'
import { limit } from '../../../../api/_rate.js'
import { sql, loadDoc, saveDoc } from '../../../../api/_store.js'
import { finishSession, todaysTasks } from './_session.js'
import { cleanEvent, CLIENT_EVENTS } from './_events.js'
import { buildBoard, courseOf } from '../../../../packages/shared/src/board.js'
import { keyMatches } from '../../../../packages/db/keys.js'
import { signToken } from '../../../../packages/shared/src/token.js'

const MAX_MEMBERS = 50 // = VILLAGE_MAX_MEMBERS in packages/shared/src/constants.ts (plain JS here, no TS build step)
const COLOURS = ['snow', 'sky', 'moss', 'rose', 'amber', 'plum'] // = COLOURS in packages/shared/src/types.ts
const SHARING = ['full', 'basic', 'off']
// ponytail: desks are recognised by the snowy_campus naming (lib-desk-01..24); a second template would read its desk ids from its own map.
const DESK = /^lib-desk-(0[1-9]|1\d|2[0-4])$/
const ev = (villageId, uid, name, props) => sql.query('insert into village_event (village_id, user_id, name, props) values ($1, $2, $3, $4)', [villageId, uid, name, cleanEvent(name, props) ?? {}]).catch(() => {}) // analytics never breaks the request
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
  if (first === 'token' && !second && req.method === 'POST') { // SPEC §3.4: a 10-minute room token, only for a member who is not banned
    if (!(await limit(req, res, { scope: 'village-token', max: 120, id: uid }))) return
    const vid = req.body?.villageId
    if (typeof vid !== 'string' || !/^[0-9a-f-]{36}$/.test(vid)) return res.status(400).json({ error: 'Invalid village' })
    const m = (await sql.query(
      `select m.role, m.desk_spot_id, m.status_sharing, u.name, coalesce(m.settings->>'colour', 'snow') as colour from village_member m join village v on v.id = m.village_id join "user" u on u.id = m.user_id
        where m.village_id = $1 and m.user_id = $2 and m.banned_at is null and v.deleted_at is null`, [vid, uid]))[0]
    if (!m) return no(res)
    await sql.query('update village_member set last_seen_at = now() where village_id = $1 and user_id = $2', [vid, uid]) // "last seen" in the member list: refreshed every time a connection starts or renews
    const token = await signToken({ sub: uid, vid, role: m.role, n: String(m.name).slice(0, 60), c: m.colour, s: m.status_sharing, ...(m.desk_spot_id && { d: m.desk_spot_id }) }, process.env.VILLAGE_ROOM_SECRET, 600)
    return res.json({ token, expiresInS: 600 })
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
    await ev(v.id, uid, 'village_joined', { via: 'link' })
    return res.json({ ok: true, joined: true })
  }

  const v = await memberOf(slug, uid)
  if (!v) return no(res)

  if (!second && req.method === 'GET') {
    await sql.query('update village_member set last_seen_at = now() where village_id = $1 and user_id = $2', [v.id, uid])
    const members = await sql.query(
      `select m.user_id as "userId", u.name, coalesce(m.settings->>'colour', 'snow') as colour, m.role, m.desk_spot_id as "deskSpotId", m.last_seen_at as "lastSeenAt"
         from village_member m join "user" u on u.id = m.user_id where m.village_id = $1 and m.banned_at is null order by m.joined_at`, [v.id])
    return res.json({
      village: { id: v.id, slug: v.slug, name: v.name, courseTags: v.course_tags, libraryAutoFocus: v.settings?.library_auto_focus !== false },
      me: { userId: uid, role: v.role, colour: v.mine?.colour ?? 'snow', statusSharing: v.status_sharing, shareDeadlines: v.share_deadlines, deskSpotId: v.desk_spot_id },
      members,
    })
  }

  if (second === 'desk' && req.method === 'PUT') { // claim a desk (or release with null). One desk per member: claiming a new one frees the old.
    const spot = req.body?.spotId
    if (spot === null) { await sql.query('update village_member set desk_spot_id = null where village_id = $1 and user_id = $2', [v.id, uid]); return res.json({ ok: true, spotId: null }) }
    if (typeof spot !== 'string' || !DESK.test(spot)) return res.status(400).json({ error: 'Invalid desk' })
    try {
      const r = await sql.query(
        `update village_member set desk_spot_id = $3 where village_id = $1 and user_id = $2
           and not exists (select 1 from village_member where village_id = $1 and desk_spot_id = $3 and user_id <> $2) returning desk_spot_id`, [v.id, uid, spot])
      if (!r.length) return res.status(409).json({ error: 'taken' })
    } catch (e) { if (e?.code === '23505') return res.status(409).json({ error: 'taken' }); throw e }
    await ev(v.id, uid, 'desk_claimed', {})
    return res.json({ ok: true, spotId: spot })
  }

  if (second === 'board' && req.method === 'GET') { // Phase 0 Board: deadlines of members who share them, for this village's courses (polled by the client every 5 minutes)
    const rows = await sql.query(
      `select d.user_id as "userId", d.title, d.due_date::text as date, d.due_time as time, d.context
         from deadlines d join village_member m on m.user_id = d.user_id
        where m.village_id = $1 and m.share_deadlines and m.banned_at is null and d.due_date >= current_date - 2 and d.due_date <= current_date + 70`, [v.id])
    // ponytail: Desker stores dates without a time zone; Thai universities are all UTC+7, so due times are read as Bangkok time. Per-user zones if Desker ever has them.
    const items = rows.map((r) => ({ userId: r.userId, title: String(r.title).slice(0, 120), dueAt: Date.parse(`${r.date}T${/^\d\d:\d\d$/.test(r.time ?? '') ? r.time : '23:59'}:00+07:00`), courseCode: courseOf(`${r.title} ${r.context ?? ''}`) }))
    return res.json({ items: buildBoard(items, v.course_tags ?? [], Date.now()) })
  }

  if (second === 'event' && req.method === 'POST') { // what the browser knows: opened, bubble sent, board opened, minutes on leave (also by sendBeacon)
    if (!(await limit(req, res, { scope: 'village-event', max: 600, id: uid }))) return
    const name = req.body?.name
    if (!CLIENT_EVENTS.includes(name)) return res.status(400).json({ error: 'Unknown event' })
    await ev(v.id, uid, name, req.body?.props)
    return res.json({ ok: true })
  }

  if (second === 'tasks' && req.method === 'GET') { // the focus picker: today's open Desker tasks (the client sends its own local date)
    const date = String(req.query?.date ?? new URL(req.url, 'http://x').searchParams.get('date') ?? '')
    if (!/^\d{4}-\d\d-\d\d$/.test(date)) return res.status(400).json({ error: 'Invalid date' })
    return res.json({ tasks: todaysTasks(await loadDoc(uid), date) })
  }

  if (second === 'focus' && req.method === 'POST') { // start / end a focus session. Desker has no server-side running timer, so (like its own Focus screen) the document is written when the sitting ends.
    if (!(await limit(req, res, { scope: 'village-focus', max: 60, id: uid }))) return
    const b = req.body || {}
    if (b.action === 'start') {
      const open = (await sql.query('select id from village_focus_session where village_id = $1 and user_id = $2 and ended_at is null', [v.id, uid])).map((r) => r.id)
      if (open.length) await sql.query('update village_focus_session set ended_at = now() where id = any($1::uuid[])', [open]) // a forgotten timer from an earlier visit is closed, not counted
      const [row] = await sql.query('insert into village_focus_session (village_id, user_id, started_at) values ($1, $2, now()) returning id, started_at as "startedAt"', [v.id, uid])
      await ev(v.id, uid, 'focus_started', { plannedMin: Number(b.plannedMin) })
      return res.json({ ok: true, sessionId: row.id, startedAt: row.startedAt })
    }
    if (b.action === 'end') {
      if (typeof b.sessionId !== 'string' || !/^[0-9a-f-]{36}$/.test(b.sessionId)) return res.status(400).json({ error: 'Invalid session' })
      const row = (await sql.query('select id, started_at, ended_at, desker_session_id from village_focus_session where id = $1 and village_id = $2 and user_id = $3', [b.sessionId, v.id, uid]))[0]
      if (!row) return res.status(404).json({ error: 'No such session' })
      if (row.ended_at) return res.json({ ok: true, again: true, reason: null }) // ending twice writes once
      const start = new Date(row.started_at).getTime(), end = Date.now()
      const active = Math.min(Math.max(0, Math.round(Number(b.activeMin) || 0)), Math.round((end - start) / 6e4), 600) // never more than the clock allows
      const claimed = (await sql.query('update village_focus_session set ended_at = now(), desker_session_id = $2 where id = $1 and ended_at is null returning id', [row.id, String(start)])).length
      if (!claimed) return res.json({ ok: true, again: true, reason: null }) // someone else's request got there first
      let reason = 'no_outcome'
      for (let attempt = 0; attempt < 5; attempt++) { // two saves can land together: the version check makes one look again
        const doc = await loadDoc(uid)
        const r = finishSession(doc, { taskId: b.taskId, start, end, active, pauses: Math.min(99, Number(b.pauses) || 0), done: b.done === true })
        try { await saveDoc(uid, Object.fromEntries(Object.entries(r.doc).filter(([k]) => k !== '_rev')), Number(doc._rev ?? 0)); reason = r.reason; break } catch (e) { if (!e.conflict) throw e }
      }
      await ev(v.id, uid, 'focus_completed', { plannedMin: Number(b.plannedMin), actualMin: active, valid: reason === null })
      return res.json({ ok: true, minutes: active, reason })
    }
    return res.status(400).json({ error: 'Invalid action' })
  }

  if (!second && req.method === 'PATCH') { // village settings, owner only
    if (v.role !== 'owner') return res.status(403).json({ error: 'owner_only' })
    if (typeof req.body?.libraryAutoFocus !== 'boolean') return res.status(400).json({ error: 'Invalid' })
    await sql.query(`update village set settings = settings || jsonb_build_object('library_auto_focus', $2::boolean) where id = $1`, [v.id, req.body.libraryAutoFocus])
    return res.json({ ok: true })
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
