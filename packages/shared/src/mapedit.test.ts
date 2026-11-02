import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseMap, type World } from './world.ts'
import { apply, buildWorld, checkEdit, newState, restoreOps, MAX_PLACEMENTS, type Edit, type MapState, type Placement } from './mapedit.ts'

const real = parseMap(JSON.parse(readFileSync(new URL('../../../apps/village/public/maps/snowy_campus.json', import.meta.url), 'utf8')))
const me = { id: 'u1', canBuild: true }
let n = 0
const id = () => `p${++n}`
const put = (st: MapState, e: Edit, base = st.version, actor = me) => { const r = checkEdit(st, e, actor, base, { newId: id }); return r.ok ? { st: apply(st, r.ops, st.version + 1), ops: r.ops } : r }
const place = (decorId: string, x: number, y: number, rotation: 0 | 90 | 180 | 270 = 0): Edit => ({ t: 'place', decorId, x, y, rotation })
/** An open tile of the real map that is not protected, with its right neighbour and the one below also free: somewhere to build. */
function freeSpot(st: MapState) { for (let y = 1; y < st.base.h - 2; y++) for (let x = 1; x < st.base.w - 2; x++) { const ok = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [2, 1]].every(([a, b]) => !st.base.blocked[(y + b) * st.base.w + x + a] && !st.keep.has((y + b) * st.base.w + x + a)); if (ok) return { x, y } } throw new Error('no free spot') }
/** A 6x3 corridor: spawn on the left, a "zone" on the right, one tile wide in the middle. */
const corridor = (): World => {
  const w = 7, h = 3, blocked = new Uint8Array(w * h).fill(1)
  for (let x = 0; x < w; x++) blocked[1 * w + x] = 0
  for (const [x, y] of [[0, 0], [0, 2], [6, 0], [6, 2]]) blocked[y * w + x] = 0
  return { w, h, blocked, zones: [{ id: 'garden', x: 5, y: 0, w: 2, h: 3, quiet: false }], sitSpots: [], spawns: [{ x: 0, y: 1 }], interactables: [] }
}

test('place: the item blocks its tiles, and the version moves on', () => {
  let st = newState(real); const f = freeSpot(st)
  const r = put(st, place('lantern', f.x, f.y)); assert.ok('st' in r); st = r.st
  assert.equal(st.version, 1); assert.equal(st.world.blocked[f.y * real.w + f.x], 1); assert.equal(real.blocked[f.y * real.w + f.x], 0)
})
test('place: unknown item, outside the map, on a wall, without permission', () => {
  const st = newState(real), f = freeSpot(st)
  assert.deepEqual(put(st, place('nope', f.x, f.y)), { ok: false, reason: 'unknown_item' })
  assert.deepEqual(put(st, place('lantern', -1, 0)), { ok: false, reason: 'bounds' })
  assert.deepEqual(put(st, place('desk', real.w - 1, 2)), { ok: false, reason: 'bounds' }) // 2 wide, hangs over the edge
  const wall = real.blocked.findIndex((b) => b); assert.deepEqual(put(st, place('rug', wall % real.w, Math.floor(wall / real.w))), { ok: false, reason: 'wall' })
  assert.deepEqual(put(st, place('lantern', f.x, f.y), 0, { id: 'g', canBuild: false }), { ok: false, reason: 'permission' })
})
test('protected: the Board ring, spawns and existing seats refuse furniture', () => {
  const st = newState(real), sp = real.spawns[0]
  assert.deepEqual(put(st, place('lantern', sp.x, sp.y)), { ok: false, reason: 'protected' })
  const seat = real.sitSpots[0]; assert.deepEqual(put(st, place('plant', seat.x, seat.y)), { ok: false, reason: 'protected' })
  const b = real.interactables.find((o) => o.kind === 'board')!; assert.deepEqual(put(st, place('plant', b.x - 1, b.y + b.h)), { ok: false, reason: 'protected' })
})
test('overlap: furniture on furniture refused, a lantern on a rug allowed, two rugs refused', () => {
  let st = newState(real); const f = freeSpot(st)
  st = (put(st, place('rug', f.x, f.y)) as { st: MapState }).st
  const a = put(st, place('lantern', f.x, f.y)); assert.ok('st' in a); st = a.st
  assert.deepEqual(put(st, place('plant', f.x, f.y)), { ok: false, reason: 'overlap' })
  assert.deepEqual(put(st, place('rug', f.x + 1, f.y)), { ok: false, reason: 'overlap' })
})
test('occupied: not on a tile where a friend is standing', () => {
  const st = newState(real), f = freeSpot(st), tile = f.y * real.w + f.x
  assert.deepEqual(checkEdit(st, place('lantern', f.x, f.y), me, 0, { occupied: (t) => t === tile }), { ok: false, reason: 'occupied' })
})
test('limit: 400 placements', () => {
  const many: Placement[] = Array.from({ length: MAX_PLACEMENTS }, (_, i) => ({ id: `m${i}`, decorId: 'rug', x: 0, y: 0, rotation: 0, by: 'u' }))
  assert.deepEqual(put(newState(real, many), place('lantern', freeSpot(newState(real)).x, freeSpot(newState(real)).y)), { ok: false, reason: 'limit' })
})
test('reachability: a lantern in the one-tile corridor is refused, a rug is fine', () => {
  const st = newState(corridor()); st.keep // eslint-disable-line
  assert.deepEqual(put(st, place('lantern', 3, 1)), { ok: false, reason: 'blocks_path' })
  assert.ok('st' in put(st, place('rug', 3, 1)) === false) // 2x2 rug would cover walls: refused for another reason
  const r = put(st, place('rug', 3, 0)); assert.ok(!('st' in r) && r.reason === 'wall')
})
test('reachability: moving a blocker into the corridor is refused too', () => {
  let st = newState(corridor()); st = put(st, { t: 'place', decorId: 'lantern', x: 0, y: 0, rotation: 0 }, 0) as never as MapState
  st = (st as unknown as { st: MapState }).st
  const p = [...st.placements.values()][0]
  assert.deepEqual(put(st, { t: 'move', placementId: p.id, x: 3, y: 1 }), { ok: false, reason: 'blocks_path' })
})
test('rotate, move and remove change the footprint; removing frees the tiles', () => {
  let st = newState(real); const f = freeSpot(st)
  st = (put(st, place('desk', f.x, f.y)) as { st: MapState }).st
  const p = [...st.placements.values()][0], W = real.w
  assert.equal(st.world.blocked[f.y * W + f.x + 1], 1)
  st = (put(st, { t: 'rotate', placementId: p.id, rotation: 90 }) as { st: MapState }).st // now 1 wide, 2 tall
  assert.equal(st.world.blocked[f.y * W + f.x + 1], 0); assert.equal(st.world.blocked[(f.y + 1) * W + f.x], 1)
  st = (put(st, { t: 'remove', placementId: p.id }) as { st: MapState }).st
  assert.equal(st.world.blocked[(f.y + 1) * W + f.x], 0); assert.equal(st.placements.size, 0)
  assert.deepEqual(put(st, { t: 'remove', placementId: p.id }), { ok: false, reason: 'gone' })
})
test('a cushion adds a sit spot that turns with it', () => {
  let st = newState(real); const f = freeSpot(st)
  st = (put(st, place('cushion', f.x, f.y, 90)) as { st: MapState }).st
  const s = st.world.sitSpots.find((q) => q.id.startsWith('d:'))!
  assert.equal(s.x, f.x); assert.equal(s.y, f.y); assert.equal(s.facing, 'left') // 'down' turned 90 degrees clockwise
  assert.equal(buildWorld(real, []).sitSpots.length, real.sitSpots.length)
})
test('concurrent edits: other tiles go through, the same tile is "stale", an edit based on the newest version goes through', () => {
  let st = newState(real); const f = freeSpot(st)
  st = (put(st, place('lantern', f.x, f.y)) as { st: MapState }).st // version 1; both friends were looking at version 0
  const other = put(st, place('plant', f.x + 2, f.y), 0); assert.ok('st' in other) // a different tile
  assert.deepEqual(put(st, place('plant', f.x, f.y), 0), { ok: false, reason: 'overlap' }) // same tile: simply taken (a freed-then-changed tile is 'stale', next test)
})
test('stale beats nothing: a freed tile that was changed after the base version is stale, then fine once the base catches up', () => {
  let st = newState(real); const f = freeSpot(st)
  st = (put(st, place('lantern', f.x, f.y)) as { st: MapState }).st
  const p = [...st.placements.values()][0]
  st = (put(st, { t: 'remove', placementId: p.id }) as { st: MapState }).st // version 2
  assert.deepEqual(put(st, place('plant', f.x, f.y), 1), { ok: false, reason: 'stale' })
  assert.ok('st' in put(st, place('plant', f.x, f.y), 2))
})
test('restore: ops turn today into a snapshot, as one version', () => {
  let st = newState(real); const f = freeSpot(st)
  st = (put(st, place('lantern', f.x, f.y)) as { st: MapState }).st
  const snap = [...st.placements.values()]
  st = (put(st, place('plant', f.x + 2, f.y)) as { st: MapState }).st
  st = (put(st, { t: 'remove', placementId: snap[0].id }) as { st: MapState }).st
  const ops = restoreOps(st, snap); assert.equal(ops.length, 2)
  const back = apply(st, ops, st.version + 1)
  assert.deepEqual([...back.placements.values()], snap); assert.equal(back.version, st.version + 1)
})
