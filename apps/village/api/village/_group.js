// Study together (Phase 1 CP7): /api/village/:slug/group[/join|/leave|/finish]. The database is the clock's source: started_at + focus/break/rounds decide the phase (packages/shared/src/groupSession.js),
// so nothing is lost when the room restarts. The room only hears "the group changed" (qupdate with qid 'group') and every client reloads it.
import { sql } from '../../../../api/_store.js'
import { limit } from '../../../../api/_rate.js'
import { can } from '../../../../packages/shared/src/permissions.js'
import { cleanGroup, phaseAt } from '../../../../packages/shared/src/groupSession.js'
import { notify } from './_qa.js'
import { pushMany } from './_push.js'

const text = (v, n) => (typeof v === 'string' ? [...v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, n).join('') : '')
const COURSE = /^[A-Za-z]{2,6}\s?\d{2,5}$/
// what others may see of someone's task, by their status sharing (SPEC §6.2): full = title and course, basic = course only, off = nothing
const taskFor = (sharing, title, course, self) => (self || sharing === 'full' ? { taskTitle: title || undefined, courseCode: course || undefined } : sharing === 'basic' ? { courseCode: course || undefined } : {})

const current = async (vid) => (await sql.query(
  `select g.id, g.started_by as "startedBy", u.name as "startedByName", g.focus_min as "focusMin", g.break_min as "breakMin", g.rounds, (extract(epoch from g.started_at) * 1000)::float8 as "startedAt"
     from village_group_session g join "user" u on u.id = g.started_by where g.village_id = $1 and g.ended_at is null`, [vid]))[0]

/** Ends the session once (a second call does nothing) and saves the summary card. */
async function endGroup(v, g, reason, ev, uid) {
  const done = await sql.query('update village_group_session set ended_at = now(), end_reason = $2 where id = $1 and ended_at is null returning id', [g.id, reason])
  if (!done.length) return null
  const rows = await sql.query(
    `select p.user_id as "userId", u.name, coalesce(m.settings->>'colour', 'snow') as colour, m.status_sharing as sharing, p.task_title as title, p.course_code as course,
            coalesce((select sum(extract(epoch from (coalesce(f.ended_at, now()) - f.started_at))) / 60 from village_focus_session f where f.group_session_id = p.group_session_id and f.user_id = p.user_id), 0)::float8 as minutes
       from village_group_participant p join "user" u on u.id = p.user_id join village_member m on m.village_id = $2 and m.user_id = p.user_id where p.group_session_id = $1`, [g.id, v.id])
  const people = rows.map((r) => ({ userId: r.userId, name: r.name, colour: r.colour, minutes: Math.round(r.minutes), ...taskFor(r.sharing, r.title, r.course, false) }))
  const summary = { focusMin: g.focusMin, breakMin: g.breakMin, rounds: g.rounds, startedAt: g.startedAt, endedAt: Date.now(), totalMin: people.reduce((a, p) => a + p.minutes, 0), people }
  await sql.query('update village_group_session set summary = $2::jsonb where id = $1', [g.id, JSON.stringify(summary)])
  await ev(v.id, uid, 'group_ended', { people: people.length, minutes: summary.totalMin })
  await notify(v.id, { kind: 'update', qid: 'group', userId: uid })
  return summary
}

const state = async (v, uid, ev) => {
  let g = await current(v.id)
  if (g && phaseAt(g, Date.now()).kind === 'done') { await endGroup(v, g, 'finished', ev, uid); g = null } // ran out while nobody was looking
  let group = null
  if (g) {
    const ps = await sql.query(
      `select p.user_id as "userId", u.name, coalesce(m.settings->>'colour', 'snow') as colour, m.status_sharing as sharing, p.task_title as title, p.course_code as course
         from village_group_participant p join "user" u on u.id = p.user_id join village_member m on m.village_id = $2 and m.user_id = p.user_id
        where p.group_session_id = $1 and p.left_at is null order by p.joined_at`, [g.id, v.id])
    group = { ...g, participants: ps.map((r) => ({ userId: r.userId, name: r.name, colour: r.colour, ...taskFor(r.sharing, r.title, r.course, r.userId === uid) })) }
  }
  const last = (await sql.query(
    `select s.id, s.summary from village_group_session s where s.village_id = $1 and s.ended_at > now() - interval '15 minutes' and s.summary is not null
        and exists (select 1 from village_group_participant p where p.group_session_id = s.id and p.user_id = $2) order by s.ended_at desc limit 1`, [v.id, uid]))[0]
  return { group, serverNow: Date.now(), summary: last ? { id: last.id, ...last.summary } : null }
}

export async function group({ req, res, uid, v, parts, ev }) {
  if (parts[0] !== 'group') return false
  const [, a] = parts
  const tell = () => notify(v.id, { kind: 'update', qid: 'group', userId: uid }) // -> { online } or null

  if (!a && req.method === 'GET') return res.json(await state(v, uid, ev)), true

  if (!a && req.method === 'POST') { // start
    if (!can(v.role, 'startGroup')) return res.status(403).json({ error: 'forbidden' }), true
    if (!(await limit(req, res, { scope: 'village-group', max: 60, id: uid }))) return true
    const c = cleanGroup(req.body)
    if (!c) return res.status(400).json({ error: 'bad_settings' }), true
    const now = await state(v, uid, ev) // also ends a session that ran out
    if (now.group) return res.status(409).json({ error: 'running' }), true // "a second Start offers to join the running one"
    try { await sql.query('insert into village_group_session (village_id, started_by, focus_min, break_min, rounds) values ($1, $2, $3, $4, $5)', [v.id, uid, c.focusMin, c.breakMin, c.rounds]) }
    catch (e) { if (e?.code === '23505') return res.status(409).json({ error: 'running' }), true; throw e }
    await ev(v.id, uid, 'group_started', c)
    const r = await tell()
    const [who] = await sql.query('select name from "user" where id = $1', [uid])
    const rows = await sql.query('select user_id as uid from village_member where village_id = $1 and banned_at is null and user_id <> $2', [v.id, uid])
    if (r?.online) await pushMany(rows.map((x) => x.uid).filter((u) => !r.online.includes(u)), 'group', { title: `${who?.name ?? 'Someone'} started a study session`, body: `${v.name} · ${c.focusMin}/${c.breakMin} × ${c.rounds}`, url: `/v/${v.slug}` }, { villageId: v.id }) // members who are not here get a nudge (max 2 a day per village)
    return res.json({ ok: true }), true
  }

  const g = await current(v.id)
  if (a === 'join' && req.method === 'POST') {
    if (!can(v.role, 'interact')) return res.status(403).json({ error: 'forbidden' }), true
    if (!g || phaseAt(g, Date.now()).kind === 'done') return res.status(409).json({ error: 'not_running' }), true
    const title = text(req.body?.taskTitle, 120), course = COURSE.test(req.body?.courseCode ?? '') ? String(req.body.courseCode).toUpperCase().replace(/\s+/g, '') : null
    await sql.query(
      `insert into village_group_participant (group_session_id, user_id, task_title, course_code) values ($1, $2, $3, $4)
       on conflict (group_session_id, user_id) do update set left_at = null, task_title = excluded.task_title, course_code = excluded.course_code`, [g.id, uid, title || null, course])
    await ev(v.id, uid, 'group_joined', {})
    await tell()
    return res.json({ ok: true, groupId: g.id }), true
  }
  if (a === 'leave' && req.method === 'POST') {
    if (!g) return res.json({ ok: true }), true
    await sql.query('update village_group_participant set left_at = now() where group_session_id = $1 and user_id = $2 and left_at is null', [g.id, uid])
    const left = await sql.query('select count(*)::int as n from village_group_participant where group_session_id = $1 and left_at is null', [g.id])
    const ever = await sql.query('select count(*)::int as n from village_group_participant where group_session_id = $1', [g.id])
    if (left[0].n === 0 && ever[0].n > 0) await endGroup(v, g, 'empty', ev, uid) // everyone left
    else await tell()
    return res.json({ ok: true }), true
  }
  if (a === 'finish' && req.method === 'POST') { // anyone may report "time is up"; it only counts if it is
    if (g && phaseAt(g, Date.now()).kind === 'done') await endGroup(v, g, 'finished', ev, uid)
    return res.json({ ok: true }), true
  }
  if (!a && req.method === 'DELETE') { // the starter, or an admin, ends it now
    if (!g) return res.json({ ok: true }), true
    if (g.startedBy !== uid && !can(v.role, 'moderate')) return res.status(403).json({ error: 'forbidden' }), true
    await endGroup(v, g, 'ended_by_starter', ev, uid)
    return res.json({ ok: true }), true
  }
  return false
}
