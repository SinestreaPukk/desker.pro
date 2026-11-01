// Everything about bubbles that can be decided without a network (SPEC §6.3). The room calls these; the tests pin the rules down.
import { BUBBLE_HINT_RADIUS_TILES, BUBBLE_MAX_CHARS, BUBBLE_RADIUS_TILES, BUBBLE_RATE_LIMIT } from './constants.ts'
import type { ZoneId } from './types.ts'
import { maskBadWords } from './wordfilter.ts'

const INVISIBLE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]', 'g') // control, zero-width and direction-override characters
/** Plain text only: control characters out, whitespace tidied, capped, bad words masked. Empty string means "nothing to say". */
export function cleanBubble(raw: string): string {
  const t = raw.replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim()
  return maskBadWords([...t].slice(0, BUBBLE_MAX_CHARS).join(''))
}

/** Which of `names` are @mentioned. "@Ann" matches Ann but not Anna; longer names are tried first so "@Test Friend" is not read as "@Test". Case-insensitive. */
export function parseMentions(text: string, names: string[]): string[] {
  const hay = text.toLocaleLowerCase(), found = new Set<string>()
  for (const name of [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    const needle = '@' + name.toLocaleLowerCase()
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
      const next = hay.slice(i + needle.length)[0]
      if (!next || !/[\p{L}\p{N}_]/u.test(next)) { found.add(name); break }
    }
  }
  return [...found]
}

export interface Party { x: number; y: number; zone: ZoneId; table: number | null } // table = the group table you are seated at, if any
export type Verdict = 'full' | 'hint' | 'queued' | 'none'
/** What a receiver gets of a sender's bubble. Rules in order: table seats, then the Library, then distance. */
export function visibility(s: Party, r: Party, mentioned: boolean): Verdict {
  if (s.table != null) return r.table === s.table ? 'full' : 'none' // 1. from a table seat: only people at that table
  if (s.zone === 'library' || r.zone === 'library') return mentioned ? (r.zone === 'library' ? 'queued' : 'full') : 'none' // 2. quiet: only @mentions, held for people studying
  const d = Math.hypot(s.x - r.x, s.y - r.y) // 3 and 4. everyone else by distance between tile centres
  return d <= BUBBLE_RADIUS_TILES ? 'full' : d <= BUBBLE_HINT_RADIUS_TILES ? 'hint' : 'none'
}

/** Sliding-window limiter: `times` are the sender's recent bubble times (ms). Returns whether this one is allowed and the new list. */
export function rateCheck(times: number[], now: number, { count, perMs } = BUBBLE_RATE_LIMIT): { ok: boolean; times: number[] } {
  const recent = times.filter((t) => now - t < perMs)
  return recent.length >= count ? { ok: false, times: recent } : { ok: true, times: [...recent, now] }
}
