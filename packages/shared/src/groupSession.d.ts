export const GROUP_LIMITS: { focusMin: [number, number]; breakMin: [number, number]; rounds: [number, number] }
export const BREAK_WARNING_MS: number
export interface GroupShape { focusMin: number; breakMin: number; rounds: number }
export interface GroupTimes extends GroupShape { startedAt: number }
export interface GroupPhase { kind: 'focus' | 'break' | 'done'; round: number; startsAt: number; endsAt: number }
export function cleanGroup(b: unknown): GroupShape | null
export function totalMs(s: GroupShape): number
export function phaseAt(s: GroupTimes, now: number): GroupPhase
export function minutesLeft(p: GroupPhase, now: number): number
