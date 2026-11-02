// Developer API key and calendar-feed key: random, revocable, stored only as a hash. Replaces using the account id as a secret.
import { createHash, randomBytes } from 'node:crypto'
import { sql } from './_store.js'

export const KINDS = ['api', 'feed']
export const SHAPE = /^dsk_[0-9a-f]{48}$/
export const hashOf = (t) => createHash('sha256').update(t).digest('hex')

// Makes a new token (the old one stops working at once) and returns it. This is the only time it exists in plain text.
export async function rotate(uid, kind) {
  const token = `dsk_${randomBytes(24).toString('hex')}`
  await sql.transaction((t) => [
    t.query('insert into users (id) values ($1) on conflict do nothing', [uid]),
    t.query('insert into api_token (user_id, kind, hash) values ($1, $2, $3) on conflict (user_id, kind) do update set hash = excluded.hash, created_at = now()', [uid, kind, hashOf(token)]),
  ])
  return token
}

export async function userOfToken(token, kind) {
  if (!SHAPE.test(String(token))) return null
  const [row] = await sql.query('select user_id from api_token where hash = $1 and kind = $2', [hashOf(token), kind])
  return row?.user_id ?? null
}
