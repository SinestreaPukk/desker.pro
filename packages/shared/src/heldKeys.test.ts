import test from 'node:test'
import assert from 'node:assert/strict'
import { heldKeys } from './heldKeys.ts'

const press = (t: EventTarget, type: 'keydown' | 'keyup', key: string, extra = {}) => t.dispatchEvent(Object.assign(new Event(type), { key, shiftKey: false, ...extra }))
test('latest held direction wins; releasing falls back to the one still held', () => {
  const t = new EventTarget(), k = heldKeys(t, () => false)
  press(t, 'keydown', 'w'); assert.equal(k.dir(), 'up')
  press(t, 'keydown', 'ArrowRight'); assert.equal(k.dir(), 'right')
  press(t, 'keyup', 'ArrowRight'); assert.equal(k.dir(), 'up')
  press(t, 'keyup', 'w'); assert.equal(k.dir(), undefined)
})
test('shift runs; ctrl/cmd combos are ignored', () => {
  const t = new EventTarget(), k = heldKeys(t, () => false)
  press(t, 'keydown', 'Shift', { shiftKey: true }); assert.ok(k.run())
  press(t, 'keyup', 'Shift', { shiftKey: false }); assert.ok(!k.run())
  press(t, 'keydown', 'w', { metaKey: true }); assert.equal(k.dir(), undefined)
})
test('keys typed into a text input do not move the kodama', () => {
  const t = new EventTarget(); let typing = true
  const k = heldKeys(t, () => typing)
  for (const key of ['w', 'a', 's', 'd', 'ArrowUp', 'Shift']) press(t, 'keydown', key)
  assert.equal(k.dir(), undefined); assert.ok(!k.run())
  typing = false; press(t, 'keydown', 'a'); assert.equal(k.dir(), 'left')
})
test('focusing an input drops held keys so the kodama stops; a release after that is harmless', () => {
  const t = new EventTarget(), k = heldKeys(t, () => false)
  press(t, 'keydown', 'd'); assert.equal(k.dir(), 'right')
  t.dispatchEvent(new Event('focusin')); assert.equal(k.dir(), undefined)
  press(t, 'keyup', 'd'); assert.equal(k.dir(), undefined)
})
