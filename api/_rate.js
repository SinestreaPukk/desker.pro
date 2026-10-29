// Shared rate limiter: fixed one-hour windows counted in Postgres, per id and per IP (4x, backstop for forged ids).
// Sends X-RateLimit-* headers; returns false after answering 429 (over) or 503 (counter down: fail closed, AI calls cost money).
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const HOUR = 36e5
let ready

export const idOf = (req) =>
  String(req.headers['x-uid'] || req.headers.authorization?.replace(/^Bearer /i, '') || req.query?.uid || '').slice(0, 40)

export async function limit(req, res, { scope, max }) {
  const id = idOf(req)
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const w = Math.floor(Date.now() / HOUR)
  try {
    await (ready ||= sql`create table if not exists rate (k text, w bigint, n int, primary key (k, w))`)
    if (Math.random() < 0.01) await sql`delete from rate where w < ${w - 1}` // purge old windows now and then
    let left = max
    for (const [k, cap] of [[`${scope}:u:${id}`, max], [`${scope}:i:${ip}`, max * 4]]) {
      const [r] = await sql`insert into rate (k, w, n) values (${k}, ${w}, 1) on conflict (k, w) do update set n = rate.n + 1 returning n`
      left = Math.min(left, cap - r.n)
    }
    res.setHeader('X-RateLimit-Limit', max)
    res.setHeader('X-RateLimit-Remaining', Math.max(left, 0))
    if (left < 0) {
      res.setHeader('Retry-After', Math.ceil(((w + 1) * HOUR - Date.now()) / 1000))
      res.status(429).json({ error: 'Too many requests this hour. Try again later.' })
      return false
    }
    return true
  } catch {
    ready = null
    res.status(503).json({ error: 'Temporarily unavailable. Please try again.' })
    return false
  }
}
