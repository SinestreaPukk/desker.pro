// Pure map logic (no Phaser): collision grid, zone lookup, stepping, reachability. Used by the game, and later by the room to validate moves.
import type { Dir, ZoneId } from './types.ts'

interface TiledObject { name: string; type: string; x: number; y: number; width: number; height: number; properties?: { name: string; value: string | number | boolean }[] }
interface TiledLayer { name: string; type: string; data?: number[]; objects?: TiledObject[] }
export interface TiledMap { width: number; height: number; tilewidth: number; layers: TiledLayer[] }
export interface Spot { id: string; x: number; y: number; kind: string; facing: Dir; table?: number }
export interface Zone { id: ZoneId; x: number; y: number; w: number; h: number; quiet: boolean }
export interface World {
  w: number; h: number; blocked: Uint8Array
  zones: Zone[]; sitSpots: Spot[]; spawns: { x: number; y: number }[]; interactables: { name: string; kind: string; x: number; y: number; w: number; h: number }[]
}

const prop = (o: TiledObject, k: string) => o.properties?.find((p) => p.name === k)?.value
export function parseMap(m: TiledMap): World {
  const T = m.tilewidth, blocked = new Uint8Array(m.width * m.height)
  const objs = (name: string) => m.layers.find((l) => l.name === name)?.objects ?? []
  for (const o of objs('collision')) for (let y = o.y / T; y < (o.y + o.height) / T; y++) for (let x = o.x / T; x < (o.x + o.width) / T; x++) blocked[y * m.width + x] = 1
  return {
    w: m.width, h: m.height, blocked,
    zones: objs('zones').map((o) => ({ id: prop(o, 'zone') as ZoneId, x: o.x / T, y: o.y / T, w: o.width / T, h: o.height / T, quiet: prop(o, 'quiet') === true })),
    sitSpots: objs('sitSpots').map((o) => ({ id: o.name, x: o.x / T, y: o.y / T, kind: String(prop(o, 'kind')), facing: prop(o, 'facing') as Dir, ...(prop(o, 'table') != null && { table: Number(prop(o, 'table')) }) })),
    spawns: objs('spawn').map((o) => ({ x: o.x / T, y: o.y / T })),
    interactables: objs('interactables').map((o) => ({ name: o.name, kind: String(prop(o, 'kind')), x: o.x / T, y: o.y / T, w: o.width / T, h: o.height / T })),
  }
}

export const inBounds = (w: World, x: number, y: number) => x >= 0 && y >= 0 && x < w.w && y < w.h
export const walkable = (w: World, x: number, y: number) => inBounds(w, x, y) && !w.blocked[y * w.w + x]
const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
/** The tile one step in `dir`, or null if it is out of bounds or blocked. (Turning to face a blocked tile is allowed; moving into it is not.) */
export const step = (w: World, x: number, y: number, dir: Dir): { x: number; y: number } | null => {
  const [dx, dy] = DELTA[dir], nx = x + dx, ny = y + dy
  return walkable(w, nx, ny) ? { x: nx, y: ny } : null
}
/** One step by (dx,dy), each -1/0/1. A diagonal needs its target AND both side tiles open (no cutting corners through walls). */
export const stepBy = (w: World, x: number, y: number, dx: number, dy: number): { x: number; y: number } | null =>
  walkable(w, x + dx, y + dy) && (!dx || !dy || (walkable(w, x + dx, y) && walkable(w, x, y + dy))) ? { x: x + dx, y: y + dy } : null
/** What a held-key vector does: the diagonal if open, otherwise slide along whichever axis is open (like Gather), otherwise nothing. */
export const slide = (w: World, x: number, y: number, dx: number, dy: number) =>
  stepBy(w, x, y, dx, dy) ?? (dx && dy ? stepBy(w, x, y, dx, 0) ?? stepBy(w, x, y, 0, dy) : null)
/** Can a body centred at (x,y) (tile-centred coordinates, fractions allowed) stand there? Its four corners must all be on open tiles. */
export function bodyFree(w: World, x: number, y: number, hw: number, hh: number): boolean {
  for (const cx of [x - hw, x + hw]) for (const cy of [y - hh, y + hh]) if (!walkable(w, Math.round(cx), Math.round(cy))) return false
  return true
}
/** Move a body by (dx,dy), one axis at a time so it slides along walls instead of sticking. */
export function walkBody(w: World, x: number, y: number, dx: number, dy: number, hw: number, hh: number): { x: number; y: number } {
  let nx = x, ny = y
  if (dx && bodyFree(w, x + dx, y, hw, hh)) nx = x + dx
  if (dy && bodyFree(w, nx, y + dy, hw, hh)) ny = y + dy
  return { x: nx, y: ny }
}
export const tileInFront = (x: number, y: number, dir: Dir) => ({ x: x + DELTA[dir][0], y: y + DELTA[dir][1] })
/** First zone whose rectangle holds the tile; anywhere else (paths, outdoors) is the plaza. */
export const zoneAt = (w: World, x: number, y: number): ZoneId => w.zones.find((z) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h)?.id ?? 'plaza'
/** Tiles reachable by walking from (x, y). */
export function reachable(w: World, x: number, y: number): Set<number> {
  const seen = new Set<number>([y * w.w + x]), q = [[x, y]]
  while (q.length) {
    const [cx, cy] = q.shift()!
    for (const d of Object.keys(DELTA) as Dir[]) { const n = step(w, cx, cy, d); if (n && !seen.has(n.y * w.w + n.x)) { seen.add(n.y * w.w + n.x); q.push([n.x, n.y]) } }
  }
  return seen
}
/** Walkable tiles next to a sit spot, from which a kodama may sit on it. */
export const approaches = (w: World, s: Spot) => (Object.keys(DELTA) as Dir[]).map((d) => ({ x: s.x + DELTA[d][0], y: s.y + DELTA[d][1] })).filter((t) => walkable(w, t.x, t.y))
/** Where a person appears: one of the 8 spawn points around the Board, stable per person (so server and client agree without talking). */
export const spawnFor = (w: World, userId: string) => w.spawns[[...userId].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % w.spawns.length]

/** The sit spot `spotId` if a person standing at (x,y) may sit there now: it exists, is free, and is on a tile next to them (diagonals count). */
export function canSit(w: World, x: number, y: number, spotId: string, taken: ReadonlySet<string>): Spot | null {
  const s = w.sitSpots.find((p) => p.id === spotId)
  return s && !taken.has(spotId) && Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) <= 1 ? s : null
}
/** The free sit spot next to (x,y), preferring the one in front of `dir`. */
export function spotNear(w: World, x: number, y: number, dir: Dir, taken: ReadonlySet<string>): Spot | null {
  const f = tileInFront(x, y, dir)
  const ahead = w.sitSpots.find((s) => s.x === f.x && s.y === f.y && !taken.has(s.id))
  if (ahead) return ahead
  let best: Spot | null = null, bd = 9
  for (const s of w.sitSpots) { if (taken.has(s.id)) continue; const d = Math.hypot(s.x - x, s.y - y); if (Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) <= 1 && d < bd) { best = s; bd = d } }
  return best
}

/** A phone tap (SPEC Checkpoint 10): walk from tile (fx,fy) to (tx,ty) in straight lines, first sideways then up/down, and stop at the first blocked tile.
 *  Returns the tiles to walk through, in order (empty if the first step is blocked). A* arrives in Phase 1. */
export function tapRoute(w: World, fx: number, fy: number, tx: number, ty: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  let x = fx, y = fy
  for (const [dx, dy, n] of [[Math.sign(tx - fx), 0, Math.abs(tx - fx)], [0, Math.sign(ty - fy), Math.abs(ty - fy)]] as const) {
    for (let i = 0; i < n; i++) { const s = stepBy(w, x, y, dx, dy); if (!s) return out; x = s.x; y = s.y; out.push(s) }
  }
  return out
}
