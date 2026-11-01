// Click-to-walk (Phase 1 CP4): A* on the collision grid, 4 directions. Pure, so it is tested without Phaser.
import { approaches, inBounds, reachable, walkable, type Spot, type World } from './world.ts'

export interface Tile { x: number; y: number }
const DIRS: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]]
const TURN = 0.01 // a tiny cost for turning, so ties go to the straighter route instead of a staircase

/** Shortest walkable route from `from` to `to` as the tiles to walk through (not including where you stand), or null if there is none. */
export function findPath(w: World, from: Tile, to: Tile, extraBlocked?: ReadonlySet<number>): Tile[] | null {
  const idx = (x: number, y: number) => y * w.w + x
  const ok = (x: number, y: number) => walkable(w, x, y) && !extraBlocked?.has(idx(x, y))
  if (!ok(to.x, to.y) || !ok(from.x, from.y)) return null
  if (from.x === to.x && from.y === to.y) return []
  // state = tile * 4 + the direction we arrived in
  const g = new Map<number, number>(), prev = new Map<number, number>(), open: { s: number; f: number }[] = [], done = new Set<number>()
  const h = (x: number, y: number) => Math.abs(x - to.x) + Math.abs(y - to.y)
  for (let d = 0; d < 4; d++) { const s = idx(from.x, from.y) * 4 + d; g.set(s, 0); open.push({ s, f: h(from.x, from.y) }) }
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i // ponytail: linear scan is plenty for a 40x28 map; use a heap if maps grow
    const { s } = open.splice(bi, 1)[0]
    if (done.has(s)) continue
    done.add(s)
    const t = s >> 2, d0 = s & 3, x = t % w.w, y = (t - x) / w.w
    if (x === to.x && y === to.y) {
      const out: Tile[] = []
      for (let c: number | undefined = s; c !== undefined; c = prev.get(c)) { const tt = c >> 2; out.push({ x: tt % w.w, y: Math.floor(tt / w.w) }) }
      return out.reverse().slice(1)
    }
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1]
      if (!ok(nx, ny)) continue
      const ns = idx(nx, ny) * 4 + d, cost = g.get(s)! + 1 + (d !== d0 && (x !== from.x || y !== from.y) ? TURN : 0)
      if (cost < (g.get(ns) ?? Infinity)) { g.set(ns, cost); prev.set(ns, s); open.push({ s: ns, f: cost + h(nx, ny) }) }
    }
  }
  return null
}

/** Where a click should take you. A walkable tile: itself. A seat, free or taken: the nearest tile beside it. A wall: the closest tile you can reach. Null if nothing is reachable. */
export function clickRoute(w: World, from: Tile, click: Tile, blockedByPeople?: ReadonlySet<number>): Tile[] | null {
  if (!inBounds(w, click.x, click.y)) return null
  const spot: Spot | undefined = w.sitSpots.find((s) => s.x === click.x && s.y === click.y) // seats are not walkable: you go to a tile beside one (then X sits)
  const reach = reachable(w, from.x, from.y)
  const goals: Tile[] = spot ? approaches(w, spot) : walkable(w, click.x, click.y) ? [click] : []
  if (!goals.length) { // a wall (or nothing around the seat): the nearest reachable tile, searching outward
    let best: Tile | null = null, bd = Infinity
    for (const i of reach) { const x = i % w.w, y = (i - x) / w.w, d = Math.abs(x - click.x) + Math.abs(y - click.y); if (d < bd) { bd = d; best = { x, y } } }
    if (best) goals.push(best)
  }
  let best: Tile[] | null = null
  for (const g of goals) { if (!reach.has(g.y * w.w + g.x)) continue; const p = findPath(w, from, g, blockedByPeople); if (p && (!best || p.length < best.length)) best = p }
  return best
}
