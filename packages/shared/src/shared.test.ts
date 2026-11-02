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
import { reconnectDelay } from './constants.ts'
test('reconnect backoff doubles from 0.5 s up to 8 s', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 20].map(reconnectDelay), [500, 1000, 2000, 4000, 8000, 8000, 8000])
})

test('appearanceFor: stable per person, varied across people, outfit follows the colour', async () => {
  const { appearanceFor, OUTFIT_TINTS } = await import('./appearance.ts')
  assert.deepEqual(appearanceFor('abc', 'sky'), appearanceFor('abc', 'sky'))
  assert.equal(appearanceFor('abc', 'rose').outfit, OUTFIT_TINTS.rose)
  const looks = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify({ ...appearanceFor('user-' + i, 'snow') })))
  assert.ok(looks.size > 10)
})

import { setKeyOverrides, remapCheck, keysOf } from './keybindings.ts'
test('remap: conflicts and reserved keys are refused, a choice replaces the default', () => {
  setKeyOverrides({})
  assert.equal(remapCheck('focus', 'x'), 'taken:interact')
  assert.equal(remapCheck('focus', 'Escape'), 'reserved')
  assert.equal(remapCheck('focus', 'ArrowUp'), 'reserved')
  assert.equal(remapCheck('focus', 'k'), null)
  setKeyOverrides({ focus: 'k' })
  assert.deepEqual(keysOf('focus'), ['k']); assert.equal(actionOf('k', false), 'focus'); assert.equal(actionOf('f', false), null)
  assert.equal(remapCheck('board', 'k'), 'taken:focus'); assert.equal(remapCheck('focus', 'f'), null)
  setKeyOverrides({})
})
