export interface BoardRow { userId: string; title: string; dueAt: number; courseCode: string | null; kind?: 'due' | 'exam'; manual?: boolean; itemId?: string; createdBy?: string; confirmers?: string[] } // dueAt: epoch ms
export interface BoardEntry { key: string; kind: 'due' | 'exam'; courseCode: string | null; title: string; dueAt: number; userIds: string[]; confirmedBy: string[]; itemId?: string; createdBy?: string }
export type Urgency = 'red' | 'amber' | 'blue'
export function courseOf(text: string): string | null
export function normTitle(t: string): string
export function urgency(dueAt: number, now: number): Urgency
export function buildBoard(rows: BoardRow[], courseTags: string[], now: number): BoardEntry[]
export function findDuplicate(entries: BoardEntry[], q: { courseCode: string | null; title: string; dueAt: number }): BoardEntry | undefined
export function parseDue(date: unknown, time?: unknown): number
export function plannerHas(deadlines: { title?: string; date?: string; time?: string | null }[], q: { title: string; dueAt: number }): boolean
export function plannerDeadline(deadlines: { id: number | string }[], q: { title: string; courseCode: string | null; dueAt: number }, now?: number): { id: number; title: string; date: string; time?: string; hours: null; context: string }
