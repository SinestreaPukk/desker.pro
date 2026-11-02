// The village's own API (same origin as the app; the login cookie is on the shared parent domain).
export type Mine = { slug: string; name: string; role: string; members: number; dots: string[]; studying: number; next: { title: string; courseCode: string | null; dueAt: number } | null }
export type Info = {
  village: { id: string; slug: string; name: string; courseTags: string[]; libraryAutoFocus: boolean; whoCanInvite: 'admins' | 'everyone' }
  me: { userId: string; role: string; colour: string; statusSharing: string; shareDeadlines: boolean; deskSpotId: string | null }
  members: { userId: string; name: string; colour: string; role: string; deskSpotId: string | null; lastSeenAt: string }[]
}
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api/village/${path}`, { credentials: 'include', ...init, headers: { 'content-type': 'application/json' } })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(body.error ?? `HTTP ${r.status}`), { code: body.error as string | undefined, body })
  return body as T
}
export const mine = () => call<{ villages: Mine[]; closed: { slug: string; name: string }[] }>('mine')
export const info = (slug: string) => call<Info>(slug)
export const patchMe = (slug: string, body: Partial<{ colour: string; statusSharing: string; shareDeadlines: boolean }>) =>
  call<{ ok: true }>(`${slug}/me`, { method: 'PATCH', body: JSON.stringify(body) })
export const claimDesk = (slug: string, spotId: string | null) => call<{ ok: true }>(`${slug}/desk`, { method: 'PUT', body: JSON.stringify({ spotId }) })
export type PickTask = { id: string; title: string; hours: number; courseCode?: string; activity: string; repeat: boolean }
export const todaysTasks = (slug: string) => call<{ tasks: PickTask[] }>(`${slug}/tasks?date=${new Date().toLocaleDateString('sv')}`)
export const focusStart = (slug: string, plannedMin: number, groupId?: string) => call<{ sessionId: string; startedAt: string }>(`${slug}/focus`, { method: 'POST', body: JSON.stringify({ action: 'start', plannedMin, ...(groupId && { groupId }) }) })
export const focusEnd = (slug: string, b: { sessionId: string; activeMin: number; plannedMin: number; pauses: number; done: boolean; taskId?: string }) =>
  call<{ ok: true; minutes?: number; reason?: string | null; again?: boolean }>(`${slug}/focus`, { method: 'POST', body: JSON.stringify({ action: 'end', ...b }) })
export const patchVillage = (slug: string, body: Partial<{ libraryAutoFocus: boolean; whoCanInvite: string; defaultSharing: string; addCourse: string }>) => call<{ ok: true }>(slug, { method: 'PATCH', body: JSON.stringify(body) })
export type BoardItem = { key: string; kind: 'due' | 'exam'; courseCode: string | null; title: string; dueAt: number; userIds: string[]; confirmedBy: string[]; itemId?: string; createdBy?: string; inPlanner: boolean }
export type Announcement = { id: string; title: string; body: string | null; pinned: boolean; createdAt: string; by: string }
export const board = (slug: string) => call<{ items: BoardItem[]; announcements: Announcement[] }>(`${slug}/board`)
export type NewItem = { kind: 'due' | 'exam'; courseCode: string; title: string; date: string; time?: string; force?: boolean }
export const addItem = (slug: string, b: NewItem) => call<{ id: string }>(`${slug}/board`, { method: 'POST', body: JSON.stringify(b) })
export const confirmItem = (slug: string, id: string, on: boolean) => call<{ ok: true }>(`${slug}/board/${id}/confirm`, { method: 'POST', body: JSON.stringify({ on }) })
export const deleteItem = (slug: string, id: string) => call<{ ok: true }>(`${slug}/board/${id}`, { method: 'DELETE' })
export const announce = (slug: string, b: { title: string; body?: string; pinned: boolean }) => call<{ id: string }>(`${slug}/board/announce`, { method: 'POST', body: JSON.stringify(b) })
export const toPlanner = (slug: string, it: BoardItem) => call<{ ok: true; already?: boolean }>(`${slug}/board/planner`, { method: 'POST', body: JSON.stringify({ title: it.title, courseCode: it.courseCode, dueAt: it.dueAt, kind: it.kind }) })
/** Analytics (SPEC §13): never message text. `beacon` survives the tab closing. */
export function track(slug: string, name: string, props: Record<string, unknown> = {}, beacon = false) {
  const body = JSON.stringify({ name, props }), url = `/api/village/${slug}/event`
  if (beacon && navigator.sendBeacon) return void navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
  fetch(url, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
}
export type NewVillage = { name: string; slug: string; courses: string[]; whoCanInvite: 'admins' | 'everyone'; libraryAutoFocus: boolean; defaultSharing: 'basic' | 'full' }
export const createVillage = (b: NewVillage) => call<{ slug: string }>('new', { method: 'POST', body: JSON.stringify(b) })
export const myCourses = () => call<{ courses: string[] }>('courses')

export type InvitePreview = { verdict: string; slug?: string; guest?: boolean; village?: { name: string; owner: string; members: number; online: number } }
export const invitePreview = (code: string) => call<InvitePreview>(`invite/${code}`)
export const inviteAccept = (code: string) => call<{ slug: string; joined: boolean }>(`invite/${code}/accept`, { method: 'POST', body: '{}' })
export type Invite = { code: string; expiresAt: string | null; maxUses: number | null; uses: number; asGuest: boolean; createdAt: string; createdBy: string }
export const invites = (slug: string) => call<{ invites: Invite[] }>(`${slug}/invites`)
export const createInvite = (slug: string, b: { expiresIn: '24h' | '7d' | 'never'; maxUses: number | null; asGuest: boolean }) => call<{ code: string }>(`${slug}/invites`, { method: 'POST', body: JSON.stringify(b) })
export const revokeInvite = (slug: string, code: string) => call<{ ok: boolean }>(`${slug}/invites/${code}`, { method: 'DELETE' })
export type Person = { userId: string; name: string; role: string; joinedAt: string; lastSeenAt: string; banned: boolean }
export const people = (slug: string) => call<{ members: Person[] }>(`${slug}/members`)
export const setRole = (slug: string, uid: string, role: string) => call<{ ok: true }>(`${slug}/members/${uid}`, { method: 'PATCH', body: JSON.stringify({ role }) })
export const moderate = (slug: string, uid: string, action: 'kick' | 'ban' | 'unban') => call<{ ok: true }>(`${slug}/members/${uid}/${action}`, { method: 'POST', body: '{}' })
export const transfer = (slug: string, userId: string, confirm: string) => call<{ ok: true }>(`${slug}/transfer`, { method: 'POST', body: JSON.stringify({ userId, confirm }) })
export const leaveVillage = (slug: string) => call<{ ok: true }>(`${slug}/leave`, { method: 'POST', body: '{}' })
export const closeVillage = (slug: string) => call<{ ok: true }>(slug, { method: 'DELETE' })
export const restoreVillage = (slug: string) => call<{ ok: true }>(`${slug}/restore`, { method: 'POST', body: '{}' })

export type Question = { id: string; text: string; courseCode: string | null; askerId: string; askerName: string; createdAt: string; resolved: boolean; answers: number; helped: boolean }
export type Answer = { id: string; userId: string; name: string; text: string; helpful: boolean; createdAt: string }
export const questions = (slug: string) => call<{ questions: Question[] }>(`${slug}/questions`)
export const ask = (slug: string, text: string, courseCode?: string) => call<{ id: string }>(`${slug}/questions`, { method: 'POST', body: JSON.stringify({ text, courseCode }) })
export const thread = (slug: string, id: string) => call<{ question: Question; answers: Answer[] }>(`${slug}/questions/${id}`)
export const answer = (slug: string, id: string, text: string) => call<{ id: string }>(`${slug}/questions/${id}/answers`, { method: 'POST', body: JSON.stringify({ text }) })
export const resolveQuestion = (slug: string, id: string, resolved: boolean) => call<{ ok: true }>(`${slug}/questions/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolved }) })
export const markHelpful = (slug: string, answerId: string) => call<{ ok: true }>(`${slug}/answers/${answerId}/helpful`, { method: 'POST', body: '{}' })

export type GroupState = { id: string; startedBy: string; startedByName: string; focusMin: number; breakMin: number; rounds: number; startedAt: number; participants: { userId: string; name: string; colour: string; taskTitle?: string; courseCode?: string }[] }
export type GroupSummary = { id: string; focusMin: number; breakMin: number; rounds: number; totalMin: number; people: { userId: string; name: string; colour: string; minutes: number; taskTitle?: string; courseCode?: string }[] }
export const getGroup = (slug: string) => call<{ group: GroupState | null; serverNow: number; summary: GroupSummary | null }>(`${slug}/group`)
export const startGroup = (slug: string, b: { focusMin: number; breakMin: number; rounds: number }) => call<{ ok: true }>(`${slug}/group`, { method: 'POST', body: JSON.stringify(b) })
export const joinGroup = (slug: string, b: { taskTitle: string; courseCode?: string }) => call<{ groupId: string }>(`${slug}/group/join`, { method: 'POST', body: JSON.stringify(b) })
export const leaveGroup = (slug: string) => call<{ ok: true }>(`${slug}/group/leave`, { method: 'POST', body: '{}' })
export const finishGroup = (slug: string) => call<{ ok: true }>(`${slug}/group/finish`, { method: 'POST', body: '{}' })
export const endGroup = (slug: string) => call<{ ok: true }>(`${slug}/group`, { method: 'DELETE' })
