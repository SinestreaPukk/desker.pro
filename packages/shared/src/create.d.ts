export const MAX_OWNED_VILLAGES: number
export const MAX_JOINED_VILLAGES: number
export const MAX_COURSE_TAGS: number
export const SLUG: RegExp
export function slugSuggest(name: string): string
export function tagOf(c: string): string
export interface CreateValue { name: string; slug: string; courses: string[]; settings: { library_auto_focus: boolean; who_can_invite: 'admins' | 'everyone'; default_status_sharing: 'basic' | 'full' } }
export function cleanCreate(b: unknown): { ok: true; value: CreateValue } | { ok: false; error: 'bad_name' | 'bad_slug' }
