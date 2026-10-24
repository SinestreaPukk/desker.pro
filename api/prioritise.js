// Prompt and API key stay server-side.
const LIMIT = 50
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { goals, tasks } = req.body || {}
  if (!Array.isArray(goals) || !Array.isArray(tasks) || !tasks.length || goals.length > LIMIT || tasks.length > LIMIT
      || JSON.stringify(req.body).length > 50_000)
    return res.status(400).json({ error: 'Invalid or too large request (max 50 goals / 50 tasks)' })
  const prompt = `You prioritise tasks using a goals pyramid plus the Eisenhower matrix.
The user's goals pyramid (Vision at the top supports Long-term, then Mid-term, then Short-term):
${JSON.stringify(goals)}

Goals with kind "happiness" are wellbeing goals: they are as important as career goals, so a task serving one counts as important (balance work and happiness).

Today is ${new Date().toISOString().slice(0, 10)}.
Tasks (JSON): ${JSON.stringify(tasks)}

For each task decide:
- goalId: the id of the single goal it best serves, or null if it serves none. Prefer the most specific (lowest) level that fits.
- important: true only if it meaningfully advances a goal (higher pyramid levels weigh more); tasks serving no goal are not important.
- urgent: does it need doing soon (due date close/overdue, or time-sensitive)? Anything due within 3 days (or overdue) is urgent regardless of importance.
Reply with ONLY a JSON array: [{"id": <id>, "goalId": <goal id or null>, "important": true|false, "urgent": true|false, "reason": "<1-2 short sentences: which goal it serves and why that makes it important or not, and why it is or is not urgent>"}]`
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await r.json()
  if (!r.ok) return res.status(502).json({ error: data.error?.message || 'AI request failed' })
  const text = data.content.find((b) => b.type === 'text')?.text
  try {
    res.json(JSON.parse(text.match(/\[[\s\S]*\]/)[0]))
  } catch {
    res.status(502).json({ error: `No usable answer from model (${data.stop_reason})` })
  }
}
