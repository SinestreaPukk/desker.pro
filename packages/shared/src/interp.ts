// Remote kodamas are drawn REMOTE_INTERP_DELAY_MS behind real time, moving smoothly between the positions the server told us about.
import type { Dir } from './types.ts'

export interface Snap { t: number; x: number; y: number; dir: Dir }
export interface Pose { x: number; y: number; dir: Dir; moving: boolean }

/** Position (in tiles, fractional) at render time `rt`. Pure. Snapshots must be in time order. */
export function interpolate(buf: Snap[], rt: number): Pose | null {
  if (!buf.length) return null
  if (rt <= buf[0].t) return { x: buf[0].x, y: buf[0].y, dir: buf[0].dir, moving: false }
  for (let i = 0; i < buf.length - 1; i++) {
    const a = buf[i], b = buf[i + 1]
    if (rt >= a.t && rt < b.t) {
      const f = (rt - a.t) / (b.t - a.t)
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dir: b.dir, moving: a.x !== b.x || a.y !== b.y }
    }
  }
  const z = buf[buf.length - 1]
  return { x: z.x, y: z.y, dir: z.dir, moving: false }
}
/** Drop snapshots older than the one just before `rt`, keeping the buffer short. */
export const trim = (buf: Snap[], rt: number) => { while (buf.length > 2 && buf[1].t <= rt) buf.shift() }
/** Farther behind than this many tiles: snap with a puff of dust instead of gliding. */
export const SNAP_TILES = 3
export const tooFar = (shown: { x: number; y: number }, target: { x: number; y: number }) => Math.hypot(shown.x - target.x, shown.y - target.y) > SNAP_TILES
