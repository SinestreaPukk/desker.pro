// Server-side move validation (SPEC §3.5): loose enough not to lag, strict enough to stop cheating. Pure, so it is tested.
// The client sends at most MOVE_SEND_MAX_HZ updates, so one update may cover several tiles (running is ~11 tiles/s). Each tile of walking costs one
// token; tokens refill at run speed + 20%, up to a small burst. A target must be reachable by walking within the tokens we have.
import { MOVE_SPEED_TOLERANCE, RUN_MS_PER_TILE } from './constants.ts'
import type { Dir } from './types.ts'
import { step, walkable, type World } from './world.ts'

export const MOVE_BURST = 3
export interface Mover { x: number; y: number; dir: Dir; tokens: number; at: number }
export const newMover = (x: number, y: number, now: number, dir: Dir = 'down'): Mover => ({ x, y, dir, tokens: MOVE_BURST, at: now })

/** Walking distance from (x,y) to (tx,ty) if it is at most `max` steps, else -1. */
export function pathLength(w: World, x: number, y: number, tx: number, ty: number, max: number): number {
  if (!walkable(w, tx, ty)) return -1
  if (x === tx && y === ty) return 0
  let frontier: [number, number][] = [[x, y]]
  const seen = new Set([y * w.w + x])
  for (let d = 1; d <= max; d++) {
    const next: [number, number][] = []
    for (const [cx, cy] of frontier) for (const dir of ['up', 'down', 'left', 'right'] as Dir[]) {
      const n = step(w, cx, cy, dir)
      if (!n || seen.has(n.y * w.w + n.x)) continue
      if (n.x === tx && n.y === ty) return d
      seen.add(n.y * w.w + n.x); next.push([n.x, n.y])
    }
    frontier = next
  }
  return -1
}

export type MoveResult = { ok: true; mover: Mover; steps: number } | { ok: false; mover: Mover }
export function applyMove(w: World, m: Mover, to: { x: number; y: number; dir: Dir }, now: number): MoveResult {
  const tokens = Math.min(MOVE_BURST, m.tokens + ((now - m.at) * MOVE_SPEED_TOLERANCE) / RUN_MS_PER_TILE)
  const steps = pathLength(w, m.x, m.y, to.x, to.y, Math.floor(tokens))
  if (steps < 0) return { ok: false, mover: { ...m, tokens, at: now } }
  return { ok: true, steps, mover: { x: to.x, y: to.y, dir: to.dir, tokens: tokens - steps, at: now } }
}
