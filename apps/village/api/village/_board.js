// The full Board (Phase 1 CP6): /api/village/:slug/board[/announce|/planner|/:id[/confirm]].
// Items members share from Desker are read live (so sharing off removes them at once); items added by hand live in village_board_item.
import { sql, loadDoc, saveDoc } from '../../../../api/_store.js'
import { limit } from '../../../../api/_rate.js'
import { buildBoard, courseOf, findDuplicate, parseDue, plannerDeadline, plannerHas, normTitle } from '../../../../packages/shared/src/board.js'
import { can } from '../../../../packages/shared/src/permissions.js'
import { maskBadWords } from '../../../../packages/shared/src/wordfilter.js'
import { notify } from './_qa.js'

const ID = /^[0-9a-f-]{36}$/
const text = (v, max) => (typeof v === 'string' ? maskBadWords([...v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('')) : '')
const DAY = 86_400_000

/** Everything the Board shows for this village: merged entries, announcements, and which entries are already in my planner. */
export async function loadBoard(v, uid, auto) {
  const manual = (await sql.query(
    `select i.id, i.kind, i.course_code as "courseCode", i.title, (extract(epoch from i.due_at) * 1000)::float8 as ms, i.created_by as "createdBy",
            coalesce((select array_agg(c.user_id) from village_board_confirm c join village_member m on m.user_id = c.user_id and m.village_id = i.village_id and m.banned_at is null where c.item_id = i.id), '{}') as confirmers
       from village_board_item i where i.village_id = $1 and i.deleted_at is null and i.kind <> 'announcement' and i.due_at > now() - interval '24 hours'`, [v.id]))
    .map((r) => ({ userId: r.createdBy, title: r.title, dueAt: r.ms, courseCode: r.courseCode, kind: r.kind, manual: true, itemId: r.id, createdBy: r.createdBy, confirmers: r.confirmers }))
  const entries = buildBoard([...auto, ...manual], v.course_tags ?? [], Date.now())
  const mine = await sql.query('select title, due_date::text as date, due_time as time from deadlines where user_id = $1 and due_date >= current_date - 2', [uid])
  const announcements = await sql.query(
    `select a.id, a.title, a.body, a.pinned, a.created_at as "createdAt", u.name as "by" from village_board_item a join "user" u on u.id = a.created_by
      where a.village_id = $1 and a.kind = 'announcement' and a.deleted_at is null order by a.pinned desc, a.created_at desc limit 20`, [v.id])
  return { items: entries.map((e) => ({ ...e, inPlanner: plannerHas(mine, e) })), announcements }
}

const tagsOf = (v) => new Set((v.course_tags ?? []).map((c) => courseOf(c) ?? c.toUpperCase()))

/** -> true if handled. parts = what follows the slug (starting with 'board'). */
export async function board({ req, res, uid, v, parts, ev, auto }) {
  if (parts[0] !== 'board') return false
  const [, a, b] = parts
  const tell = () => notify(v.id, { kind: 'update', qid: 'board', userId: uid }) // clients reload the Board (qid 'board' = the Board, not a question)

  if (!a && req.method === 'GET') return res.json(await loadBoard(v, uid, await auto())), true

  if (!a && req.method === 'POST') { // add a Due or Exam item
    if (!can(v.role, 'addBoard')) return res.status(403).json({ error: 'forbidden' }), true
    if (!(await limit(req, res, { scope: 'village-board', max: 60, id: uid }))) return true
    const x = req.body || {}, title = text(x.title, 120), dueAt = parseDue(x.date, x.time), courseCode = courseOf(String(x.courseCode ?? ''))
    if (!['due', 'exam'].includes(x.kind) || title.length < 2) return res.status(400).json({ error: 'bad_item' }), true
    if (!courseCode || !tagsOf(v).has(courseCode)) return res.status(400).json({ error: 'bad_course' }), true
    if (!(dueAt > Date.now() - DAY) || dueAt > Date.now() + 400 * DAY) return res.status(400).json({ error: 'bad_date' }), true
    if (x.force !== true) { // "Looks like this is already on the Board"
      const hit = findDuplicate((await loadBoard(v, uid, await auto())).items, { courseCode, title, dueAt })
      if (hit) return res.status(409).json({ error: 'duplicate', item: hit }), true
    }
    const [row] = await sql.query(
      `with i as (insert into village_board_item (village_id, kind, course_code, title, title_norm, due_at, created_by) values ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0), $7) returning id),
            c as (insert into village_board_confirm (item_id, user_id) select id, $7 from i) select id from i`, [v.id, x.kind, courseCode, title, normTitle(title), dueAt, uid])
    await ev(v.id, uid, 'board_item_added', { kind: x.kind })
    await tell()
    return res.json({ ok: true, id: row.id }), true
  }

  if (a === 'announce' && req.method === 'POST') {
    if (!can(v.role, 'announce')) return res.status(403).json({ error: 'forbidden' }), true
    if (!(await limit(req, res, { scope: 'village-board', max: 60, id: uid }))) return true
    const x = req.body || {}, title = text(x.title, 120), body = text(x.body, 500)
    if (!title) return res.status(400).json({ error: 'bad_item' }), true
    const [row] = await sql.query(`insert into village_board_item (village_id, kind, title, title_norm, body, pinned, created_by) values ($1, 'announcement', $2, $3, $4, $5, $6) returning id`, [v.id, title, normTitle(title), body || null, x.pinned === true, uid])
    await ev(v.id, uid, 'board_item_added', { kind: 'announcement' })
    await tell()
    return res.json({ ok: true, id: row.id }), true
  }

  if (a === 'planner' && req.method === 'POST') { // add to MY Desker planner: the same deadline shape Desker's own screens create; never twice
    if (!(await limit(req, res, { scope: 'village-planner', max: 60, id: uid }))) return true
    const x = req.body || {}, title = text(x.title, 120), dueAt = Number(x.dueAt), courseCode = courseOf(String(x.courseCode ?? ''))
    if (title.length < 2 || !Number.isFinite(dueAt) || !courseCode || !tagsOf(v).has(courseCode)) return res.status(400).json({ error: 'bad_item' }), true
    const q = { title, courseCode, dueAt }
    for (let attempt = 0; attempt < 5; attempt++) { // two saves can land together: the version check makes one look again
      const doc = await loadDoc(uid), dls = doc.deadlines || []
      if (plannerHas(dls, q)) return res.json({ ok: true, already: true }), true
      try {
        await saveDoc(uid, Object.fromEntries(Object.entries({ ...doc, deadlines: [...dls, plannerDeadline(dls, q)] }).filter(([k]) => k !== '_rev')), Number(doc._rev ?? 0))
        await ev(v.id, uid, 'board_item_to_planner', { kind: x.kind === 'exam' ? 'exam' : 'due' })
        return res.json({ ok: true }), true
      } catch (e) { if (!e.conflict) throw e }
    }
    return res.status(409).json({ error: 'busy' }), true
  }

  if (!ID.test(a ?? '')) return res.status(404).json({ error: 'not_found' }), true
  const it = (await sql.query('select id, kind, created_by as "createdBy" from village_board_item where id = $1 and village_id = $2 and deleted_at is null', [a, v.id]))[0]
  if (!it) return res.status(404).json({ error: 'not_found' }), true
  const mayEdit = it.kind === 'announcement' ? can(v.role, 'announce') : can(v.role, 'editAnyBoard') || (it.createdBy === uid && can(v.role, 'editOwnBoard'))

  if (b === 'confirm' && req.method === 'POST') { // "I have this too" on or off
    if (it.kind === 'announcement' || !can(v.role, 'interact')) return res.status(403).json({ error: 'forbidden' }), true
    if (req.body?.on === false) await sql.query('delete from village_board_confirm where item_id = $1 and user_id = $2', [a, uid])
    else await sql.query('insert into village_board_confirm (item_id, user_id) values ($1, $2) on conflict do nothing', [a, uid])
    await tell()
    return res.json({ ok: true }), true
  }
  if (!b && req.method === 'DELETE') { // soft delete
    if (!mayEdit) return res.status(403).json({ error: 'forbidden' }), true
    await sql.query('update village_board_item set deleted_at = now() where id = $1', [a])
    await tell()
    return res.json({ ok: true }), true
  }
  if (!b && req.method === 'PATCH') { // edit: title and date/time (items), title, body and pin (announcements)
    if (!mayEdit) return res.status(403).json({ error: 'forbidden' }), true
    const x = req.body || {}, set = [], args = [a]
    const add = (col, val) => { args.push(val); set.push(`${col} = $${args.length}`) }
    if (x.title !== undefined) { const t = text(x.title, 120); if (t.length < 1) return res.status(400).json({ error: 'bad_item' }), true; add('title', t); add('title_norm', normTitle(t)) }
    if (it.kind === 'announcement') { if (x.body !== undefined) add('body', text(x.body, 500) || null); if (typeof x.pinned === 'boolean') add('pinned', x.pinned) }
    else if (x.date !== undefined) { const d = parseDue(x.date, x.time); if (!(d > Date.now() - DAY)) return res.status(400).json({ error: 'bad_date' }), true; args.push(d); set.push(`due_at = to_timestamp($${args.length} / 1000.0)`) }
    if (!set.length) return res.status(400).json({ error: 'Nothing to change' }), true
    await sql.query(`update village_board_item set ${set.join(', ')} where id = $1`, args)
    await tell()
    return res.json({ ok: true }), true
  }
  return false
}
