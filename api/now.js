// Suggests what to do right now, by three different methods. Prompt and key stay server-side.
import { guard, askJSON } from './_ai.js'

export default async function handler(req, res) {
  if (!(await guard(req, res))) return
  const { goals, tasks, hobbies, deadlines = [], minutes, energy, mood, freeToday, busy = [], now, pattern } = req.body || {}
  if (![goals, tasks, hobbies, deadlines].every(Array.isArray) || tasks.length > 50 || goals.length > 50
      || JSON.stringify(req.body).length > 50_000)
    return res.status(400).json({ error: 'Invalid or too large request' })
  const prompt = `You tell a user what to do RIGHT NOW. Local time: ${String(now).slice(0, 40)}. Today is ${new Date().toISOString().slice(0, 10)}.
How they said they feel: ${JSON.stringify(mood ?? null)} (let this tilt the choice, e.g. stressed means lighter work or a hobby).
Free hours they said they have today: ${freeToday ?? 'unknown'}.
Fixed commitments on their calendar (local time): ${JSON.stringify(busy.slice(0, 60))}. Do not suggest something that overlaps one that is happening or starts soon.
${pattern?.high?.length || pattern?.low?.length ? `Learned energy pattern (24h hours): high ${JSON.stringify(pattern.high)}, low ${JSON.stringify(pattern.low)}.\n` : ''}Free time they have now: ${Number(minutes) || 60} minutes. Their energy: ${energy || 'medium'}.
Goals (kind "happiness" = wellbeing goals): ${JSON.stringify(goals)}
Deadlines: ${JSON.stringify(deadlines)}
Open tasks (important/urgent = Eisenhower ranking if known, readiness 0-100, hours = effort, when = planned date, fun = hobby session): ${JSON.stringify(tasks)}
Hobbies: ${JSON.stringify(hobbies)}

Offer exactly 3 options, one per method, each a different item when possible:
1. method "Deadline first": the most urgent / closest-deadline work.
2. method "Best fit now": what fits their minutes, energy and time of day (low energy = lighter or familiar work, high energy = demanding work) and readiness.
3. method "Balance": what keeps work and happiness balanced, e.g. a happiness-goal task or a hobby if they have been grinding.
Reply with ONLY JSON: {"options": [{"method": "<name>", "taskId": <task id, or null for a hobby or something not in the list>, "title": "<the task's exact title if taskId is set; otherwise the hobby or activity>", "minutes": <session length, at most their free minutes>, "why": "<1 short sentence, may name the concrete first step>"}]}`
  try {
    res.json(await askJSON({ messages: [{ role: 'user', content: prompt }] }))
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
