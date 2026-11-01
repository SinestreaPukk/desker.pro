export const QUESTION_MAX: number
export const ANSWER_MAX: number
export const QUESTION_RATE: { max: number; windowMs: number }
export const ANSWER_RATE: { max: number; windowMs: number }
export function cleanQuestion(b: unknown): { ok: true; text: string; courseCode: string | null } | { ok: false }
export function cleanAnswer(b: unknown): { ok: true; text: string } | { ok: false }
export function canResolve(role: string, isAsker: boolean): boolean
