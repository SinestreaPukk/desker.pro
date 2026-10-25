import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const UID = /^[0-9a-f-]{36}$/
// Document keys that are persisted; anything else in a PUT is dropped.
const KEYS = ['goals', 'tasks', 'hobbies', 'deadlines', 'busy', 'focus', 'pick', 'freeHours', 'freeToday', 'mood', 'sync', 'energyLog']
const ARRAYS = ['goals', 'tasks', 'hobbies', 'deadlines', 'busy']

export default async function handler(req, res) {
  const { uid } = req.query
  if (!UID.test(uid)) return res.status(400).json({ error: 'bad uid' })
  if (req.method === 'GET') {
    const [row] = await sql`select data from workspaces where uid = ${uid}`
    return res.json(row?.data ?? { goals: [], tasks: [], hobbies: [], deadlines: [] })
  }
  if (req.method === 'PUT') {
    const body = req.body || {}
    if (!['goals', 'tasks'].every((k) => Array.isArray(body[k])) || ARRAYS.some((k) => body[k] !== undefined && !Array.isArray(body[k])) || JSON.stringify(body).length > 200_000)
      return res.status(400).json({ error: 'Invalid or too large' })
    const doc = Object.fromEntries(KEYS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]))
    await sql`insert into workspaces (uid, data) values (${uid}, ${JSON.stringify(doc)}::jsonb)
              on conflict (uid) do update set data = excluded.data, updated_at = now()`
    return res.json({ ok: true })
  }
  res.status(405).end()
}
