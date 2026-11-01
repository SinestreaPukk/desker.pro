import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseMap, walkable, step, stepBy, slide, canSit, spotNear, bodyFree, walkBody, tapRoute, zoneAt, reachable, approaches, tileInFront } from './world.ts'
import { ambientAt, minuteOfDay } from './ambient.ts'

const w = parseMap(JSON.parse(readFileSync(new URL('../../../apps/village/public/maps/snowy_campus.json', import.meta.url), 'utf8')))

test('map: 40x28, 24 desks, 16 table seats, 8 cushions, 8 spawns, 5 zones', () => {
  assert.equal(w.w, 40); assert.equal(w.h, 28)
  assert.equal(w.sitSpots.filter((s) => s.kind === 'desk').length, 24)
  assert.equal(w.sitSpots.filter((s) => s.kind === 'table').length, 16)
  assert.equal(w.sitSpots.filter((s) => s.kind === 'cushion').length, 8)
  assert.equal(w.spawns.length, 8); assert.equal(w.zones.length, 5)
  assert.equal(new Set(w.sitSpots.map((s) => s.id)).size, w.sitSpots.length) // stable, unique ids
  assert.ok(w.sitSpots.some((s) => s.id === 'lib-desk-07') && w.sitSpots.some((s) => s.id === 'table-2-seat-3'))
})
test('collision: walls, desks, chairs and the board block; spawns and the plaza do not', () => {
  assert.ok(!walkable(w, 0, 0) && !walkable(w, 1, 5) && !walkable(w, -1, 3) && !walkable(w, 40, 3))
  assert.ok(!walkable(w, 5, 3) && !walkable(w, 18, 11) && !walkable(w, 19, 12))
  for (const s of w.sitSpots) assert.ok(!walkable(w, s.x, s.y), s.id)
  for (const p of w.spawns) assert.ok(walkable(w, p.x, p.y))
})
test('step: moves onto open tiles, refuses blocked and out-of-bounds ones', () => {
  assert.deepEqual(step(w, 19, 14, 'down'), { x: 19, y: 15 })
  assert.equal(step(w, 19, 13, 'up'), null) // the board
  assert.equal(step(w, 1, 14, 'left'), null)
  assert.deepEqual(tileInFront(5, 5, 'left'), { x: 4, y: 5 })
})
test('zones: library, tables, lounge, garden, plaza and the paths in between', () => {
  assert.equal(zoneAt(w, 5, 5), 'library'); assert.equal(zoneAt(w, 30, 5), 'tables'); assert.equal(zoneAt(w, 5, 22), 'lounge')
  assert.equal(zoneAt(w, 30, 22), 'garden'); assert.equal(zoneAt(w, 19, 14), 'plaza'); assert.equal(zoneAt(w, 12, 14), 'plaza')
})
test('everything is reachable from every spawn, and every seat has a way up to it', () => {
  const seen = reachable(w, w.spawns[0].x, w.spawns[0].y)
  for (const p of w.spawns) assert.ok(seen.has(p.y * w.w + p.x))
  for (const z of w.zones) assert.ok([...seen].some((i) => zoneAt(w, i % w.w, Math.floor(i / w.w)) === z.id), z.id)
  for (const s of w.sitSpots) assert.ok(approaches(w, s).some((a) => seen.has(a.y * w.w + a.x)), `unreachable seat ${s.id}`)
  for (const d of w.interactables.filter((i) => i.kind === 'door')) assert.ok(seen.has(d.y * w.w + d.x), d.name)
})
test('ambient: day is clear, night is dark with lamps, dawn and dusk blend', () => {
  assert.equal(ambientAt(12 * 60).strength, 0); assert.equal(ambientAt(12 * 60).lamps, false)
  assert.equal(ambientAt(23 * 60).strength, 1); assert.equal(ambientAt(23 * 60).lamps, true); assert.equal(ambientAt(3 * 60).lamps, true)
  const dawn = ambientAt(6 * 60 + 15); assert.ok(dawn.strength > 0.4 && dawn.strength < 0.8)
  assert.ok(ambientAt(6 * 60 + 40).strength < dawn.strength) // brightening
  assert.ok(ambientAt(17 * 60 + 45).strength > 0 && ambientAt(17 * 60 + 29).strength === 0)
  assert.equal(ambientAt(1440 + 12 * 60).strength, 0) // wraps
})
test('minuteOfDay uses the given time zone', () => {
  const t = new Date('2026-11-01T05:00:00Z') // 12:00 in Bangkok (UTC+7)
  assert.equal(minuteOfDay(t, 'Asia/Bangkok'), 12 * 60); assert.equal(minuteOfDay(t, 'UTC'), 5 * 60)
})

test('diagonals: allowed in the open, never cut a wall corner, and slide along a wall instead of stopping', () => {
  assert.deepEqual(stepBy(w, 19, 14, 1, 1), { x: 20, y: 15 })
  assert.equal(stepBy(w, 17, 13, 1, -1), null) // up-right would clip the Board's corner at (18,12)
  assert.deepEqual(slide(w, 17, 13, 1, -1), { x: 18, y: 13 }) // so it slides right instead
  assert.deepEqual(slide(w, 17, 12, 1, -1), { x: 17, y: 11 }) // or up, when right is the wall
  assert.equal(slide(w, 19, 13, 0, -1), null)
})
test('sitting: next to a free spot, diagonals count, taken or far spots do not', () => {
  const s = w.sitSpots[0], none = new Set<string>()
  const beside = approaches(w, s)[0]
  assert.equal(canSit(w, beside.x, beside.y, s.id, none)?.id, s.id)
  assert.equal(canSit(w, beside.x, beside.y, s.id, new Set([s.id])), null)
  assert.equal(canSit(w, 19, 14, s.id, none), null); assert.equal(canSit(w, beside.x, beside.y, 'nope', none), null)
  assert.equal(spotNear(w, beside.x, beside.y, 'down', none) != null, true)
  assert.equal(spotNear(w, 19, 14, 'down', none), null)
})

test('free walking: a body slides along a wall, stops at it, and cannot squeeze through the Board', () => {
  const hw = 0.28, hh = 0.2
  assert.ok(bodyFree(w, 19, 14, hw, hh)); assert.ok(bodyFree(w, 19, 13, hw, hh)); assert.ok(!bodyFree(w, 19, 12.6, hw, hh)) // the Board is rows 11-12, so 12.6 would overlap it
  let p = { x: 19, y: 14 }
  for (let i = 0; i < 100; i++) p = walkBody(w, p.x, p.y, 0, -0.05, hw, hh) // push up into the Board
  assert.ok(p.y >= 12.7 && p.y < 14, String(p.y))
  const before = p.x; for (let i = 0; i < 10; i++) p = walkBody(w, p.x, p.y, 0.05, -0.05, hw, hh) // diagonal into the wall: still slides right
  assert.ok(p.x > before + 0.4)
  let q = { x: 19, y: 14 }; for (let i = 0; i < 500; i++) q = walkBody(w, q.x, q.y, 0.04, -0.04, hw, hh); assert.ok(walkable(w, Math.round(q.x), Math.round(q.y)))
})

test('tapRoute: sideways first, then up/down, and it stops at the first blocked tile', () => {
  assert.deepEqual(tapRoute(w, 19, 14, 21, 15), [{ x: 20, y: 14 }, { x: 21, y: 14 }, { x: 21, y: 15 }])
  assert.deepEqual(tapRoute(w, 19, 14, 19, 14), [])
  const toBoard = tapRoute(w, 19, 14, 19, 10) // straight up into the board: stops in front of it
  assert.deepEqual(toBoard, [{ x: 19, y: 13 }])
  assert.deepEqual(tapRoute(w, 1, 14, 0, 14), []) // the first step is a wall
})
