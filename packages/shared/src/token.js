// Room token (SPEC §3.4): HS256 JWT, Web Crypto only, so the same file runs in the Vercel API (sign) and the Cloudflare Worker (verify).
// Claims: sub (user id), vid (village id), role, exp (seconds). Extension to the spec: n (display name) and c (colour), so the room can list
// members without calling the API. They are display-only; permissions come from `role`, which the API read from the database.
const enc = new TextEncoder()
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const key = (secret, usage) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])

export async function signToken(claims, secret, ttlS = 600, now = Date.now()) {
  if (!secret || secret.length < 16) throw new Error('VILLAGE_ROOM_SECRET missing or too short')
  const head = b64(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = b64(enc.encode(JSON.stringify({ ...claims, exp: Math.floor(now / 1000) + ttlS })))
  const sig = await crypto.subtle.sign('HMAC', await key(secret, 'sign'), enc.encode(`${head}.${body}`))
  return `${head}.${body}.${b64(sig)}`
}

/** -> { ok: true, claims } or { ok: false, reason: 'format' | 'signature' | 'expired' | 'village' }. `villageId` must match the claim `vid`. */
export async function verifyToken(token, secret, villageId, now = Date.now()) {
  const parts = typeof token === 'string' && token.length < 2000 ? token.split('.') : []
  if (parts.length !== 3 || !secret) return { ok: false, reason: 'format' }
  let claims
  try {
    const good = await crypto.subtle.verify('HMAC', await key(secret, 'verify'), unb64(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`))
    if (!good) return { ok: false, reason: 'signature' }
    if (JSON.parse(new TextDecoder().decode(unb64(parts[0]))).alg !== 'HS256') return { ok: false, reason: 'signature' }
    claims = JSON.parse(new TextDecoder().decode(unb64(parts[1])))
  } catch { return { ok: false, reason: 'format' } }
  if (!(claims.exp * 1000 > now)) return { ok: false, reason: 'expired' }
  if (claims.vid !== villageId || typeof claims.sub !== 'string') return { ok: false, reason: 'village' }
  return { ok: true, claims }
}
