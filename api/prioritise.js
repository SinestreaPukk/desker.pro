// Prompt and API key stay server-side.
import { guard, askJSON } from './_ai.js'
const LIMIT = 50
export default async function handler(req, res) {
  if (!(await guard(req, res))) return
  const { goals, tasks } = req.body || {}
  if (!Array.isArray(goals) || !Array.isArray(tasks) || !tasks.length || goals.length > LIMIT || tasks.length > LIMIT
      || JSON.stringify(req.body).length > 50_000)
    return res.status(400).json({ error: 'Invalid or too large request (max 50 goals / 50 tasks)' })
  const prompt = `You prioritise tasks using a goals pyramid plus the Eisenhower matrix.
The user's goals pyramid (Vision at the top supports Long-term, then Mid-term, then Short-term):
${JSON.stringify(goals)}
${goals.length ? '' : 'The user has no goals yet: judge importance from the task text and its due date (studying for a test, deadlines, health, money and relationships rank above errands and busywork, but nothing is worthless), set goalId to null, and say so in the reason.\n'}
Goals with kind "happiness" are wellbeing goals: they are as important as career goals, so a task serving one counts as important (balance work and happiness).

Today is ${new Date().toISOString().slice(0, 10)}.
Tasks (JSON): ${JSON.stringify(tasks)}

For each task decide:
- goalId: the id of the single goal it best serves, or null if it serves none. Prefer the most specific (lowest) level that fits.
- important: every task on the list matters to the user, they just matter unequally. Set true when it advances a goal (higher pyramid levels weigh more) or is schoolwork, an exam/quiz/assignment prep, work, health, money or a commitment to someone. Set false only for clearly optional, lower-impact chores. A task serving no goal is NOT automatically unimportant: judge it from its text and due date. Never treat a task as something to drop.
- urgent: does it need doing soon (due date close/overdue, or time-sensitive)? Anything due within 3 days (or overdue) is urgent regardless of importance.
Reply with ONLY a JSON array: [{"id": <id>, "goalId": <goal id or null>, "important": true|false, "urgent": true|false, "reason": "<ONE short sentence, max 20 words: why it sits in this box, naming the goal if any, never saying it should be dropped>"}]`
  try {
    res.json(await askJSON({ req, messages: [{ role: 'user', content: prompt }], shape: 'array' }))
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
