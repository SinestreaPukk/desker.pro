import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// shareSession lives inside the auth route (which needs the whole auth stack), so the test lifts its source and runs it on its own.
process.env.COOKIE_DOMAIN = '.desker.dev'
const src = readFileSync(new URL('../api/auth/[...all].js', import.meta.url), 'utf8')
const { shareSession } = new Function('Response', 'Headers', 'URL', 'process', src.slice(src.indexOf('const NAMES'), src.indexOf('const route = ')) + '; return { shareSession }')(Response, Headers, URL, process)
const mk = (cookie) => new Request('https://desker.dev/api/auth/get-session', { headers: cookie ? { cookie } : {} })
const signedIn = () => new Response('{"user":{"id":"1"},"session":{}}')
test('a signed-in browser with one host-only session cookie gets it back scoped to the whole domain', async () => {
  const r = await shareSession(mk('__Secure-better-auth.session_token=abc%2Fdef'), signedIn())
  assert.deepEqual(r.headers.getSetCookie(), ['__Secure-better-auth.session_token=abc%2Fdef; Domain=.desker.dev; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax; Secure'])
})
test('nothing is shared when signed out, without a cookie, or with two session cookies', async () => {
  assert.equal((await shareSession(mk('better-auth.session_token=a'), new Response('null'))).headers.getSetCookie().length, 0)
  assert.equal((await shareSession(mk(''), signedIn())).headers.getSetCookie().length, 0)
  assert.equal((await shareSession(mk('better-auth.session_token=a; better-auth.session_token=b'), signedIn())).headers.getSetCookie().length, 0)
})
