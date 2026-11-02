// Safety rules (Phase 1 CP9) that the API, the room and the screens all share. Pure, so the tests pin them down.
export const MAX_BLOCKS = 20 // they travel in the room token, which has a size limit
export const SLOW_MODE_MS = 30_000 // slow mode: one bubble per 30 seconds for everyone
export const MUTE = { strikes: 5, windowMs: 60_000, durationMs: 600_000 } // 5 "slow down" hits in a minute = a 10-minute mute
export const REPORT_REASONS = ['harassment', 'spam', 'inappropriate', 'other']

/** Slow mode: may this person speak? last = when their previous bubble was; waitMs = how long until they may. */
export const slowCheck = (last, now, on) => (!on || !last || now - last >= SLOW_MODE_MS ? { ok: true, waitMs: 0 } : { ok: false, waitMs: SLOW_MODE_MS - (now - last) })

/** Records a rate-limit hit. -> { strikes (the ones still inside the window), muteUntil | null }. Five hits in a minute start a 10-minute mute. */
export function strike(strikes, now) {
  const kept = [...strikes.filter((t) => now - t < MUTE.windowMs), now]
  return kept.length >= MUTE.strikes ? { strikes: [], muteUntil: now + MUTE.durationMs } : { strikes: kept, muteUntil: null }
}
export const muteLeftMin = (muteUntil, now) => (muteUntil && muteUntil > now ? Math.ceil((muteUntil - now) / 60_000) : 0)

const clip = (v, n) => (typeof v === 'string' ? [...v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()].slice(0, n).join('') : '')
/** A report from a browser -> what is stored, or null. The context lines (the last chat lines the reporter saw) are only evidence: cut to 10 short lines. */
export function cleanReport(b) {
  if (typeof b?.targetUserId !== 'string' || !/^[\w-]{1,64}$/.test(b.targetUserId) || !REPORT_REASONS.includes(b.reason)) return null
  const lines = (Array.isArray(b.context) ? b.context : []).map((l) => ({ name: clip(l?.name, 60), text: clip(l?.text, 120), at: Number.isFinite(l?.at) ? l.at : 0, zone: clip(l?.zone, 16) })).filter((l) => l.text).slice(-10)
  const kind = ['bubble', 'question', 'answer', 'person'].includes(b.kind) ? b.kind : 'person'
  return { targetUserId: b.targetUserId, reason: b.reason, note: clip(b.note, 300), kind, text: clip(b.text, 500), lines }
}
