// How a villager looks: tints for skin, outfit and hair, plus a hair style. For now it is derived from the user id so friends look different;
// the avatar customiser (a later phase) will store a chosen Appearance per member and pass it to the same renderer.
import type { Colour } from './types.ts'

export interface Appearance { skin: number; outfit: number; hair: number; hairStyle: 'short' | 'long' }
export const SKIN_TONES = [0xf6d5bd, 0xeab98f, 0xc98e63, 0xa46a45, 0x7a4a30]
export const HAIR_COLOURS = [0x2a2230, 0x5a3a28, 0x8a5a32, 0xc9a24a, 0xb84a3a, 0x9aa3b5]
export const OUTFIT_TINTS: Record<Colour, number> = { snow: 0xf2f5fa, sky: 0x8fb8ee, moss: 0x86b985, rose: 0xf0a0b4, amber: 0xf2c46d, plum: 0xb49ae0 }

const hash = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7)
export function appearanceFor(userId: string, colour: Colour): Appearance {
  const h = hash(userId)
  return { skin: SKIN_TONES[h % SKIN_TONES.length], hair: HAIR_COLOURS[(h >>> 4) % HAIR_COLOURS.length], hairStyle: (h >>> 9) % 2 ? 'long' : 'short', outfit: OUTFIT_TINTS[colour] }
}
