import test from 'node:test'
import assert from 'node:assert/strict'
import { heldKeys } from './heldKeys.ts'

const V = { none: { dx: 0, dy: 0 }, up: { dx: 0, dy: -1 }, right: { dx: 1, dy: 0 }, left: { dx: -1, dy: 0 } }
const press = (t: EventTarget, type: 'keydown' | 'keyup', key: string, extra = {}) => t.dispatchEvent(Object.assign(new Event(type), { key, shiftKey: false, ...extra }))
test('latest held direction wins; releasing falls back to the one still held', () => {
  const t = new EventTarget(), k = heldKeys(t, () => false)
  press(t, 'keydown', 'w'); assert.deepEqual(k.vec(), V.up)
  press(t, 'keydown', 'ArrowDown'); assert.deepEqual(k.vec(), { dx: 0, dy: 1 }) // same axis: the newer key wins
  press(t, 'keyup', 'ArrowDown'); assert.deepEqual(k.vec(), V.up)
  press(t, 'keyup', 'w'); assert.deepEqual(k.vec(), V.none)
})
test('two keys on different axes make a diagonal; the latest key on an axis wins; letting go of one keeps the other', () => {
  const t = new EventTarget(), k = heldKeys(t, () => false)
  press(t, 'keydown', 'w'); press(t, 'keydown', 'd'); assert.deepEqual(k.vec(), { dx: 1, dy: -1 })
  press(t, 'keydown', 'a'); assert.deepEqual(k.vec(), { dx: -1, dy: -1 }) // a is newer than d on the same axis
  press(t, 'keyup', 'a'); assert.deepEqual(k.vec(), { dx: 1, dy: -1 }) // d is still held
  press(t, 'keydown', 's'); assert.deepEqual(k.vec(), { dx: 1, dy: 1 })
  press(t, 'keyup', 'w'); press(t, 'keyup', 'd'); press(t, 'keyup', 's'); assert.deepEqual(k.vec(), V.none)
})
test('shift runs; ctrl/cmd combos are ignored', () => {
  const t = new EventTarget(), k = heldKeys(t, () => false)
  press(t, 'keydown', 'Shift', { shiftKey: true }); assert.ok(k.run())
  press(t, 'keyup', 'Shift', { shiftKey: false }); assert.ok(!k.run())
  press(t, 'keydown', 'w', { metaKey: true }); assert.deepEqual(k.vec(), V.none)
})
test('keys typed into a text input do not move the kodama', () => {
  const t = new EventTarget(); let typing = true
  const k = heldKeys(t, () => typing)
  for (const key of ['w', 'a', 's', 'd', 'ArrowUp', 'Shift']) press(t, 'keydown', key)
  assert.deepEqual(k.vec(), V.none); assert.ok(!k.run())
  typing = false; press(t, 'keydown', 'a'); assert.deepEqual(k.vec(), V.left)
})
test('focusing an input drops held keys so the kodama stops; a release after that is harmless', () => {
  const t = new EventTarget(), k = heldKeys(t, () => false)
  press(t, 'keydown', 'd'); assert.deepEqual(k.vec(), V.right)
  t.dispatchEvent(new Event('focusin')); assert.deepEqual(k.vec(), V.none)
  press(t, 'keyup', 'd'); assert.deepEqual(k.vec(), V.none)
})
