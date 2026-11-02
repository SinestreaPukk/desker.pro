// Decorating (Phase 2, checkpoint 1): the template map plus a list of placements. One pure function decides every edit, so the room, the tests and
// the client's green/red ghost agree. State is replaced, never mutated, so a refused edit leaves nothing behind.
import { DECOR, SIGN_MAX_CHARS, type Decor } from './decor.ts'
import { inBounds, reachable, type Spot, type World } from './world.ts'
import type { Dir } from './types.ts'

export const MAX_PLACEMENTS = 400
export const SNAPSHOT_EVERY = 50
export type Rotation = 0 | 90 | 180 | 270
export interface Placement { id: string; decorId: string; x: number; y: number; rotation: Rotation; by: string; text?: string }
export type MapOp = { k: 'put'; p: Placement } | { k: 'del'; id: string }
export type Edit =
  | { t: 'place'; decorId: string; x: number; y: number; rotation: Rotation }
  | { t: 'remove'; placementId: string }
  | { t: 'move'; placementId: string; x: number; y: number }
  | { t: 'rotate'; placementId: string; rotation: Rotation }
  | { t: 'text'; placementId: string; text: string } // signs only; the room filters it like a bubble first
export type Refusal = 'permission' | 'unknown_item' | 'rotation' | 'gone' | 'bounds' | 'wall' | 'protected' | 'overlap' | 'occupied' | 'blocks_path' | 'limit' | 'stale' | 'not_sign'
/** What the person sees when an edit is refused. */
export const REFUSAL_TEXT: Record<Refusal, string> = {
  permission: 'You cannot build in this village', unknown_item: 'That item does not exist', rotation: 'That item cannot turn that way', gone: 'That item is already gone', bounds: 'Outside the village',
  wall: 'Something is in the way', protected: 'Keep this spot clear', overlap: 'Something is already there', occupied: 'A friend is standing there',
  blocks_path: 'Blocks the path', limit: 'This village is full of decorations', stale: 'Someone just changed that spot', not_sign: 'Only signs have text',
}
/** Reasons only the room or the connection can give. */
export const ROOM_REFUSAL_TEXT: Record<string, string> = { focusing: 'Finish your timer to decorate', save_failed: 'Could not save. Try again', unavailable: 'Decorating is not available right now', permission: REFUSAL_TEXT.permission, text: 'That text is not allowed' }

export interface MapState {
  base: World; keep: ReadonlySet<number>; placements: ReadonlyMap<string, Placement>; version: number
  tileVer: ReadonlyMap<number, number> // tile -> version that last changed it (conflict detection); tiles never touched since load count as `loaded`
  loaded: number; world: World
}

const rot = (d: Dir, r: Rotation): Dir => { const o: Dir[] = ['up', 'right', 'down', 'left']; return o[(o.indexOf(d) + r / 90) % 4] }
export function footprint(p: Pick<Placement, 'decorId' | 'x' | 'y' | 'rotation'>, d: Decor = DECOR[p.decorId]) {
  const swap = p.rotation === 90 || p.rotation === 270
  return { x: p.x, y: p.y, w: swap ? d.h : d.w, h: swap ? d.w : d.h }
}
const tilesIn = (f: { x: number; y: number; w: number; h: number }, W: number) => { const t: number[] = []; for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) t.push(y * W + x); return t }
/** Sit spots a placed item adds, rotated with it. Ids are `d:<placement>:<n>`. */
function spotsOf(p: Placement, d: Decor): Spot[] {
  return (d.sit ?? []).map((s, i) => {
    const r = p.rotation / 90 // quarter turns clockwise inside the unrotated w x h box
    let dx = s.dx, dy = s.dy, w = d.w, h = d.h
    for (let k = 0; k < r; k++) { [dx, dy, w, h] = [h - 1 - dy, dx, h, w] }
    return { id: `d:${p.id}:${i}`, x: p.x + dx, y: p.y + dy, kind: 'cushion', facing: rot(s.facing, p.rotation) }
  })
}

/** The walkable world: the template with every non-walkable placement blocking its tiles and every sit spot of a placement added. */
export function buildWorld(base: World, placements: Iterable<Placement>): World {
  const blocked = base.blocked.slice(), sitSpots = [...base.sitSpots]
  for (const p of placements) {
    const d = DECOR[p.decorId]; if (!d) continue
    if (!d.walkable) for (const t of tilesIn(footprint(p, d), base.w)) blocked[t] = 1
    sitSpots.push(...spotsOf(p, d))
  }
  return { ...base, blocked, sitSpots }
}

/** Tiles nobody may build on: the Board and doors with a one-tile ring, spawn points, and the template's own sit spots. */
export function protectedTiles(base: World): Set<number> {
  const s = new Set<number>(), add = (x: number, y: number) => { if (inBounds(base, x, y)) s.add(y * base.w + x) }
  for (const o of base.interactables) for (let y = o.y - 1; y < o.y + o.h + 1; y++) for (let x = o.x - 1; x < o.x + o.w + 1; x++) add(x, y)
  for (const p of base.spawns) add(p.x, p.y)
  for (const p of base.sitSpots) add(p.x, p.y)
  return s
}

export function newState(base: World, placements: Placement[] = [], version = 0): MapState {
  return { base, keep: protectedTiles(base), placements: new Map(placements.map((p) => [p.id, p])), version, tileVer: new Map(), loaded: version, world: buildWorld(base, placements) }
}

/** Groups of tiles that each need at least one reachable member: every spawn, sit spot, door/board and zone, keyed so before and after can be compared. */
function needs(w: World): Map<string, number[]> {
  const g = new Map<string, number[]>(), at = (x: number, y: number) => y * w.w + x, open = (x: number, y: number) => inBounds(w, x, y) && !w.blocked[at(x, y)]
  const ring = (x0: number, y0: number, x1: number, y1: number) => { const t: number[] = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (open(x, y)) t.push(at(x, y)); return t }
  w.spawns.forEach((p, i) => g.set(`spawn:${i}`, [at(p.x, p.y)]))
  for (const s of w.sitSpots) g.set(`spot:${s.id}`, [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([a, b]) => open(s.x + a, s.y + b)).map(([a, b]) => at(s.x + a, s.y + b)))
  w.interactables.forEach((o, i) => g.set(`int:${i}`, ring(o.x - 1, o.y - 1, o.x + o.w, o.y + o.h)))
  for (const z of w.zones) g.set(`zone:${z.id}`, ring(z.x, z.y, z.x + z.w - 1, z.y + z.h - 1))
  return g
}
/** True if the new world still reaches everything the old one did, walking from the first spawn. (A group that was unreachable before does not count.) */
function keepsPaths(before: World, after: World): boolean {
  const from = before.spawns[0], ok = (w: World) => { const r = reachable(w, from.x, from.y); return new Map([...needs(w)].map(([k, t]) => [k, t.some((x) => r.has(x))])) }
  const was = ok(before), now = ok(after)
  return [...was].every(([k, good]) => !good || now.get(k) !== false)
}

export interface Actor { id: string; canBuild: boolean }
export interface Opts { newId?: () => string; occupied?: (tile: number) => boolean } // occupied: is someone standing on this tile?
export type EditResult = { ok: true; ops: MapOp[] } | { ok: false; reason: Refusal }

/** Decide one edit. `baseVersion` is the map version the person was looking at. */
export function checkEdit(st: MapState, e: Edit, actor: Actor, baseVersion: number, o: Opts = {}): EditResult {
  const no = (reason: Refusal): EditResult => ({ ok: false, reason })
  if (!actor.canBuild) return no('permission')
  const W = st.base.w
  const old = e.t === 'place' ? undefined : st.placements.get(e.placementId)
  if (e.t !== 'place' && !old) return no('gone')
  let next: Placement | undefined
  if (e.t === 'place') {
    if (!DECOR[e.decorId]) return no('unknown_item')
    if (st.placements.size >= MAX_PLACEMENTS) return no('limit')
    next = { id: (o.newId ?? (() => crypto.randomUUID()))(), decorId: e.decorId, x: e.x, y: e.y, rotation: e.rotation, by: actor.id }
  } else if (e.t === 'move') next = { ...old!, x: e.x, y: e.y }
  else if (e.t === 'rotate') next = { ...old!, rotation: e.rotation }
  else if (e.t === 'text') {
    if (DECOR[old!.decorId]?.interact !== 'sign') return no('not_sign')
    const text = e.text.trim().slice(0, SIGN_MAX_CHARS); next = { ...old!, text: text || undefined }
  }
  const touched = new Set<number>()
  if (old) for (const t of tilesIn(footprint(old), W)) touched.add(t)
  if (next) {
    const d = DECOR[next.decorId]; if (!d) return no('unknown_item')
    if (!d.rot.includes(next.rotation)) return no('rotation')
    const f = footprint(next, d)
    if (f.x < 0 || f.y < 0 || f.x + f.w > st.base.w || f.y + f.h > st.base.h) return no('bounds')
    const mine = tilesIn(f, W)
    if (!d.walkable) for (const t of mine) if (st.keep.has(t)) return no('protected') // before 'wall': a desk seat is both, and "keep this clear" is the useful answer
    for (const t of mine) { touched.add(t); if (st.base.blocked[t]) return no('wall') }
    for (const q of st.placements.values()) {
      if (q.id === next.id) continue
      const qd = DECOR[q.decorId]; if (!qd || qd.layer !== d.layer) continue // a lantern on a rug or lights over a path are fine; two rugs, or two pieces of furniture, are not
      const qt = new Set(tilesIn(footprint(q, qd), W)); if (mine.some((t) => qt.has(t))) return no('overlap')
    }
    if (!d.walkable && o.occupied && mine.some(o.occupied)) return no('occupied')
  }
  for (const t of touched) if ((st.tileVer.get(t) ?? st.loaded) > baseVersion) return no('stale')
  const ops: MapOp[] = e.t === 'remove' ? [{ k: 'del', id: old!.id }] : [{ k: 'put', p: next! }]
  if (next && !DECOR[next.decorId].walkable) { // anything that adds a blocker (or moves one) must leave every place reachable
    const after = apply(st, ops, st.version + 1)
    if (!keepsPaths(st.world, after.world)) return no('blocks_path')
  }
  return { ok: true, ops }
}

/** The state after `ops` as map version `version`. */
export function apply(st: MapState, ops: MapOp[], version: number): MapState {
  const placements = new Map(st.placements), tileVer = new Map(st.tileVer), W = st.base.w
  const mark = (p: Placement) => { const d = DECOR[p.decorId]; if (d) for (const t of tilesIn(footprint(p, d), W)) tileVer.set(t, version) }
  for (const op of ops) {
    if (op.k === 'del') { const p = placements.get(op.id); if (p) { mark(p); placements.delete(op.id) } }
    else { const p = placements.get(op.p.id); if (p) mark(p); placements.set(op.p.id, op.p); mark(op.p) }
  }
  return { ...st, placements, tileVer, version, world: buildWorld(st.base, placements.values()) }
}

/** The ops that turn the current placements into a snapshot's (restore). One version, however many ops. */
export function restoreOps(st: MapState, target: Placement[]): MapOp[] {
  const want = new Map(target.map((p) => [p.id, p])), ops: MapOp[] = []
  for (const id of st.placements.keys()) if (!want.has(id)) ops.push({ k: 'del', id })
  for (const p of target) { const c = st.placements.get(p.id); if (!c || c.decorId !== p.decorId || c.x !== p.x || c.y !== p.y || c.rotation !== p.rotation || c.text !== p.text) ops.push({ k: 'put', p }) }
  return ops
}
