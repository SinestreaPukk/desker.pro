// Emotes and knocks: the rules that need no network (Phase 1 CP3). The room applies them; the tests pin them down.
import { BUBBLE_RADIUS_TILES, KNOCK_COOLDOWN_MS } from './constants.ts'
import type { Party } from './bubbles.ts'

export const EMOTES = [
  { id: 1, glyph: '👋', label: 'Wave' }, { id: 2, glyph: '🎉', label: 'Cheer' }, { id: 3, glyph: '☕', label: 'Coffee' }, { id: 4, glyph: '😴', label: 'Sleepy' },
  { id: 5, glyph: '😕', label: 'Confused' }, { id: 6, glyph: '🍀', label: 'Good luck' }, { id: 7, glyph: '👍', label: 'Thumbs up' }, { id: 8, glyph: '🤫', label: 'Shh' },
] as const
export const WAVE = 1

/** Who sees an emote. Same rules as bubbles (table seats, then distance) except that emotes are silent, so they show in the Library too.
 *  Someone in Do Not Disturb sees nothing; the person an emote is aimed at sees it from anywhere (unless in DND). */
export function emoteVisible(s: Party, r: Party, opts: { receiverDnd: boolean; aimedAtReceiver: boolean }): boolean {
  if (opts.receiverDnd) return false
  if (opts.aimedAtReceiver) return true
  if (s.table != null) return r.table === s.table
  return Math.hypot(s.x - r.x, s.y - r.y) <= BUBBLE_RADIUS_TILES
}

export type KnockResult = 'deliver' | 'queue' | 'dnd' | 'slow' | 'gone'
/** What happens to a knock. `last` = when this sender last knocked this target. DND drops it (the knocker is told); focusing holds it; otherwise it is delivered. */
export function knockResult(t: { present: boolean; dnd: boolean; focusing: boolean }, last: number | undefined, now: number): KnockResult {
  if (!t.present) return 'gone'
  if (last !== undefined && now - last < KNOCK_COOLDOWN_MS) return 'slow'
  return t.dnd ? 'dnd' : t.focusing ? 'queue' : 'deliver'
}
