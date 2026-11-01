// Questions and answers (Phase 1 CP5). /api/village/:slug/questions[/:id[/answers|/resolve]] and /answers/:id/helpful.
// The database is the authority; the room is told afterwards so bubbles and the asker's notice follow the usual visibility rules.
import { sql } from '../../../../api/_store.js'
import { limit } from '../../../../api/_rate.js'
import { signToken } from '../../../../packages/shared/src/token.js'
import { can } from '../../../../packages/shared/src/permissions.js'
import { cleanQuestion, cleanAnswer, canResolve, QUESTION_RATE, ANSWER_RATE } from '../../../../packages/shared/src/qa.js'

const ID = /^[0-9a-f-]{36}$/

/** Tell the room (best effort: the question is saved either way and shows when the Board is opened). */
export async function notify(vid, body) {
  const base = process.env.VILLAGE_REALTIME_HTTP ?? process.env.VITE_REALTIME_URL?.replace(/^ws/, 'http')
  if (!base || !process.env.VILLAGE_ROOM_SECRET) return
  try {
    const t = await signToken({ sub: 'api', vid, role: 'notify' }, process.env.VILLAGE_ROOM_SECRET, 60)
    await fetch(`${base}/room/${vid}/notify`, { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  } catch { /* best effort */ }
}

const recent = async (table, col, uid, windowMs) => (await sql.query(`select count(*)::int as n from ${table} where ${col} = $1 and created_at > now() - ($2 || ' milliseconds')::interval`, [uid, String(windowMs)]))[0].n

/** -> true if handled. parts = what follows the slug. */
export async function qa({ req, res, uid, v, parts, ev }) {
  const [a, b, c] = parts
  if (a === 'answers' && c === 'helpful' && req.method === 'POST') { // the asker says an answer helped
    if (!ID.test(b ?? '')) return res.status(400).json({ error: 'Invalid' }), true
    const r = await sql.query(
      `update village_answer a set helpful = true from village_question q
        where a.id = $1 and q.id = a.question_id and q.village_id = $2 and q.asker_id = $3 returning q.id as qid`, [b, v.id, uid])
    if (!r.length) return res.status(404).json({ error: 'not_found' }), true
    await notify(v.id, { kind: 'update', qid: r[0].qid, userId: uid })
    return res.json({ ok: true }), true
  }
  if (a !== 'questions') return false

  if (!b && req.method === 'GET') { // open ones first, newest first; resolved ones follow
    const rows = await sql.query(
      `select q.id, q.text, q.course_code as "courseCode", q.asker_id as "askerId", u.name as "askerName", q.created_at as "createdAt", q.resolved_at is not null as resolved,
              (select count(*)::int from village_answer where question_id = q.id) as answers,
              exists(select 1 from village_answer where question_id = q.id and helpful) as helped
         from village_question q join "user" u on u.id = q.asker_id
        where q.village_id = $1 order by (q.resolved_at is not null), q.created_at desc limit 60`, [v.id])
    return res.json({ questions: rows }), true
  }

  if (!b && req.method === 'POST') {
    if (!can(v.role, 'interact')) return res.status(403).json({ error: 'forbidden' }), true
    if (!(await limit(req, res, { scope: 'village-ask', max: 60, id: uid }))) return true
    const q = cleanQuestion(req.body)
    if (!q.ok) return res.status(400).json({ error: 'bad_question' }), true
    if (await recent('village_question', 'asker_id', uid, QUESTION_RATE.windowMs) >= QUESTION_RATE.max) return res.status(429).json({ error: 'slow_down' }), true
    const [row] = await sql.query('insert into village_question (village_id, asker_id, text, course_code) values ($1, $2, $3, $4) returning id, created_at as "createdAt"', [v.id, uid, q.text, q.courseCode])
    await ev(v.id, uid, 'question_asked', {})
    await notify(v.id, { kind: 'asked', qid: row.id, userId: uid, text: q.text })
    return res.json({ ok: true, id: row.id }), true
  }

  if (!ID.test(b ?? '')) return res.status(404).json({ error: 'not_found' }), true
  const q = (await sql.query('select id, asker_id as "askerId", text, course_code as "courseCode", resolved_at is not null as resolved, created_at as "createdAt" from village_question where id = $1 and village_id = $2', [b, v.id]))[0]
  if (!q) return res.status(404).json({ error: 'not_found' }), true

  if (!c && req.method === 'GET') {
    const answers = await sql.query(
      `select a.id, a.user_id as "userId", u.name, a.text, a.helpful, a.created_at as "createdAt" from village_answer a join "user" u on u.id = a.user_id where a.question_id = $1 order by a.created_at`, [b])
    const [asker] = await sql.query('select name from "user" where id = $1', [q.askerId])
    return res.json({ question: { ...q, askerName: asker?.name ?? 'Someone' }, answers }), true
  }

  if (c === 'answers' && req.method === 'POST') {
    if (!can(v.role, 'interact')) return res.status(403).json({ error: 'forbidden' }), true
    if (!(await limit(req, res, { scope: 'village-answer', max: 200, id: uid }))) return true
    const t = cleanAnswer(req.body)
    if (!t.ok) return res.status(400).json({ error: 'bad_answer' }), true
    if (await recent('village_answer', 'user_id', uid, ANSWER_RATE.windowMs) >= ANSWER_RATE.max) return res.status(429).json({ error: 'slow_down' }), true
    const [row] = await sql.query('insert into village_answer (question_id, user_id, text) values ($1, $2, $3) returning id', [b, uid, t.text])
    const [me] = await sql.query('select name from "user" where id = $1', [uid])
    await ev(v.id, uid, 'question_answered', {})
    if (q.askerId !== uid) await notify(v.id, { kind: 'answered', qid: b, userId: q.askerId, by: uid, name: me?.name })
    else await notify(v.id, { kind: 'update', qid: b, userId: uid })
    return res.json({ ok: true, id: row.id }), true
  }

  if (c === 'resolve' && req.method === 'POST') { // the asker or an admin; saying it again reopens it
    if (!canResolve(v.role, q.askerId === uid)) return res.status(403).json({ error: 'forbidden' }), true
    const on = req.body?.resolved !== false
    await sql.query(`update village_question set resolved_at = ${on ? 'now()' : 'null'} where id = $1`, [b])
    if (on) await ev(v.id, uid, 'question_resolved', {})
    await notify(v.id, { kind: 'update', qid: b, userId: uid })
    return res.json({ ok: true, resolved: on }), true
  }
  return false
}
