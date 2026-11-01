export type Presence = 'available' | 'focusing' | 'dnd' | 'away'
export type ZoneId = 'plaza' | 'library' | 'tables' | 'lounge' | 'garden'
export type Dir = 'up' | 'down' | 'left' | 'right'
export type Role = 'owner' | 'admin' | 'member' | 'guest'
export type StatusSharing = 'full' | 'basic' | 'off'
// Same kinds of work as Desker's TYPES (src/rhythm.js). Mapping below; "Problem set" is "practising" here.
export const ACTIVITIES = ['reading', 'practising', 'writing', 'revising', 'lab_report', 'group_work', 'admin', 'other'] as const
export type Activity = (typeof ACTIVITIES)[number]
export const ACTIVITY_FROM_DESKER: Record<string, Activity> = {
  Reading: 'reading', 'Problem set': 'practising', Writing: 'writing', Revision: 'revising',
  'Lab report': 'lab_report', 'Group work': 'group_work', Admin: 'admin', Other: 'other',
}
export const COLOURS = ['snow', 'sky', 'moss', 'rose', 'amber', 'plum'] as const // 6 palette swaps (Checkpoint 2)
export type Colour = (typeof COLOURS)[number]
export interface Status { courseCode?: string; activity: Activity; taskId?: string; taskTitle?: string; endsAt?: string }
export interface Member { userId: string; name: string; colour: Colour; role: Role }
