export interface BoardRow { userId: string; title: string; dueAt: number; courseCode: string | null } // dueAt: epoch ms
export interface BoardEntry { key: string; kind: 'due' | 'exam'; courseCode: string | null; title: string; dueAt: number; userIds: string[] }
export type Urgency = 'red' | 'amber' | 'blue'
export function courseOf(text: string): string | null
export function normTitle(t: string): string
export function urgency(dueAt: number, now: number): Urgency
export function buildBoard(rows: BoardRow[], courseTags: string[], now: number): BoardEntry[]
