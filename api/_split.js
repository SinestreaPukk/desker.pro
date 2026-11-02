// Splits a deadline's tasks into sessions and offers three ways to schedule them. Served by api/deadline.js (Hobby plan allows 12 functions).
import { guard, askJSON } from './_ai.js'

export default async function handler(req, res) {
  if (!(await guard(req, res))) return
  const { deadline, tasks, freeHours, busy = [], energy, ratio, now } = req.body.split || {}
  if (!deadline?.title || !/^\d{4}-\d\d-\d\d$/.test(deadline.date || '') || !Array.isArray(tasks) || !tasks.length || tasks.length > 40 || !Array.isArray(busy)
      || JSON.stringify(req.body).length > 40_000)
    return res.status(400).json({ error: 'Invalid or too large request' })
  const prompt = `You split a university student's tasks for one deadline into work sessions and schedule them. Local time now: ${String(now).slice(0, 40)}. Today is ${new Date().toISOString().slice(0, 10)}.
Deadline: ${JSON.stringify({ title: deadline.title, date: deadline.date, time: deadline.time ?? null })}
Open tasks for it (hours = the user's own guess, plannedMinutes = the time Desker plans for it, already adjusted for this user: use that, never multiply again): ${JSON.stringify(tasks)}
Free hours per day: ${freeHours ?? 'unknown (assume 4)'}. Fixed commitments (never schedule over them): ${JSON.stringify(busy)}
${energy?.high?.length ? `High energy hours (24h): ${JSON.stringify(energy.high)}. Put demanding sessions there.\n` : ''}${ratio ? `This user really takes about ${ratio}x their estimates.\n` : ''}
Divide each task into sessions of at most 1.5 hours (a task of 1.5 hours or less stays one session), then give each session a day and start time. Give exactly 3 different options, each covering EVERY task:
1. "Spread out": a little each day, finishing 2 or more days early.
2. "Front-loaded": the heavy work first, the last days light for review.
3. "Close to the date": fewer, longer days, finishing a day before the deadline.
Rules: nothing before now, nothing after the deadline date, start times 08:00 to 21:00, sessions do not overlap each other or the commitments, no day over its free hours.
Reply with ONLY JSON: {"options": [{"name": "<2-3 words>", "note": "<one sentence on the trade-off>", "sessions": [{"id": <the task id this session comes from>, "title": "<verb + specific content; for a split task add 'part 1 of 3' style>", "hours": <number>, "when": "<yyyy-mm-dd>", "start": "<HH:MM>"}]}]}
The first session of each task keeps that task's id; later sessions of the same task use the same id too.`
  try {
    res.json(await askJSON({ req, kind: 'split', messages: [{ role: 'user', content: prompt }] }))
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
