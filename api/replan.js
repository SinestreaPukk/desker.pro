// Reschedules missed and remaining tasks. Prompt and key stay server-side.
import { guard, askJSON } from './_ai.js'

export const config = { maxDuration: 60 } // long answers

export default async function handler(req, res) {
  if (!(await guard(req, res))) return
  const { tasks, deadlines = [], freeHours, freeToday, busy = [], energy, ratio, now } = req.body || {}
  if (![tasks, deadlines, busy].every(Array.isArray) || !tasks.length || tasks.length > 60 || JSON.stringify(req.body).length > 50_000)
    return res.status(400).json({ error: 'Invalid or too large request' })
  const prompt = `You reschedule a user's week. Local time now: ${String(now).slice(0, 40)}. Today is ${new Date().toISOString().slice(0, 10)}.
Open tasks (when = planned day yyyy-mm-dd, start = planned HH:MM, hours = effort, due = due date, missed = its planned slot already passed without being done, readiness 0-100, important/urgent = Eisenhower ranking if known, deadlineId links to a deadline): ${JSON.stringify(tasks)}
Deadlines: ${JSON.stringify(deadlines)}
Free hours per day: ${freeHours ?? 'unknown (assume 4)'}. Free hours today only: ${freeToday ?? 'same as per day'}.
Fixed commitments (local time; never schedule over them): ${JSON.stringify(busy)}
${energy?.high?.length || energy?.low?.length ? `Learned energy pattern (24h clock hours): high energy hours ${JSON.stringify(energy.high || [])}, low energy hours ${JSON.stringify(energy.low || [])}. Put demanding tasks (important, many hours, low readiness) in high-energy hours and light ones in low-energy hours.` : 'No energy pattern is known yet.'}
${ratio ? `This user's tasks really take about ${ratio}x their own estimates: reserve that much time.` : ''}

Give EVERY listed task a new day and start time within the next 14 days, so that:
- nothing starts before the current time today, and nothing is on a day after its due date unless that is impossible (then place it as early as it can fit);
- missed and urgent/important tasks come first, and deadlines are met with a buffer;
- no day holds more hours than its free hours, and tasks do not overlap each other or the commitments;
- start times are between 08:00 and 21:00 and avoid pushing everything onto one day.
Keep a task's current day and time if it is already fine.
Reply with ONLY JSON: {"plan": [{"id": <task id>, "when": "<yyyy-mm-dd>", "start": "<HH:MM>"}], "note": "<one or two sentences on the main trade-off you made>"}`
  try {
    res.json(await askJSON({ messages: [{ role: 'user', content: prompt }] }))
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
