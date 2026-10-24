// Shared by the AI endpoints: rate limit, Anthropic call, friendly errors. Key and prompts stay server-side.
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const LIMIT = 60 // AI calls per uid per hour; per IP gets 4x as a backstop for forged uids
let ready
export async function guard(req, res) {
  if (req.method !== 'POST') return void res.status(405).end()
  const uid = String(req.headers['x-uid'] || '').slice(0, 40)
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const w = Math.floor(Date.now() / 36e5)
  try {
    await (ready ||= sql`create table if not exists rate (k text, w bigint, n int, primary key (k, w))`)
    for (const [k, max] of [[`u:${uid}`, LIMIT], [`i:${ip}`, LIMIT * 4]]) {
      const [r] = await sql`insert into rate (k, w, n) values (${k}, ${w}, 1) on conflict (k, w) do update set n = rate.n + 1 returning n`
      if (r.n > max) return void res.status(429).json({ error: 'Too many AI requests this hour. Try again later.' })
    }
  } catch { ready = null } // ponytail: fails open if the counter is down; old windows are never purged, add a cleanup if the table grows
  return true
}

const SHAPE = { object: /\{[\s\S]*\}/, array: /\[[\s\S]*\]/ }
// Calls Claude and parses the JSON in its answer. Throws an Error whose message is safe to show.
export async function askJSON({ system, messages, shape = 'object', max_tokens = 8000 }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens, system, messages }),
    signal: AbortSignal.timeout(45_000),
  }).catch(() => { throw new Error('The AI took too long. Please try again.') })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error('The AI is unavailable right now. Please try again.')
  const text = data.content?.find((b) => b.type === 'text')?.text
  try { return JSON.parse(text.match(SHAPE[shape])[0]) } catch { throw new Error('The AI gave an unreadable answer. Please try again.') }
}
