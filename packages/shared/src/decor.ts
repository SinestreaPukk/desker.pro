// The decor catalogue as the logic sees it, read from decor.manifest.json (the one source: art, database seed and rules all derive from it).
import type { Dir } from './types.ts'
import manifest from './decor.manifest.json' with { type: 'json' }

export const DECOR_CATEGORIES = ['study', 'cosy', 'nature', 'lights', 'signs', 'seasonal'] as const
export type DecorCategory = (typeof DECOR_CATEGORIES)[number]
export interface Decor {
  id: string; name: { en: string; th: string }; cat: DecorCategory; w: number; h: number
  walkable: boolean
  layer: 'floor' | 'object' | 'over' // things on different layers may share a tile (a lantern on a rug, string lights over a path); the same layer may not
  rot: number[] // the rotations the art exists for; rotating to anything else is refused
  sit?: { dx: number; dy: number; facing: Dir }[] // offsets from the item's top-left corner, as drawn at rotation 0
  interact: 'none' | 'light' | 'sign' | 'pennant'
  price: number // Leaves
  season: null | 'winter' | 'spring' | 'exam'
  frames: number // 2 = a small idle animation
}
export const DECOR_LIST = manifest.items as Decor[]
export const DECOR: Record<string, Decor> = Object.fromEntries(DECOR_LIST.map((d) => [d.id, d]))
/** The longest sign text (filtered like a bubble before it is stored). */
export const SIGN_MAX_CHARS = 40
