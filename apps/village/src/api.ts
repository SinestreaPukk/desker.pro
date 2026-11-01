// The village's own API (same origin as the app; the login cookie is on the shared parent domain).
export type Mine = { slug: string; name: string; role: string; members: number }
export type Info = {
  village: { id: string; slug: string; name: string; courseTags: string[]; libraryAutoFocus: boolean }
  me: { userId: string; role: string; colour: string; statusSharing: string; shareDeadlines: boolean; deskSpotId: string | null }
  members: { userId: string; name: string; colour: string; role: string; deskSpotId: string | null; lastSeenAt: string }[]
}
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api/village/${path}`, { credentials: 'include', ...init, headers: { 'content-type': 'application/json' } })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(body.error ?? `HTTP ${r.status}`), { code: body.error as string | undefined })
  return body as T
}
export const mine = () => call<{ villages: Mine[] }>('mine')
export const info = (slug: string) => call<Info>(slug)
export const join = (slug: string, key: string) => call<{ joined: boolean }>(`${slug}/join`, { method: 'POST', body: JSON.stringify({ key }) })
export const patchMe = (slug: string, body: Partial<{ colour: string; statusSharing: string; shareDeadlines: boolean }>) =>
  call<{ ok: true }>(`${slug}/me`, { method: 'PATCH', body: JSON.stringify(body) })
export const claimDesk = (slug: string, spotId: string | null) => call<{ ok: true }>(`${slug}/desk`, { method: 'PUT', body: JSON.stringify({ spotId }) })
export type PickTask = { id: string; title: string; hours: number; courseCode?: string; activity: string; repeat: boolean }
export const todaysTasks = (slug: string) => call<{ tasks: PickTask[] }>(`${slug}/tasks?date=${new Date().toLocaleDateString('sv')}`)
export const focusStart = (slug: string) => call<{ sessionId: string; startedAt: string }>(`${slug}/focus`, { method: 'POST', body: JSON.stringify({ action: 'start' }) })
export const focusEnd = (slug: string, b: { sessionId: string; activeMin: number; pauses: number; done: boolean; taskId?: string }) =>
  call<{ ok: true; minutes?: number; reason?: string | null; again?: boolean }>(`${slug}/focus`, { method: 'POST', body: JSON.stringify({ action: 'end', ...b }) })
export const patchVillage = (slug: string, body: { libraryAutoFocus: boolean }) => call<{ ok: true }>(slug, { method: 'PATCH', body: JSON.stringify(body) })
