// Questions and answers (Phase 1 CP5): the shared rules, used by the API (the authority) and the client (to count characters).
import { maskBadWords } from './wordfilter.js'

export const QUESTION_MAX = 200, ANSWER_MAX = 500
export const QUESTION_RATE = { max: 3, windowMs: 60_000 }, ANSWER_RATE = { max: 10, windowMs: 60_000 }
const clean = (v, max) => (typeof v === 'string' ? maskBadWords([...v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('')) : '')

/** -> { ok, text, courseCode } or { ok: false }. The course is optional and must look like a code (letters then digits). */
export function cleanQuestion(b) {
  const text = clean(b?.text, QUESTION_MAX)
  if (!text) return { ok: false }
  const c = typeof b?.courseCode === 'string' ? b.courseCode.toUpperCase().replace(/\s+/g, '') : ''
  return { ok: true, text, courseCode: /^[A-Z]{2,6}\d{2,5}$/.test(c) ? c : null }
}
export function cleanAnswer(b) { const text = clean(b?.text, ANSWER_MAX); return text ? { ok: true, text } : { ok: false } }

/** Who may mark a question resolved: the asker, or anyone who can moderate. */
export const canResolve = (role, isAsker) => isAsker || role === 'owner' || role === 'admin'
