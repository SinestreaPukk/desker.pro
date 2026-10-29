// Shared by the AI endpoints: rate limit, Anthropic call, friendly errors. Key and prompts stay server-side.
import { limit } from './_rate.js'
// 60 AI calls per id per hour
export async function guard(req, res) {
  if (req.method !== 'POST') return void res.status(405).end()
  return limit(req, res, { scope: 'ai', max: 60 })
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
