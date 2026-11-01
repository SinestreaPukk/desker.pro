import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseMap, walkable, approaches, type World } from './world.ts'
import { findPath, clickRoute } from './pathfinding.ts'

const real = parseMap(JSON.parse(readFileSync(new URL('../../../apps/village/public/maps/snowy_campus.json', import.meta.url), 'utf8')))
// a tiny map: '#' is a wall
const grid = (rows: string[]): World => ({ w: rows[0].length, h: rows.length, blocked: Uint8Array.from(rows.join('').split('').map((c) => (c === '#' ? 1 : 0))), zones: [], sitSpots: [], spawns: [], interactables: [] })
const turns = (p: { x: number; y: number }[], from: { x: number; y: number }) => { let t = 0, d = '', px = from.x, py = from.y; for (const s of p) { const nd = `${s.x - px},${s.y - py}`; if (d && nd !== d) t++; d = nd; px = s.x; py = s.y } return t }

test('open ground: the shortest length, ending on the goal, one turn at most', () => {
  const w = grid(['........', '........', '........', '........'])
  const p = findPath(w, { x: 0, y: 0 }, { x: 5, y: 3 })!
  assert.equal(p.length, 8); assert.deepEqual(p.at(-1), { x: 5, y: 3 }); assert.ok(turns(p, { x: 0, y: 0 }) <= 1, 'no staircase')
})
test('goes round a wall; no route gives null; standing on the goal gives an empty route', () => {
  const w = grid(['..#..', '..#..', '..#..', '.....'])
  assert.equal(findPath(w, { x: 0, y: 0 }, { x: 4, y: 0 })!.length, 10)
  const sealed = grid(['..#..', '..#..'])
  assert.equal(findPath(sealed, { x: 0, y: 0 }, { x: 4, y: 0 }), null)
  assert.deepEqual(findPath(w, { x: 1, y: 1 }, { x: 1, y: 1 }), [])
  assert.equal(findPath(w, { x: 0, y: 0 }, { x: 2, y: 0 }), null) // the goal itself is a wall
})
test('every step is one tile, on walkable ground, in the real campus', () => {
  const from = real.spawns[0], to = real.spawns[5]
  const p = findPath(real, from, to)!; assert.ok(p.length > 0)
  let px = from.x, py = from.y
  for (const s of p) { assert.equal(Math.abs(s.x - px) + Math.abs(s.y - py), 1); assert.ok(walkable(real, s.x, s.y)); px = s.x; py = s.y }
})
test('click a wall: you go to the nearest tile you can reach', () => {
  const w = grid(['.....', '.###.', '.....'])
  const p = clickRoute(w, { x: 0, y: 0 }, { x: 2, y: 1 })!
  assert.ok(p.length > 0 && walkable(w, p.at(-1)!.x, p.at(-1)!.y)); assert.equal(Math.abs(p.at(-1)!.x - 2) + Math.abs(p.at(-1)!.y - 1), 1)
})
test('click outside the map or an unreachable island: nothing', () => {
  assert.equal(clickRoute(real, real.spawns[0], { x: -1, y: 3 }), null)
  const w = grid(['..#..', '..#..'])
  assert.equal(clickRoute(w, { x: 0, y: 0 }, { x: 4, y: 0 }), null) // the far side is cut off
})
test('click a desk (free or taken): you end up on a tile beside it', () => {
  const desk = real.sitSpots.find((s) => s.kind === 'desk')!, from = real.spawns[0]
  const p = clickRoute(real, from, { x: desk.x, y: desk.y })!
  const end = p.at(-1)!
  assert.ok(approaches(real, desk).some((t) => t.x === end.x && t.y === end.y))
})
test('people in the way can be walked around', () => {
  const w = grid(['.....', '.....', '.....'])
  const people = new Set([1 * 5 + 2]) // someone standing at (2,1)
  const p = findPath(w, { x: 0, y: 1 }, { x: 4, y: 1 }, people)!
  assert.ok(!p.some((s) => s.x === 2 && s.y === 1)); assert.equal(p.length, 6)
})
