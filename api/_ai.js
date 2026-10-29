// Shared by the AI endpoints: rate limit, Anthropic call, friendly errors. Key and prompts stay server-side.
import { neon } from '@neondatabase/serverless'
import { limit } from './_rate.js'

const sql = neon(process.env.DATABASE_URL)
let ready
// Token usage per AI call, read by the /dsb dashboard. Never lets a logging failure break the user's request.
export async function record(req, model, usage, kind = new URL(req.url, 'http://x').pathname.split('/').pop()) {
  try {
    const uid = String(req.headers['x-uid'] || '').slice(0, 40)
    await (ready ||= sql`create table if not exists usage (uid text, kind text, model text, input_tokens int, output_tokens int, ts timestamptz default now())`)
    await sql`insert into usage (uid, kind, model, input_tokens, output_tokens) values (${uid}, ${kind}, ${model}, ${(usage?.input_tokens || 0) + (usage?.cache_creation_input_tokens || 0) + (usage?.cache_read_input_tokens || 0)}, ${usage?.output_tokens || 0})`
  } catch { ready = null }
}
// 60 AI calls per id per hour
export async function guard(req, res) {
  if (req.method !== 'POST') return void res.status(405).end()
  return limit(req, res, { scope: 'ai', max: 60 })
}

export const MODEL = 'claude-haiku-5-5'
const SHAPE = { object: /\{[\s\S]*\}/, array: /\[[\s\S]*\]/ }
// Calls Claude and parses the JSON in its answer. Throws an Error whose message is safe to show.
export async function askJSON({ req, kind, system, messages, shape = 'object', max_tokens = 8000 }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens, system, messages }),
    signal: AbortSignal.timeout(45_000),
  }).catch(() => { throw new Error('The AI took too long. Please try again.') })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error('The AI is unavailable right now. Please try again.')
  await record(req, MODEL, data.usage, kind)
  const text = data.content?.find((b) => b.type === 'text')?.text
  try { return JSON.parse(text.match(SHAPE[shape])[0]) } catch { throw new Error('The AI gave an unreadable answer. Please try again.') }
}
