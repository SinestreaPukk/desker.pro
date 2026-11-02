import test from 'node:test'
import assert from 'node:assert/strict'
process.env.COOKIE_DOMAIN = '.desker.dev'
process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32); process.env.DATABASE_URL ??= 'postgres://u:p@localhost/db'; process.env.BETTER_AUTH_URL ??= 'https://desker.dev'
test('cookie healing: expiries come before the real session cookie', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../api/auth/[...all].js', import.meta.url), 'utf8')
  assert.ok(src.indexOf("for (const n of NAMES)") < src.indexOf("for (const c of real)"), 'expire host-only copies first')
  assert.ok(src.includes("Max-Age=0"))
})
