// The kodama's notes, sent as web push. Served by api/state.js (/api/state?push=1: the Hobby plan allows 12 functions and all 12 are used).
// Call it once an hour with `Authorization: Bearer $CRON_SECRET` (a Vercel cron on a paid plan, or any scheduler such as cron-job.org or a GitHub Action).
// What may be sent, and when, is decided by src/pushPlan.js; this file only finds the people, sends, and forgets subscriptions that have gone dead.
// Off unless CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are all set (see .env.example).
import webpush from 'web-push'
import { sql } from './_store.js'
import { planPush } from '../src/pushPlan.js'

export const configured = () => ['CRON_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'].every((k) => process.env[k])

const localTime = (now, tz) => {
  try {
    return { day: now.toLocaleDateString('sv', { timeZone: tz }), hour: Number(now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', hour12: false })) % 24 }
  } catch { return null } // an unknown time zone: skip that person rather than guess
}

export default async function handler(req, res) {
  if (!configured()) return res.status(503).json({ error: 'Push is not configured' })
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Not allowed' })
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
  const now = new Date()
  const users = await sql`select id, settings from users where settings->'push'->>'on' = 'true' and jsonb_exists(settings->'push', 'sub')` // read-only: this must not count as the user being seen
  const ids = users.map((u) => u.id)
  const rows = ids.length ? await sql`select user_id, id, done, fun, done_at, to_char(plan_date, 'YYYY-MM-DD') as plan_date from tasks where user_id = any(${ids})` : []
  const byUser = new Map()
  for (const r of rows) { if (!byUser.has(r.user_id)) byUser.set(r.user_id, []); byUser.get(r.user_id).push({ id: Number(r.id), done: r.done, fun: r.fun, doneAt: r.done_at == null ? undefined : Number(r.done_at), when: r.plan_date || undefined }) }
  let sent = 0, gone = 0
  for (const u of users) {
    const doc = { ...u.settings, tasks: byUser.get(u.id) || [] }
    const local = localTime(now, doc.push.tz || 'UTC')
    const msg = local && planPush(doc, local, now.getTime())
    if (!msg) continue
    try {
      await webpush.sendNotification(doc.push.sub, JSON.stringify({ ...msg, url: '/today' }), { TTL: 3600 })
      sent++
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { gone++; await sql`update users set settings = settings #- '{push,sub}' where id = ${u.id}` } // the browser says this subscription is dead
    }
  }
  res.json({ ok: true, considered: users.length, sent, gone })
}
