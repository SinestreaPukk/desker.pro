// Study together (Phase 1 CP7): the phase maths for a group session. Pure, used by the API (to end a session that ran out) and by every client (so all show the same clock).
// A session is focus, break, focus, break, ..., focus: `rounds` focus rounds and `rounds - 1` breaks. Times are epoch ms.
export const GROUP_LIMITS = { focusMin: [10, 120], breakMin: [1, 30], rounds: [1, 6] }
export const BREAK_WARNING_MS = 60_000

/** -> { focusMin, breakMin, rounds } with whole numbers inside the limits, or null. */
export function cleanGroup(b) {
  const n = (v, [lo, hi]) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null)
  const focusMin = n(b?.focusMin, GROUP_LIMITS.focusMin), breakMin = n(b?.breakMin, GROUP_LIMITS.breakMin), rounds = n(b?.rounds, GROUP_LIMITS.rounds)
  return focusMin && breakMin && rounds ? { focusMin, breakMin, rounds } : null
}
export const totalMs = (s) => (s.rounds * s.focusMin + (s.rounds - 1) * s.breakMin) * 60_000

/** Where the session is at `now`: { kind: 'focus' | 'break' | 'done', round (1-based), startsAt, endsAt }. 'done' has endsAt = the end of the last round. */
export function phaseAt(s, now) {
  const f = s.focusMin * 60_000, br = s.breakMin * 60_000
  let t = s.startedAt
  for (let r = 1; r <= s.rounds; r++) {
    if (now < t + f) return { kind: 'focus', round: r, startsAt: t, endsAt: t + f }
    t += f
    if (r < s.rounds) { if (now < t + br) return { kind: 'break', round: r, startsAt: t, endsAt: t + br }; t += br }
  }
  return { kind: 'done', round: s.rounds, startsAt: t, endsAt: t }
}
/** Minutes left of the current phase, rounded up (what a person who joins mid-round gets as their timer). */
export const minutesLeft = (p, now) => Math.max(1, Math.ceil((p.endsAt - now) / 60_000))
