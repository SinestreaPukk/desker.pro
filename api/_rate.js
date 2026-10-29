// Shared rate limiter: fixed one-hour windows counted in Postgres, per id and per IP (4x, backstop for forged ids).
// Sends X-RateLimit-* headers; returns false after answering 429 (over) or 503 (counter down after a retry: fail closed, AI calls cost money).
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const HOUR = 36e5
let ready

export const idOf = (req) =>
  String(req.headers['x-uid'] || req.headers.authorization?.replace(/^Bearer /i, '') || req.query?.uid || '').slice(0, 40)

export async function limit(req, res, { scope, max, id = idOf(req) }) {
  // one retry: a Neon cold start can fail the first query
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await count(req, res, { scope, max, id }) } catch { ready = null }
  }
  res.status(503).json({ error: 'Temporarily unavailable. Please try again.' })
  return false
}

async function count(req, res, { scope, max, id }) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const w = Math.floor(Date.now() / HOUR)
  await (ready ||= sql`create table if not exists rate (k text, w bigint, n int, primary key (k, w))`)
  if (Math.random() < 0.01) await sql`delete from rate where w < ${w - 1}` // purge old windows now and then
  const ku = `${scope}:u:${id}`, ki = `${scope}:i:${ip}`
  // one round trip for both counters
  const rows = await sql`insert into rate (k, w, n) values (${ku}, ${w}, 1), (${ki}, ${w}, 1) on conflict (k, w) do update set n = rate.n + 1 returning k, n`
  const n = Object.fromEntries(rows.map((r) => [r.k, r.n]))
  const left = Math.min(max - n[ku], max * 4 - n[ki])
  res.setHeader('X-RateLimit-Limit', max)
  res.setHeader('X-RateLimit-Remaining', Math.max(left, 0))
  if (left < 0) {
    res.setHeader('Retry-After', Math.ceil(((w + 1) * HOUR - Date.now()) / 1000))
    res.status(429).json({ error: 'Too many requests this hour. Try again later.' })
    return false
  }
  return true
}
