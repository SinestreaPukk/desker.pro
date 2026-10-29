// Shared by the AI endpoints: rate limit, Anthropic call, friendly errors. Key and prompts stay server-side.
import { limit } from './_rate.js'
import { sql } from './_store.js'

// Token usage per AI call, read by the /dsb dashboard. Never lets a logging failure break the user's request.
export async function record(req, model, usage, kind = new URL(req.url, 'http://x').pathname.split('/').pop()) {
  try {
    const uid = String(req.headers['x-uid'] || '')
    const user = /^[0-9a-f-]{36}$/.test(uid) ? uid : null
    const tokens = [(usage?.input_tokens || 0) + (usage?.cache_creation_input_tokens || 0) + (usage?.cache_read_input_tokens || 0), usage?.output_tokens || 0]
    await sql.transaction((t) => [
      ...(user ? [t.query('insert into users (id) values ($1) on conflict do nothing', [user])] : []),
      t.query('insert into ai_calls (user_id, kind, model, input_tokens, output_tokens) values ($1, $2, $3, $4, $5)', [user, kind, model, ...tokens]),
    ])
  } catch { /* logging only */ }
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
