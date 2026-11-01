// Village API: /api/village/mine, /:slug, /:slug/join, /:slug/me, /:slug/desk. One function (a Vercel project allows 12), same database and login as desker.dev.
// Membership is checked on every call; a banned or non-member gets the same answer as a village that does not exist.
// Ask Desker who this is instead of verifying its cookie here, so the village needs no copy of Desker's auth secret.
const userOf = async (req) => {
  if (!req.headers.cookie) return null
  const r = await fetch(`${process.env.BETTER_AUTH_URL}/api/auth/get-session`, { headers: { cookie: req.headers.cookie } }).catch(() => null)
  return r?.ok ? ((await r.json().catch(() => null))?.user?.id ?? null) : null
}
import { limit } from '../../../../api/_rate.js'
import { sql, loadDoc, saveDoc } from '../../../../api/_store.js'
import { finishSession, todaysTasks } from './_session.js'
import { cleanEvent, CLIENT_EVENTS } from './_events.js'
import { buildBoard, courseOf } from '../../../../packages/shared/src/board.js'
import { inviteRoutes, manage, closeVillage } from './_manage.js'
import { can } from '../../../../packages/shared/src/permissions.js'
import { signToken } from '../../../../packages/shared/src/token.js'
import { cleanCreate, MAX_OWNED_VILLAGES, MAX_JOINED_VILLAGES } from '../../../../packages/shared/src/create.js'

const MAX_MEMBERS = 50 // = VILLAGE_MAX_MEMBERS in packages/shared/src/constants.ts (plain JS here, no TS build step)
const COLOURS = ['snow', 'sky', 'moss', 'rose', 'amber', 'plum'] // = COLOURS in packages/shared/src/types.ts
const SHARING = ['full', 'basic', 'off']
const defaultSharing = (settings) => (settings?.default_status_sharing === 'full' ? 'full' : 'basic')
// ponytail: desks are recognised by the snowy_campus naming (lib-desk-01..24); a second template would read its desk ids from its own map.
const DESK = /^lib-desk-(0[1-9]|1\d|2[0-4])$/
const ev = (villageId, uid, name, props) => sql.query('insert into village_event (village_id, user_id, name, props) values ($1, $2, $3, $4)', [villageId, uid, name, cleanEvent(name, props) ?? {}]).catch(() => {}) // analytics never breaks the request
// Shared deadlines of members who opted in, for the given villages. ponytail: Desker stores dates without a time zone; Thai universities are all UTC+7, so due times are read as Bangkok time. Per-user zones if Desker ever has them.
const boardRows = async (villageIds) => (await sql.query(
  `select m.village_id as vid, d.user_id as "userId", d.title, d.due_date::text as date, d.due_time as time, d.context
     from deadlines d join village_member m on m.user_id = d.user_id
    where m.village_id = any($1::uuid[]) and m.share_deadlines and m.banned_at is null and d.due_date >= current_date - 2 and d.due_date <= current_date + 70`, [villageIds]))
  .map((r) => ({ vid: r.vid, userId: r.userId, title: String(r.title).slice(0, 120), dueAt: Date.parse(`${r.date}T${/^\d\d:\d\d$/.test(r.time ?? '') ? r.time : '23:59'}:00+07:00`), courseCode: courseOf(`${r.title} ${r.context ?? ''}`) }))
const no = (res) => res.status(403).json({ error: 'not_member' })

const memberOf = async (slug, uid) => (await sql.query(
  `select v.id, v.slug, v.name, v.course_tags, v.settings, m.role, m.status_sharing, m.share_deadlines, m.desk_spot_id, m.settings as mine
     from village v join village_member m on m.village_id = v.id
    where v.slug = $1 and v.deleted_at is null and m.user_id = $2 and m.banned_at is null`, [slug, uid]))[0]

export default async function handler(req, res) {
  const uid = await userOf(req)
  if (!uid) return res.status(401).json({ error: 'Sign in first' })
  const parts = new URL(req.url, 'http://x').pathname.replace(/^\/api\/village\/?/, '').split('/').filter(Boolean)
  const [first, second] = parts

  if (first === 'mine' && !second && req.method === 'GET') {
    const rows = await sql.query(
      `select v.id, v.slug, v.name, v.course_tags, m.role,
              (select count(*)::int from village_member where village_id = v.id and banned_at is null) as members,
              coalesce((select json_agg(coalesce(x.settings->>'colour', 'snow')) from (select settings from village_member where village_id = v.id and banned_at is null and last_seen_at > now() - interval '10 minutes' order by last_seen_at desc limit 8) x), '[]') as dots,
              (select count(distinct user_id)::int from village_focus_session where village_id = v.id and ended_at is null and started_at > now() - interval '3 hours') as studying
         from village v join village_member m on m.village_id = v.id
        where m.user_id = $1 and m.banned_at is null and v.deleted_at is null order by m.last_seen_at desc`, [uid])
    const byVillage = new Map(), all = rows.length ? await boardRows(rows.map((r) => r.id)) : []
    for (const r of all) (byVillage.get(r.vid) ?? byVillage.set(r.vid, []).get(r.vid)).push(r)
    const now = Date.now()
    const closed = await sql.query(`select slug, name from village where owner_id = $1 and deleted_at > now() - interval '7 days' order by deleted_at desc`, [uid]) // the 7-day undo
    return res.json({ closed, villages: rows.map(({ id, course_tags, ...r }) => {
      const next = buildBoard(byVillage.get(id) ?? [], course_tags ?? [], now).filter((e) => e.dueAt > now).sort((a, b) => a.dueAt - b.dueAt)[0]
      return { ...r, next: next ? { title: next.title, courseCode: next.courseCode, dueAt: next.dueAt } : null }
    }) })
  }
  if (first === 'courses' && !second && req.method === 'GET') { // chip suggestions for /new: course codes found in my own deadlines and tasks
    const rows = await sql.query(
      `select title, context from deadlines where user_id = $1 and due_date >= current_date - 120
       union all select title, null from tasks where user_id = $1 and (due_date is null or due_date >= current_date - 120)`, [uid])
    const n = new Map()
    for (const r of rows) { const c = courseOf(`${r.title} ${r.context ?? ''}`); if (c) n.set(c, (n.get(c) ?? 0) + 1) }
    return res.json({ courses: [...n].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c]) => c) })
  }
  if (first === 'new' && !second && req.method === 'POST') { // create a village (a named route: Vercel's [...all] needs at least one path segment): me as owner. Limits are counted here, the unique slug is the database's call.
    if (!(await limit(req, res, { scope: 'village-create', max: 10, id: uid }))) return
    const c = cleanCreate(req.body)
    if (!c.ok) return res.status(400).json({ error: c.error })
    const { name, slug, courses, settings } = c.value
    const [n] = await sql.query(
      `select (select count(*)::int from village where owner_id = $1 and deleted_at is null) as owned,
              (select count(*)::int from village_member m join village v on v.id = m.village_id where m.user_id = $1 and m.banned_at is null and v.deleted_at is null) as joined`, [uid])
    if (n.owned >= MAX_OWNED_VILLAGES) return res.status(409).json({ error: 'too_many_owned' })
    if (n.joined >= MAX_JOINED_VILLAGES) return res.status(409).json({ error: 'too_many_joined' })
    try {
      const [row] = await sql.query(
        `with v as (insert into village (slug, name, owner_id, course_tags, settings) values ($1, $2, $3, $4, $5) returning id),
              m as (insert into village_member (village_id, user_id, role, status_sharing) select id, $3, 'owner', $6 from v)
         select id from v`, [slug, name, uid, courses, JSON.stringify(settings), settings.default_status_sharing])
      return res.json({ ok: true, slug })
    } catch (e) { if (e?.code === '23505') return res.status(409).json({ error: 'slug_taken' }); throw e }
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
  if (first === 'invite') return inviteRoutes({ req, res, uid, code: second, action: parts[2], ev, maxMembers: MAX_MEMBERS, defaultSharing })
  if (!first || first === 'mine' || first === 'courses' || first === 'new') return res.status(404).json({ error: 'Not found' })
  const slug = first.slice(0, 64)

  if (second === 'restore' && req.method === 'POST') { // undo closing, within 7 days, owner only
    const r = await sql.query(`update village set deleted_at = null where slug = $1 and owner_id = $2 and deleted_at > now() - interval '7 days' returning id`, [slug, uid])
    return r.length ? res.json({ ok: true }) : res.status(404).json({ error: 'not_found' })
  }

  const v = await memberOf(slug, uid)
  if (!v) { // a village that was closed says so to people who were in it
    const gone = await sql.query('select 1 from village v join village_member m on m.village_id = v.id where v.slug = $1 and v.deleted_at is not null and m.user_id = $2 and m.banned_at is null', [slug, uid])
    return gone.length ? res.status(410).json({ error: 'closed' }) : no(res)
  }
  if (!second && req.method === 'DELETE') return closeVillage({ res, uid, v })
  if (await manage({ req, res, uid, v, parts: parts.slice(1), ev })) return

  if (!second && req.method === 'GET') {
    await sql.query('update village_member set last_seen_at = now() where village_id = $1 and user_id = $2', [v.id, uid])
    const members = await sql.query(
      `select m.user_id as "userId", u.name, coalesce(m.settings->>'colour', 'snow') as colour, m.role, m.desk_spot_id as "deskSpotId", m.last_seen_at as "lastSeenAt"
         from village_member m join "user" u on u.id = m.user_id where m.village_id = $1 and m.banned_at is null order by m.joined_at`, [v.id])
    return res.json({
      village: { id: v.id, slug: v.slug, name: v.name, courseTags: v.course_tags, libraryAutoFocus: v.settings?.library_auto_focus !== false, whoCanInvite: v.settings?.who_can_invite === 'everyone' ? 'everyone' : 'admins' },
      me: { userId: uid, role: v.role, colour: v.mine?.colour ?? 'snow', statusSharing: v.status_sharing, shareDeadlines: v.share_deadlines, deskSpotId: v.desk_spot_id },
      members,
    })
  }

  if (second === 'desk' && req.method === 'PUT') { // claim a desk (or release with null). One desk per member: claiming a new one frees the old.
    const spot = req.body?.spotId
    if (spot === null) { await sql.query('update village_member set desk_spot_id = null where village_id = $1 and user_id = $2', [v.id, uid]); return res.json({ ok: true, spotId: null }) }
    if (!can(v.role, 'claimDesk')) return res.status(403).json({ error: 'forbidden' }) // guests have no desk
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
    const items = await boardRows([v.id])
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

  if (!second && req.method === 'PATCH') { // village settings: owner and admins
    if (!can(v.role, 'changeSettings')) return res.status(403).json({ error: 'forbidden' })
    const b = req.body || {}, patch = {}
    if (b.libraryAutoFocus !== undefined) { if (typeof b.libraryAutoFocus !== 'boolean') return res.status(400).json({ error: 'Invalid' }); patch.library_auto_focus = b.libraryAutoFocus }
    if (b.whoCanInvite !== undefined) { if (!['admins', 'everyone'].includes(b.whoCanInvite)) return res.status(400).json({ error: 'Invalid' }); patch.who_can_invite = b.whoCanInvite }
    if (b.defaultSharing !== undefined) { if (!['basic', 'full'].includes(b.defaultSharing)) return res.status(400).json({ error: 'Invalid' }); patch.default_status_sharing = b.defaultSharing }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to change' })
    await sql.query('update village set settings = settings || $2::jsonb where id = $1', [v.id, JSON.stringify(patch)])
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
