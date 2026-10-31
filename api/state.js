import { limit } from './_rate.js'
import { userOf } from './_auth.js'
import feed from './_ics.js'
import { loadDoc, saveDoc, hasContent, sql, SETTINGS } from './_store.js'

const UID = /^[0-9a-f-]{36}$/
const KEYS = ['goals', 'tasks', 'hobbies', 'deadlines', 'projects', ...SETTINGS] // anything else in a PUT is dropped
const ARRAYS = ['goals', 'tasks', 'hobbies', 'deadlines', 'projects', 'busy']

export default async function handler(req, res) {
  if (req.query.feed) return feed(req, res) // /api/ics is rewritten here (vercel.json): the Hobby plan allows 12 functions
  const uid = await userOf(req)
  if (!uid) return res.status(401).json({ error: 'Sign in first' })
  if (!(await limit(req, res, { scope: 'state', max: 600, id: uid }))) return // autosave PUTs are frequent
  if (req.method === 'GET') {
    const doc = await loadDoc(uid)
    await sql.query('insert into user_day (user_id) select id from users where id = $1 on conflict do nothing', [uid]) // no users row yet = nothing to count
    return res.json(doc)
  }
  if (req.method === 'PUT') {
    const body = req.body || {}
    if (!['goals', 'tasks'].every((k) => Array.isArray(body[k])) || ARRAYS.some((k) => body[k] !== undefined && !Array.isArray(body[k])) || JSON.stringify(body).length > 200_000)
      return res.status(400).json({ error: 'Invalid or too large' })
    try {
      const rev = await saveDoc(uid, Object.fromEntries(KEYS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]])), Number.isSafeInteger(body._rev) ? body._rev : null)
      return res.json({ ok: true, rev })
    } catch (e) {
      if (e.conflict) return res.status(409).json({ error: 'Changed on another device' })
      throw e
    }
  }
  if (req.method === 'POST') { // first sign-in on a browser that already has anonymous data: move it into the account, once
    const from = req.body?.claim
    if (!UID.test(from) || from === uid) return res.status(400).json({ error: 'bad claim' })
    const old = await loadDoc(from)
    if (hasContent(old) && !hasContent(await loadDoc(uid))) {
      await saveDoc(uid, old)
      await sql.query('delete from users where id = $1', [from])
    }
    return res.json({ ok: true })
  }
  res.status(405).end()
}
