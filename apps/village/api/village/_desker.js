// Answers for desker.dev itself (Phase 1 CP12): who is studying for the Today page, the weekly "studied with friends" line, and my data for Desker's export.
// desker.dev calls these cross-origin with the shared sign-in cookie; DESKER_ORIGINS lists which sites may (default: desker.dev).
import { sql } from '../../../../api/_store.js'

const origins = () => (process.env.DESKER_ORIGINS || 'https://desker.dev,https://www.desker.dev').split(',').map((s) => s.trim()).filter(Boolean)
/** CORS for the three routes below only. Returns true if the request was a pre-flight and is already answered. */
export function cors(req, res) {
  const o = req.headers.origin
  if (o && origins().includes(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'content-type') }
  if (req.method === 'OPTIONS') { res.status(204).end(); return true }
  return false
}

/** Friends studying now (people in my villages with a running timer, not me) and my hours with friends this week. */
export async function summary(uid) {
  const [now] = await sql.query(
    `select count(distinct f.user_id)::int as n,
            coalesce(json_agg(distinct coalesce(m.settings->>'colour', 'snow')) filter (where f.user_id is not null), '[]') as colours,
            (array_agg(v.name order by f.started_at desc))[1] as village, (array_agg(v.slug order by f.started_at desc))[1] as slug
       from village_focus_session f join village v on v.id = f.village_id and v.deleted_at is null
       join village_member me on me.village_id = f.village_id and me.user_id = $1 and me.banned_at is null
       join village_member m on m.village_id = f.village_id and m.user_id = f.user_id and m.banned_at is null and m.status_sharing <> 'off'
      where f.user_id <> $1 and f.ended_at is null and f.started_at > now() - interval '3 hours'`, [uid])
  // "with friends": only rounds of a study-together session count, capped at 3 h each in case a timer was left running
  const week = await sql.query(
    `select v.name, v.slug, round(sum(least(extract(epoch from (f.ended_at - f.started_at)), 10800)) / 3600.0, 1)::float as hours
       from village_focus_session f join village v on v.id = f.village_id
      where f.user_id = $1 and f.group_session_id is not null and f.ended_at is not null and f.started_at > now() - interval '7 days'
      group by v.name, v.slug order by hours desc limit 1`, [uid])
  return { studying: { count: now?.n ?? 0, colours: (now?.colours ?? []).slice(0, 5), village: now?.village ?? null, slug: now?.slug ?? null }, week: week[0] ?? null }
}

/** Everything the village holds about me, for Desker's "Export JSON". */
export async function exportMine(uid) {
  const q = (text) => sql.query(text, [uid])
  const [villages, board, questions, answers, sessions, groups, blocks, reports] = await Promise.all([
    q(`select v.name, v.slug, m.role, m.desk_spot_id as "deskSpotId", m.status_sharing as "statusSharing", m.share_deadlines as "shareDeadlines", m.settings, m.joined_at as "joinedAt" from village_member m join village v on v.id = m.village_id where m.user_id = $1`),
    q(`select v.slug as village, i.kind, i.course_code as "courseCode", i.title, i.body, i.due_at as "dueAt", i.created_at as "createdAt" from village_board_item i join village v on v.id = i.village_id where i.created_by = $1 and i.deleted_at is null`),
    q(`select v.slug as village, q.text, q.course_code as "courseCode", q.created_at as "createdAt" from village_question q join village v on v.id = q.village_id where q.asker_id = $1`),
    q(`select a.text, a.created_at as "createdAt" from village_answer a where a.user_id = $1`),
    q(`select v.slug as village, f.started_at as "startedAt", f.ended_at as "endedAt", f.group_session_id as "groupSessionId" from village_focus_session f join village v on v.id = f.village_id where f.user_id = $1 order by f.started_at`),
    q(`select g.village_id as "villageId", p.task_title as "taskTitle", p.course_code as "courseCode", p.joined_at as "joinedAt", p.left_at as "leftAt" from village_group_participant p join village_group_session g on g.id = p.group_session_id where p.user_id = $1`),
    q(`select blocked_id as "userId", created_at as "createdAt" from village_block where blocker_id = $1`),
    q(`select reason, created_at as "createdAt" from village_report where reporter_id = $1`),
  ])
  return { exportedAt: new Date().toISOString(), villages, boardItems: board, questions, answers, focusSessions: sessions, studyTogether: groups, blocked: blocks, reportsFiled: reports }
}
