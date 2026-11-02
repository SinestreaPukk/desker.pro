export const PUSH_KINDS: readonly ['answered', 'group', 'busy', 'deadline']
export type PushKind = 'answered' | 'group' | 'busy' | 'deadline'
export interface PushPrefs { types: Record<PushKind, boolean>; quiet: { from: number; to: number } }
export const QUIET_DEFAULT: { from: number; to: number }
export function defaultPrefs(): PushPrefs
export function cleanPrefs(b: unknown): PushPrefs
export function localParts(now: number | Date, tz: string): { hour: number; minute: number } | null
export function isQuiet(q: { from: number; to: number }, hour: number): boolean
export function localDayStart(now: number, tz: string): number
export function decide(c: { kind: string; prefs: PushPrefs | null | undefined; now: number; tz: string; sentToday?: number; already?: boolean; openedToday?: boolean }): { send: boolean; why?: string }
