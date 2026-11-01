import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveFn } from '../scripts/dev-api.js'

const api = new URL('../api', import.meta.url).pathname
test('resolveFn: exact, catch-all, and unknown', () => {
  assert.match(resolveFn(api, '/api/state'), /api\/state\.js$/)
  assert.match(resolveFn(api, '/api/v1/tasks'), /api\/v1\/tasks\.js$/)
  assert.match(resolveFn(api, '/api/auth/x'), /api\/auth\/\[\.\.\.all\]\.js$/)
  assert.match(resolveFn(api, '/api/auth/get-session'), /\[\.\.\.all\]\.js$/)
  assert.equal(resolveFn(api, '/api/nope'), null)
})
