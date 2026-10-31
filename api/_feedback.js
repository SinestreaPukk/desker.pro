// The Feedback button: emails what a signed-in user wrote to the owner. Served by api/state.js (/api/state?feedback=1; the Hobby plan allows 12 functions).
// Goes to FEEDBACK_TO (default: the owner). The user's address is set as Reply-To, so answering the mail answers them.
import { limit } from './_rate.js'
import { sql } from './_store.js'
import { send } from './_auth.js'

const KINDS = { bug: 'Bug', idea: 'Idea', love: 'Praise', other: 'Other' }
const TO = () => process.env.FEEDBACK_TO || 'tigerpukk@gmail.com'
const short = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n)

// Pure: the checked feedback, or null. Free text is capped; everything else is a short label.
export function clean(b = {}) {
  const message = short(b.message, 2000)
  if (message.length < 3 || !KINDS[b.kind]) return null
  return { kind: b.kind, message, page: short(b.page, 40), device: short(b.device, 200), reply: b.reply !== false }
}

export default async function handler(req, res, uid) {
  if (req.method !== 'POST') return res.status(405).end()
  const f = clean(req.body)
  if (!f) return res.status(400).json({ error: 'Write a few words first.' })
  if (!(await limit(req, res, { scope: 'feedback', max: 10, id: uid }))) return
  const [u] = await sql.query('select email, name from "user" where id = $1', [uid]).catch(() => [])
  const who = u?.email ? `${u.name ? `${short(u.name, 60)} ` : ''}<${u.email}>` : `account ${uid}`
  try {
    await send(TO(), `[Desker feedback] ${KINDS[f.kind]}: ${f.message.replace(/\s+/g, ' ').slice(0, 60)}`, {
      title: `${KINDS[f.kind]} from ${short(u?.name, 60) || 'a user'}`,
      lines: [f.message, `From: ${who}`, `Screen: ${f.page || 'unknown'}`, `Device: ${f.device || 'unknown'}`],
      note: f.reply && u?.email ? 'Reply to this email to answer them.' : 'They asked not to be contacted about this.',
    }, f.reply ? u?.email : undefined)
  } catch (e) {
    console.error('feedback mail failed', e.message)
    return res.status(502).json({ error: 'Could not send it right now. Your text is still here, please try again.' })
  }
  res.json({ ok: true })
}
