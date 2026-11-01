import test from 'node:test'
import assert from 'node:assert/strict'
import { safeRedirect } from './redirect.ts'
import { actionOf } from './keybindings.ts'
import { clientMsg, serverMsg } from './protocol.ts'

test('safeRedirect only allows *.desker.dev / *.desker.test', () => {
  assert.ok(safeRedirect('https://village.desker.dev/v/den'))
  assert.ok(safeRedirect('http://village.desker.test:5174/'))
  for (const bad of ['https://desker.dev.evil.com/', 'https://evildesker.dev/', 'https://evil.com/?village.desker.dev', 'javascript:alert(1)', '//village.desker.dev', 'nope', null])
    assert.equal(safeRedirect(bad), null, String(bad))
})
test('game keys are ignored while typing', () => {
  assert.equal(actionOf('w', false), 'up')
  assert.equal(actionOf('W', false), 'up')
  assert.equal(actionOf('w', true), null)
  assert.equal(actionOf('q', false), null) // phase 1 key
})
test('protocol drops bad messages', () => {
  assert.ok(clientMsg.safeParse({ t: 'move', x: 1, y: 2, dir: 'up', seq: 0 }).success)
  assert.ok(!clientMsg.safeParse({ t: 'move', x: -1, y: 2, dir: 'up', seq: 0 }).success)
  assert.ok(!clientMsg.safeParse({ t: 'say', text: 'x'.repeat(121) }).success)
  assert.ok(!clientMsg.safeParse({ t: 'nope' }).success)
  assert.ok(serverMsg.safeParse({ t: 'said', userId: 'a', nearbyOnly: true }).success)
})
