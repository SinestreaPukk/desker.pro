import { useState, useEffect, useRef } from 'react'
import { post } from '../api.js'
import { BLUE, btn } from '../ui.js'
import { weekReview } from '../review.js'
import { rank } from '../rank.js'
import { validAdds } from '../lists.js'
import { readSource, QUICK, todayStr, goalsForAI, fmtDate } from '../shared.jsx'
import { visionOf } from '../goals.js'

const TASK_LIMIT = 50 // api/chat.js rejects more, so only the highest-ranked go
const RECENT = 20 // and it rejects long histories, so a long chat sends its latest turns

// The only place with AI and long typing. It can suggest things to add, and nothing is added until you tap.
export default function Agent({ data, onAdd, onClose, onFinder }) {
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [msgs, busy])
  const send = async (content, label) => {
    const next = [...msgs, { role: 'user', content, label }]
    setMsgs(next); setText(''); setBusy(true); setError('')
    try {
      const out = await post('/api/chat', {
        today: todayStr(), vision: visionOf(data.goals)?.title, goals: goalsForAI(data.goals),
        tasks: rank(data).slice(0, TASK_LIMIT).map(({ task: { id, title, due, projectId }, why }) => ({ id, title, due, projectId, why })),
        projects: data.projects.map(({ id, title, date, progress, goalId }) => ({ id, title, date, progress, goalId })),
        messages: next.slice(-RECENT).map(({ role, content: c }) => ({ role, content: c })),
      })
      if (typeof out.reply !== 'string') throw new Error('The AI gave an unreadable answer. Please try again.')
      setMsgs([...next, { role: 'assistant', content: out.reply, adds: validAdds(out.adds) }])
    } catch (err) { setError(err.message) }
    setBusy(false)
  }
  // Attach a file or photo, or read a pasted link, then send the notes with the message.
  const attachFile = async (file) => {
    setBusy(true); setError('')
    try {
      const notes = await readSource({ file })
      setBusy(false)
      await send(`I attached "${file.name}". What it contains:\n${notes}`, `Attached: ${file.name}`)
    } catch (err) { setError(err.message); setBusy(false) }
  }
  const submit = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    const url = t.match(/https?:\/\/\S+/)?.[0]
    if (!url) return send(t)
    setBusy(true); setError('')
    try {
      const notes = await readSource({ url })
      setBusy(false)
      await send(`${t}\n\n[Page content from ${url}]:\n${notes}`, t)
    } catch (err) { setError(`Could not read that link: ${err.message}`); setBusy(false); send(t) }
  }
  const chipClick = (q) => (q === 'Weekly review'
    ? send(`Weekly review please. ${weekReview(data.tasks, data.goals, data.projects).text}`, 'Weekly review')
    : onFinder())
  const added = (mi, ks) => setMsgs(msgs.map((m, i) => (i === mi ? { ...m, adds: m.adds.map((a, k) => (ks.includes(k) ? { ...a, added: true } : a)) } : m)))
  const addSome = (mi, ks) => { onAdd(ks.map((k) => msgs[mi].adds[k])); added(mi, ks) }
  const bubble = 'max-w-[80%] break-words px-3.5 py-2 text-[0.9375rem] leading-snug'
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <img src="/favicon.svg" alt="Desker chat" className="h-9 w-9" />
        <button className="flex min-h-11 items-center rounded-full px-4 text-accent hover:bg-pale" onClick={onClose}>Close</button>
      </header>
      <div role="log" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3">
        <div className={`${bubble} mr-auto rounded-2xl rounded-bl-md bg-panel text-ink`}>
          Hi! Tell me what's on your plate, or attach a syllabus, and I'll offer to add it.
        </div>
        {msgs.map((m, i) => (
          <div key={i} className={`${bubble} ${m.role === 'user' ? 'ml-auto rounded-2xl rounded-br-md bg-primary text-ink' : 'mr-auto rounded-2xl rounded-bl-md bg-panel text-ink'}`}>
            {m.label ?? m.content}
            {m.adds?.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {m.adds.map((a, k) => (
                  <li key={k} className="rounded-xl bg-white p-2 text-sm">
                    <span className="text-xs capitalize text-slate-600">{a.type}{a.due ? ` · due ${fmtDate(a.due)}` : ''}</span><br />{a.title}
                    <button className={`${btn} mt-1 block ${a.added ? 'bg-slate-100 text-slate-600' : BLUE}`} disabled={a.added} onClick={() => addSome(i, [k])}>{a.added ? 'Added' : 'Add'}</button>
                  </li>
                ))}
                {m.adds.filter((a) => !a.added).length > 1 && <li><button className={`${btn} ${BLUE}`} onClick={() => addSome(i, m.adds.flatMap((a, k) => (a.added ? [] : [k])))}>Add all</button></li>}
              </ul>
            )}
          </div>
        ))}
        {busy && (
          <div className="mr-auto flex gap-1 rounded-2xl rounded-bl-md bg-panel px-4 py-3" aria-label="Thinking">
            <span className="dot" /><span className="dot" style={{ animationDelay: '150ms' }} /><span className="dot" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        {error && <p className="text-center text-xs text-danger">{error}</p>}
        <div ref={end} />
      </div>
      {!msgs.length && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {QUICK.map((q) => <button key={q} className="rounded-full border border-control bg-white px-4 py-2 text-sm text-ink transition hover:bg-pale disabled:opacity-60" disabled={busy} onClick={() => chipClick(q)}>{q}</button>)}
        </div>
      )}
      <form className="flex items-center gap-2 p-3" onSubmit={submit}>
        <label className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-panel text-slate-700 transition hover:bg-slate-300 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <span className="sr-only">Attach a photo, PDF or text file</span>
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
          <input type="file" className="sr-only" accept="image/*,application/pdf,.txt,.md,.csv,.json,.ics" disabled={busy}
            onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) attachFile(f) }} />
        </label>
        <div className="relative flex-1">
          <input className="w-full rounded-full border border-control bg-white py-2.5 pl-4 pr-12 placeholder:text-slate-500" aria-label="Message" placeholder="Message or paste a link" value={text} onChange={(e) => setText(e.target.value)} />
          <button className={`absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-ink transition ${text.trim() && !busy ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0'}`} aria-label="Send" tabIndex={text.trim() && !busy ? 0 : -1}>
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /></svg>
          </button>
        </div>
      </form>
    </div>
  )
}
