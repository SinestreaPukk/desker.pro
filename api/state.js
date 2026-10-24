import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const UID = /^[0-9a-f-]{36}$/

export default async function handler(req, res) {
  const { uid } = req.query
  if (!UID.test(uid)) return res.status(400).json({ error: 'bad uid' })
  if (req.method === 'GET') {
    const [row] = await sql`select data from workspaces where uid = ${uid}`
    return res.json(row?.data ?? { goals: [], tasks: [], hobbies: [], deadlines: [] })
  }
  if (req.method === 'PUT') {
    const { goals, tasks, hobbies = [], deadlines = [], focus = null, freeHours, freeToday, mood, busy = [], sync } = req.body || {}
    if (!Array.isArray(goals) || !Array.isArray(tasks) || !Array.isArray(hobbies) || !Array.isArray(deadlines) || !Array.isArray(busy) || JSON.stringify(req.body).length > 200_000)
      return res.status(400).json({ error: 'Invalid or too large' })
    await sql`insert into workspaces (uid, data) values (${uid}, ${JSON.stringify({ goals, tasks, hobbies, deadlines, focus, freeHours, freeToday, mood, busy, sync })}::jsonb)
              on conflict (uid) do update set data = excluded.data, updated_at = now()`
    return res.json({ ok: true })
  }
  res.status(405).end()
}
