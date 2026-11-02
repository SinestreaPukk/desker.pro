export const MAX_BLOCKS: number
export const SLOW_MODE_MS: number
export const MUTE: { strikes: number; windowMs: number; durationMs: number }
export const REPORT_REASONS: readonly ['harassment', 'spam', 'inappropriate', 'other']
export function slowCheck(last: number | undefined, now: number, on: boolean): { ok: boolean; waitMs: number }
export function strike(strikes: number[], now: number): { strikes: number[]; muteUntil: number | null }
export function muteLeftMin(muteUntil: number | undefined | null, now: number): number
export interface CleanReport { targetUserId: string; reason: 'harassment' | 'spam' | 'inappropriate' | 'other'; note: string; kind: 'bubble' | 'question' | 'answer' | 'person'; text: string; lines: { name: string; text: string; at: number; zone: string }[] }
export function cleanReport(b: unknown): CleanReport | null
