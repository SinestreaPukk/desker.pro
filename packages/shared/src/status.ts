// What the room tells friends about someone's status, from their per-village sharing choice (SPEC §6.2).
import type { Status, StatusSharing } from './types.ts'

/** full: everything. basic: only that they are studying (the generic icon, no course or title). off: nothing. */
export function maskStatus(s: Status, sharing: StatusSharing): Status | null {
  if (sharing === 'off') return null
  if (sharing === 'basic') return { activity: 'other' }
  return s
}
