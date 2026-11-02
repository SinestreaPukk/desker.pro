// Web push for the village (Phase 1 CP8). Sends only what packages/shared/src/pushRules.js allows. Off (a quiet no-op) until VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are set on this project.
import webpush from 'web-push'
import { sql } from '../../../../api/_store.js'
import { cleanPrefs, decide, defaultPrefs, localDayStart } from '../../../../packages/shared/src/pushRules.js'

export const configured = () => ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'].every((k) => process.env[k])
const DAY = 86_400_000

/** One push to one person, if their settings, quiet hours and the caps allow it. kind: answered | group | busy | deadline. Returns true if it was sent. */
export async function sendPush(uid, kind, msg, { villageId = null, ref = null, now = Date.now() } = {}) {
  if (!configured()) return false
  const row = (await sql.query('select sub, prefs, tz from village_push_sub where user_id = $1', [uid]))[0]
  if (!row) return false
  const [c] = await sql.query(
    `select (select count(*)::int from village_push_log where user_id = $1 and kind = $2 and sent_at > to_timestamp($4 / 1000.0) and ($3::uuid is null or village_id = $3)) as sent,
            exists(select 1 from village_push_log where user_id = $1 and kind = $2 and ref = $5) as already,
            coalesce((select last_seen_at > to_timestamp($6 / 1000.0) from village_member where user_id = $1 and village_id = $3), false) as opened`,
    [uid, kind, kind === 'group' ? villageId : null, localDayStart(now, row.tz), ref, localDayStart(now, row.tz)])
  const d = decide({ kind, prefs: cleanPrefs(row.prefs), now, tz: row.tz, sentToday: c.sent, already: ref ? c.already : false, openedToday: c.opened })
  if (!d.send) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
  try {
    await webpush.sendNotification(row.sub, JSON.stringify({ ...msg, tag: msg.tag ?? `${kind}-${ref ?? villageId ?? ''}` }), { TTL: 3600 })
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) await sql.query('delete from village_push_sub where user_id = $1', [uid]) // the browser says this subscription is dead
    return false
  }
  await sql.query('insert into village_push_log (user_id, kind, village_id, ref) values ($1, $2, $3, $4)', [uid, kind, villageId, ref])
  return true
}

/** Push to many (members who are not here right now). Failures never break the request that caused them. */
export async function pushMany(uids, kind, msg, opts) { await Promise.all(uids.map((u) => sendPush(u, kind, msg, opts).catch(() => false))) }

/** GET/PUT/DELETE /api/village/push: this browser's subscription and the person's choices. */
export async function pushRoutes({ req, res, uid }) {
  if (req.method === 'GET') {
    const row = (await sql.query('select prefs, tz from village_push_sub where user_id = $1', [uid]))[0]
    return res.json({ configured: configured(), publicKey: configured() ? process.env.VAPID_PUBLIC_KEY : null, subscribed: !!row, prefs: row ? cleanPrefs(row.prefs) : defaultPrefs() })
  }
  if (req.method === 'PUT') {
    const b = req.body || {}, prefs = cleanPrefs(b.prefs)
    const tz = typeof b.tz === 'string' && b.tz.length < 64 ? b.tz : null
    try { if (tz) new Intl.DateTimeFormat('en', { timeZone: tz }) } catch { return res.status(400).json({ error: 'bad_tz' }) }
    const s = b.sub
    if (s) { // a new subscription: it must look like one (https endpoint and keys), nothing else is stored
      if (typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 1000 || typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string') return res.status(400).json({ error: 'bad_sub' })
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh.slice(0, 200), auth: s.keys.auth.slice(0, 100) } }
      await sql.query(
        `insert into village_push_sub (user_id, sub, prefs, tz) values ($1, $2::jsonb, $3::jsonb, $4) on conflict (user_id) do update set sub = excluded.sub, prefs = excluded.prefs, tz = excluded.tz, updated_at = now()`, [uid, JSON.stringify(sub), JSON.stringify(prefs), tz ?? 'UTC'])
    } else {
      const r = await sql.query('update village_push_sub set prefs = $2::jsonb, tz = coalesce($3, tz), updated_at = now() where user_id = $1 returning user_id', [uid, JSON.stringify(prefs), tz])
      if (!r.length) return res.status(404).json({ error: 'not_subscribed' })
    }
    return res.json({ ok: true })
  }
  if (req.method === 'DELETE') { await sql.query('delete from village_push_sub where user_id = $1', [uid]); return res.json({ ok: true }) }
  return res.status(405).json({ error: 'Method not allowed' })
}

/** Daily job (Vercel cron): "deadline tomorrow" for Board items people confirmed, then housekeeping. */
export async function dailyJob() {
  const out = { sent: 0 }
  const rows = await sql.query(
    `select c.user_id as uid, i.id, i.title, i.course_code as course, v.id as vid, v.slug from village_board_confirm c
       join village_board_item i on i.id = c.item_id and i.deleted_at is null and i.due_at > now() and i.due_at <= now() + interval '24 hours'
       join village v on v.id = i.village_id and v.deleted_at is null
       join village_member m on m.village_id = v.id and m.user_id = c.user_id and m.banned_at is null`)
  for (const r of rows) if (await sendPush(r.uid, 'deadline', { title: `Due within a day${r.course ? ` · ${r.course}` : ''}`, body: r.title, url: `/v/${r.slug}?board=1` }, { villageId: r.vid, ref: r.id }).catch(() => false)) out.sent++
  await sql.query("delete from village_push_log where sent_at < now() - interval '3 days' and kind <> 'deadline'")
  await sql.query("delete from village_push_log where sent_at < now() - interval '60 days'")
  // housekeeping (SPEC §9): invites expired or revoked 30 days ago, handled reports after 180 days, villages closed more than 7 days ago (the undo window is over)
  await sql.query("delete from village_invite where coalesce(revoked_at, expires_at) < now() - interval '30 days'")
  await sql.query("delete from village_report where resolved_at < now() - interval '180 days'")
  await sql.query("delete from village where deleted_at < now() - interval '7 days'")
  return out
}
