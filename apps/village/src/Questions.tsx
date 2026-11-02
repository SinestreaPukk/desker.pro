// Questions (Phase 1 CP5): the Ask box (Q), the Questions column on the Board and the thread view.
import { useEffect, useRef, useState } from 'react'
import { QUESTION_MAX, ANSWER_MAX, canResolve } from '@desker/shared'
import { ask, answer, deleteAnswer, deleteQuestion, markHelpful, questions, resolveQuestion, thread, type Answer, type Question } from './api.ts'

const age = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago` }
const WHY: Record<string, string> = { slow_down: 'Slow down a little. Try again in a minute.', forbidden: 'Guests cannot do that.', bad_question: 'Write a question first.', bad_answer: 'Write an answer first.' }
const why = (e: unknown) => WHY[(e as { code?: string })?.code ?? ''] ?? `That didn't work (${(e as Error)?.message ?? 'unknown'}). Try again.`

/** Q opens this. The course chip starts as the course you are working on. */
export function AskBox({ slug, courses, course, onDone, onClose }: { slug: string; courses: string[]; course?: string; onDone: () => void; onClose: () => void }) {
  const [text, setText] = useState(''), [c, setC] = useState(course ?? ''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const send = () => {
    if (!text.trim() || busy) return
    setBusy(true); ask(slug, text, c || undefined).then(onDone, (e) => { setErr(why(e)); setBusy(false) })
  }
  const opts = [...new Set([...(course ? [course] : []), ...courses])].slice(0, 6)
  return (
    <div className="askbox" role="dialog" aria-label="Ask a question" onKeyDown={(e) => { e.nativeEvent.stopPropagation(); if (e.key === 'Escape') onClose(); else if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}>
      <input ref={input} value={text} onChange={(e) => setText([...e.target.value].slice(0, QUESTION_MAX).join(''))} placeholder="Ask the village…" aria-label="Your question" autoComplete="off" />
      <button type="button" className="send" onClick={send} disabled={!text.trim() || busy}>Ask</button>
      <span className="count">{[...text].length}/{QUESTION_MAX}</span>
      {opts.length > 0 && <span className="chips" aria-label="Course">{opts.map((o) => <button key={o} type="button" className={c === o ? 'on' : ''} aria-pressed={c === o} onClick={() => setC(c === o ? '' : o)}>{o}</button>)}</span>}
      {err && <em role="alert">{err}</em>}
    </div>
  )
}

/** The Board's Questions column; clicking one opens its thread in place. */
export default function Questions({ slug, me, role, rev, openId }: { slug: string; me: string; role: string; rev: number; openId?: string | null }) {
  const [list, setList] = useState<Question[] | null>(null), [open, setOpen] = useState<string | null>(openId ?? null)
  const load = () => questions(slug).then((r) => setList(r.questions), () => setList((l) => l ?? []))
  useEffect(() => { load() }, [slug, rev])
  if (open) return <Thread slug={slug} id={open} me={me} role={role} rev={rev} onBack={() => { setOpen(null); load() }} />
  return (
    <section className="questions">
      <h3>Questions</h3>
      {list === null && <p className="none">Loading…</p>}
      {list?.length === 0 && <p className="none">No questions yet. Press Q to ask one.</p>}
      <ul>{list?.map((q) => (
        <li key={q.id} className={q.resolved ? 'done' : ''}>
          <button type="button" className="qrow" onClick={() => setOpen(q.id)}>
            {q.courseCode && <span className="chip">{q.courseCode}</span>} <b>{q.text}</b>
            <span className="meta">{q.askerName} · {age(q.createdAt)} · {q.answers} {q.answers === 1 ? 'answer' : 'answers'}{q.resolved ? ' · resolved' : ''}</span>
          </button>
        </li>
      ))}</ul>
    </section>
  )
}

function Thread({ slug, id, me, role, rev, onBack }: { slug: string; id: string; me: string; role: string; rev: number; onBack: () => void }) {
  const [d, setD] = useState<{ question: Question; answers: Answer[] } | null | false>(null), [text, setText] = useState(''), [err, setErr] = useState('')
  const load = () => thread(slug, id).then(setD, () => setD(false))
  useEffect(() => { load() }, [id, rev])
  if (d === null) return <section className="questions"><p className="none">Loading…</p></section>
  if (d === false) return <section className="questions"><button type="button" onClick={onBack}>← Back</button><p className="none">That question is gone.</p></section>
  const { question: q, answers } = d, mine = q.askerId === me
  const send = () => text.trim() && answer(slug, id, text).then(() => { setText(''); setErr(''); load() }, (e) => setErr(why(e)))
  return (
    <section className="questions thread">
      <button type="button" className="back" onClick={onBack}>← Questions</button>
      <p className="q">{q.courseCode && <span className="chip">{q.courseCode}</span>} <b>{q.text}</b></p>
      <p className="meta">{q.askerName} · {age(q.createdAt)}{q.resolved ? ' · resolved' : ''}</p>
      <ul>{answers.map((a) => (
        <li key={a.id}>
          <span>{a.text}</span>
          <span className="meta">{a.name} · {age(a.createdAt)}{a.helpful ? ' · 👍 helped' : ''}
            {(a.userId === me || role === 'owner' || role === 'admin') && <button type="button" onClick={() => deleteAnswer(slug, a.id).then(load, (e) => setErr(why(e)))}>Delete</button>}
            {mine && !a.helpful && a.userId !== me && <button type="button" onClick={() => markHelpful(slug, a.id).then(load, (e) => setErr(why(e)))}>This helped</button>}
          </span>
        </li>
      ))}</ul>
      {answers.length === 0 && <p className="none">No answers yet.</p>}
      {(mine || role === 'owner' || role === 'admin') && <button type="button" onClick={() => deleteQuestion(slug, id).then(onBack, (e) => setErr(why(e)))}>Delete question</button>}
      {canResolve(role, mine) && <button type="button" onClick={() => resolveQuestion(slug, id, !q.resolved).then(load, (e) => setErr(why(e)))}>{q.resolved ? 'Reopen' : 'Mark resolved'}</button>}
      <div className="reply">
        <input value={text} onChange={(e) => setText([...e.target.value].slice(0, ANSWER_MAX).join(''))} onKeyDown={(e) => { e.nativeEvent.stopPropagation(); if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }} placeholder="Write an answer…" aria-label="Your answer" autoComplete="off" />
        <button type="button" onClick={send} disabled={!text.trim()}>Answer</button>
      </div>
      {err && <em role="alert">{err}</em>}
    </section>
  )
}
