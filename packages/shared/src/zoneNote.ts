// The little note shown when you walk into a zone (Phase 1 CP4): at most once a minute per zone.
import type { ZoneId } from './types.ts'

export const ZONE_NOTE: Record<ZoneId, string> = {
  plaza: 'Board Plaza', library: 'Library · quiet zone', tables: 'Group Tables · chat stays at your table', lounge: 'Lounge', garden: 'Garden',
}
export const ZONE_NOTE_GAP_MS = 60_000
/** The text to show for entering `zone` now, or null if that zone was announced less than a minute ago. `last` is updated in place. */
export function zoneNote(last: Partial<Record<ZoneId, number>>, zone: ZoneId, now: number): string | null {
  const at = last[zone]
  if (at !== undefined && now - at < ZONE_NOTE_GAP_MS) return null
  last[zone] = now
  return ZONE_NOTE[zone]
}
