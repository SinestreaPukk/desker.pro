export type VillageRole = 'owner' | 'admin' | 'member' | 'guest'
export const ROLES: VillageRole[]
export const ACTIONS: string[]
export function can(role: string, action: string, whoCanInvite?: 'admins' | 'everyone'): boolean
export function canModerate(actor: string, target: string): boolean
export function canSetRole(actor: string, target: string, next: string): boolean
export type InviteVerdict = 'ok' | 'banned' | 'already' | 'revoked' | 'expired' | 'used_up' | 'full' | 'too_many_joined'
export function inviteVerdict(inv: { revoked_at: unknown; expires_at: string | Date | null; max_uses: number | null; uses: number }, ctx: { now: number; members: number; banned: boolean; member: boolean; joined: number; maxMembers: number; maxJoined: number }): InviteVerdict
