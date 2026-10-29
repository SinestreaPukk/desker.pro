// Public REST API for tasks. Auth: `Authorization: Bearer <sync code>` (Settings > Sync code).
//   GET /api/v1/tasks · POST /api/v1/tasks · PATCH|DELETE /api/v1/tasks?id=<id>
// 300 requests per hour per key. Writes replace the stored document, so an open browser tab shows them after a reload
// (ponytail: no live merge; the tab's next autosave overwrites API edits made since it loaded, add a version check if that bites).
import { neon } from '@neondatabase/serverless'
import { limit } from '../_rate.js'
import { apply } from '../_tasks.js'

const sql = neon(process.env.DATABASE_URL)
const UID = /^[0-9a-f-]{36}$/
const OPS = { POST: 'create', PATCH: 'update', DELETE: 'delete' }

export default async function handler(req, res) {
  const key = String(req.headers.authorization || '').replace(/^Bearer /i, '')
  if (!UID.test(key)) return res.status(401).json({ error: 'Missing or invalid Bearer key' })
  if (!(await limit(req, res, { scope: 'api', max: 300 }))) return
  const [row] = await sql`select data from workspaces where uid = ${key}`
  const doc = row?.data ?? { goals: [], tasks: [] }
  const tasks = doc.tasks || []
  if (req.method === 'GET') return res.json({ tasks })
  const op = OPS[req.method]
  if (!op) return res.status(405).end()
  const r = apply(tasks, op, Number(req.query.id), req.body)
  if (r.error) return res.status(r.status).json({ error: r.error })
  await sql`insert into workspaces (uid, data) values (${key}, ${JSON.stringify({ ...doc, goals: doc.goals || [], tasks: r.tasks })}::jsonb)
            on conflict (uid) do update set data = excluded.data, updated_at = now()`
  res.status(op === 'create' ? 201 : 200).json({ task: r.task })
}
