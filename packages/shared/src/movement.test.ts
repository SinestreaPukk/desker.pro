import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseMap, spawnFor } from './world.ts'
import { applyMove, newMover, pathLength, MOVE_BURST } from './movement.ts'
import { interpolate, trim, tooFar } from './interp.ts'
import { RUN_MS_PER_TILE, MOVE_SEND_MAX_HZ } from './constants.ts'

const w = parseMap(JSON.parse(readFileSync(new URL('../../../apps/village/public/maps/snowy_campus.json', import.meta.url), 'utf8')))
const at0 = 1_000_000

test('pathLength: adjacent is 1, around a wall is longer, a wall or distance is unreachable', () => {
  assert.equal(pathLength(w, 19, 14, 19, 15, 5), 1)
  assert.equal(pathLength(w, 19, 14, 19, 14, 5), 0)
  assert.equal(pathLength(w, 19, 13, 19, 11, 5), -1) // straight through the Board
  assert.equal(pathLength(w, 17, 12, 21, 12, 8), 6) // around the Board: down, across, up
  assert.equal(pathLength(w, 19, 14, 19, 5, 3), -1)
})
test('a normal step, a turn in place, and a 2-tile update are accepted', () => {
  let m = newMover(19, 14, at0)
  let r = applyMove(w, m, { x: 19, y: 15, dir: 'down' }, at0 + 100); assert.ok(r.ok); m = r.mover
  r = applyMove(w, m, { x: 19, y: 15, dir: 'left' }, at0 + 150); assert.ok(r.ok && r.steps === 0)
  r = applyMove(w, r.mover, { x: 19, y: 17, dir: 'down' }, at0 + 300); assert.ok(r.ok && r.steps === 2)
})
test('teleporting, walking through walls and standing in a desk are refused', () => {
  const m = newMover(19, 14, at0)
  assert.ok(!applyMove(w, m, { x: 5, y: 5, dir: 'up' }, at0 + 100).ok)
  assert.ok(!applyMove(w, newMover(19, 13, at0), { x: 19, y: 12, dir: 'up' }, at0 + 100).ok)
  assert.ok(!applyMove(w, m, { x: 5, y: 3, dir: 'up' }, at0 + 100).ok) // a desk tile
  assert.ok(!applyMove(w, m, { x: -1, y: 14, dir: 'left' }, at0 + 100).ok)
})
test('a refused move leaves the position alone, and legit movement afterwards still works', () => {
  const m = newMover(19, 14, at0), r = applyMove(w, m, { x: 30, y: 14, dir: 'right' }, at0 + 50)
  assert.ok(!r.ok && r.mover.x === 19 && r.mover.y === 14)
  assert.ok(applyMove(w, r.mover, { x: 20, y: 14, dir: 'right' }, at0 + 200).ok)
})
test('sustained running at up to 1.2x run speed passes; double speed is caught', () => {
  const walk = (msPerTile: number) => { // along the path row y=14, x=6..31, sending at 10 Hz like the client does
    let m = newMover(6, 14, at0), sent = 6
    for (let t = 100; sent < 31; t += 1000 / MOVE_SEND_MAX_HZ) {
      const x = Math.min(31, 6 + Math.floor(t / msPerTile)); if (x === sent) continue
      const r = applyMove(w, m, { x, y: 14, dir: 'right' }, at0 + t); if (!r.ok) return false
      m = r.mover; sent = x
    }
    return true
  }
  assert.ok(walk(RUN_MS_PER_TILE)); assert.ok(walk(RUN_MS_PER_TILE / 1.15)); assert.ok(!walk(RUN_MS_PER_TILE / 2))
})
test('the burst is capped, so idling does not bank unlimited speed', () => {
  const r = applyMove(w, newMover(16, 14, at0), { x: 20, y: 14, dir: 'right' }, at0 + 3_600_000)
  assert.ok(!r.ok); assert.equal(MOVE_BURST, 3)
})
test('spawnFor is stable and always a walkable spawn point', () => {
  assert.deepEqual(spawnFor(w, 'abc'), spawnFor(w, 'abc'))
  for (const id of ['a', 'b', crypto.randomUUID(), crypto.randomUUID()]) assert.ok(w.spawns.includes(spawnFor(w, id)))
})
test('interpolate: between snapshots, before the first, past the last; direction and moving flag', () => {
  const buf = [{ t: 100, x: 0, y: 0, dir: 'right' as const }, { t: 200, x: 2, y: 0, dir: 'right' as const }]
  assert.deepEqual(interpolate(buf, 150), { x: 1, y: 0, dir: 'right', moving: true })
  assert.equal(interpolate(buf, 50)!.x, 0); assert.equal(interpolate(buf, 999)!.x, 2); assert.equal(interpolate(buf, 999)!.moving, false)
  assert.equal(interpolate([], 5), null)
  const b2 = [...buf, { t: 300, x: 2, y: 1, dir: 'down' as const }]; trim(b2, 250); assert.equal(b2.length, 2)
})
test('tooFar: more than 3 tiles behind snaps', () => { assert.ok(tooFar({ x: 0, y: 0 }, { x: 4, y: 0 })); assert.ok(!tooFar({ x: 0, y: 0 }, { x: 3, y: 0 })) })
