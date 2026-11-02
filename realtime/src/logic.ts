// Pure room logic, tested without the Workers runtime.
import { clientMsg, PROTOCOL_VERSION, ROLES, type ClientMsg } from '@desker/shared'
import { verifyToken } from '@desker/shared/src/token.js'

export const MAX_MESSAGE_BYTES = 4096
export const ABUSE = { limit: 10, windowMs: 60_000 } // this many bad messages in a minute disconnects the client

/** JSON text -> a valid ClientMsg, or null (too big, not JSON, or not in the schema). */
export function parseClient(raw: string | ArrayBuffer): ClientMsg | null {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return null
  try { const r = clientMsg.safeParse(JSON.parse(raw)); return r.success ? r.data : null } catch { return null }
}

export type Hello = { ok: true; claims: { sub: string; vid: string; role: string; n?: string; c?: string; d?: string; s?: string; bl?: string[]; sm?: number } } | { ok: false; code: 'version' | 'auth'; message: string }
export async function checkHello(msg: Extract<ClientMsg, { t: 'hello' }>, villageId: string, secret: string | undefined, now = Date.now()): Promise<Hello> {
  if (msg.v !== PROTOCOL_VERSION) return { ok: false, code: 'version', message: 'Kodama Village was updated. Please refresh the page.' }
  const r = await verifyToken(msg.token, secret, villageId, now)
  // a 'revoke' token (API -> room) is not a login: only real roles get in
  return r.ok && ROLES.includes(r.claims.role) ? { ok: true, claims: r.claims } : { ok: false, code: 'auth', message: 'Could not sign you in to this village. Please refresh the page.' }
}

/** Counts a bad message in a sliding minute. disconnect = true once the limit is hit. */
export function countBad(a: { bad: number; badAt: number }, now = Date.now()): { bad: number; badAt: number; disconnect: boolean } {
  const fresh = now - a.badAt > ABUSE.windowMs
  const bad = (fresh ? 0 : a.bad) + 1
  return { bad, badAt: fresh ? now : a.badAt, disconnect: bad >= ABUSE.limit }
}
