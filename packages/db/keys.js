// Temporary join keys and slugs (Phase 0; Phase 1 replaces keys with village_invite). Pure, so it is tested without a database.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const newKey = () => randomBytes(18).toString('base64url') // 24 chars
export const hashKey = (k) => createHash('sha256').update(String(k)).digest('hex')
export function keyMatches(key, hash) {
  if (typeof key !== 'string' || typeof hash !== 'string' || key.length < 8 || key.length > 64) return false
  const a = Buffer.from(hashKey(key)), b = Buffer.from(hash)
  return a.length === b.length && timingSafeEqual(a, b)
}
export const slugify = (name) => `${String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'village'}-${randomBytes(2).toString('hex')}`
