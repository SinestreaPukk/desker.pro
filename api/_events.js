// Receives batches of analytics events from src/analytics.js. Served by api/state.js (/api/state?events=1; the Hobby plan allows 12 functions).
// Off unless ANALYTICS=on. Everything is re-checked here with the same allow-list the client uses, so a hand-made request cannot store free text.
import { sql } from './_store.js'
import { sanitize } from '../src/analytics.js'

export const analyticsOn = () => process.env.ANALYTICS === 'on'

// Server-side events (e.g. a notification was sent). Never throws: analytics must not break what it measures.
export async function record(uid, events) {
  if (!analyticsOn()) return
  const rows = events.map(sanitize).filter(Boolean).map((e) => ({ name: e.name, props: e.props, at: new Date(Math.min(Date.now(), Math.max(Date.now() - 864e5, e.at))).toISOString() })).slice(0, 50)
  if (!rows.length) return
  try {
    await sql.query(`insert into events (user_id, name, at, props) select $1::text, x.name, x.at, x.props from jsonb_to_recordset($2::jsonb) as x(name text, at timestamptz, props jsonb)
      where exists (select 1 from users where id = $1)`, [uid, JSON.stringify(rows)])
  } catch { /* the table may not exist yet (db/migrations/002_events.sql) */ }
}

export default async function handler(req, res, uid) {
  if (req.method !== 'POST') return res.status(405).end()
  if (analyticsOn() && Array.isArray(req.body?.events)) await record(uid, req.body.events)
  res.status(204).end()
}
