// Creating a village (Phase 1 CP1): the rules in one place, shared by the API and the /new screen. Plain JS (no build step in the API) with create.d.ts.
export const MAX_OWNED_VILLAGES = 5
export const MAX_JOINED_VILLAGES = 20 // counts every village you are in, owned ones included
export const MAX_COURSE_TAGS = 12
export const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/ // 3-40 chars, a-z 0-9 and hyphens, no hyphen at either end

/** "Med Year 1 Study Den" -> "med-year-1-study-den"; Thai-only names give '' (the owner types one). */
export const slugSuggest = (name) => String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '')
/** "dtip 122" -> "DTIP122" (how course_tags are stored, as the seed script did). */
export const tagOf = (c) => String(c).toUpperCase().replace(/\s+/g, '')

/** Returns { ok: true, value } or { ok: false, error } with a code the form can show. */
export function cleanCreate(b) {
  const name = typeof b?.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 3 || name.length > 40) return { ok: false, error: 'bad_name' }
  const slug = typeof b.slug === 'string' ? b.slug.trim().toLowerCase() : ''
  if (!SLUG.test(slug) || slug.includes('--')) return { ok: false, error: 'bad_slug' }
  const raw = Array.isArray(b.courses) ? b.courses : []
  const courses = [...new Set(raw.filter((c) => typeof c === 'string').map(tagOf).filter((c) => /^[A-Z0-9]{2,12}$/.test(c)))].slice(0, MAX_COURSE_TAGS)
  const whoCanInvite = b.whoCanInvite === 'everyone' ? 'everyone' : 'admins'
  const defaultSharing = b.defaultSharing === 'full' ? 'full' : 'basic'
  return { ok: true, value: { name, slug, courses, settings: { library_auto_focus: b.libraryAutoFocus !== false, who_can_invite: whoCanInvite, default_status_sharing: defaultSharing } } }
}
