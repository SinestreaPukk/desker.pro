import { limit } from './_rate.js'
import { loadDoc, saveDoc, SETTINGS } from './_store.js'

const UID = /^[0-9a-f-]{36}$/
const KEYS = ['goals', 'tasks', 'hobbies', 'deadlines', 'projects', ...SETTINGS] // anything else in a PUT is dropped
const ARRAYS = ['goals', 'tasks', 'hobbies', 'deadlines', 'projects', 'busy']

export default async function handler(req, res) {
  const { uid } = req.query
  if (!UID.test(uid)) return res.status(400).json({ error: 'bad uid' })
  if (!(await limit(req, res, { scope: 'state', max: 600 }))) return // autosave PUTs are frequent
  if (req.method === 'GET') return res.json(await loadDoc(uid))
  if (req.method === 'PUT') {
    const body = req.body || {}
    if (!['goals', 'tasks'].every((k) => Array.isArray(body[k])) || ARRAYS.some((k) => body[k] !== undefined && !Array.isArray(body[k])) || JSON.stringify(body).length > 200_000)
      return res.status(400).json({ error: 'Invalid or too large' })
    await saveDoc(uid, Object.fromEntries(KEYS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]])))
    return res.json({ ok: true })
  }
  res.status(405).end()
}
