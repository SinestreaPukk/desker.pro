import { useState, useEffect, useRef } from 'react'
import { post } from '../api.js'
import { BLUE, btn, input, LEVELS } from '../ui.js'
import { weekReview } from '../review.js'
import { patternOf, ratioOf, readSource, busyForAI, freeTodayOf, applyPlan, QUICK, todayStr } from '../shared.jsx'

export default function Agent({ data, setData, onClose, onReplan, reviewReq }) {
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
        goals: data.goals.map(({ id, title, level, happiness }) => ({ id, level: LEVELS[level].name, kind: happiness ? 'happiness' : 'work', title })),
        tasks: data.tasks.filter((t) => !t.done).map(({ id, title, due, readiness, hours, when, start, fun, deadlineId, projectId }) => ({ id, title, due, readiness, hours, when, start, fun, deadlineId, projectId })),
        pattern: patternOf(data), ratio: ratioOf(data.tasks),
        projects: (data.projects || []).map(({ id, title, kind, date }) => ({ id, title, kind, date })),
        deadlines: (data.deadlines || []).map(({ id, title, date, hours }) => ({ id, title, date, hours })),
        hobbies: (data.hobbies || []).map((h) => h.title), freeHours: data.freeHours, freeToday: freeTodayOf(data), busy: busyForAI(data.busy), mood: data.mood, messages: next.map(({ role, content }) => ({ role, content })),
      })
      if (typeof out.reply !== 'string') throw new Error('The AI gave an unreadable answer. Please try again.')
      setData((d) => applyPlan(d, out))
      const goals = (Array.isArray(out.goals) ? out.goals : []).filter((g) => g?.title && LEVELS.some((l) => l.name === g.level)).slice(0, 8)
        .map((g) => ({ title: String(g.title).slice(0, 120), level: LEVELS.findIndex((l) => l.name === g.level), happiness: !!g.happiness }))
      setMsgs([...next, { role: 'assistant', content: out.reply, goals }])
    } catch (err) { setError(err.message) }
    setBusy(false)
  }
  // Attach a file/photo, or auto-read a pasted link, then send the notes with the message.
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
  const review = () => send(`Weekly review please. ${weekReview(data.tasks, data.goals).text}`, 'Weekly review')
  useEffect(() => { if (reviewReq) review() }, [reviewReq])
  const chipClick = (q) => (q === 'Replan my week' ? onReplan() : q === 'Weekly review' ? review() : send(q))
  const addGoals = (mi, ks) => {
    const picked = ks.map((k) => msgs[mi].goals[k])
    setData((d) => ({ ...d, goals: [...d.goals, ...picked.map((g, n) => ({ id: Date.now() + n, title: g.title, level: g.level, happiness: g.happiness }))] }))
    setMsgs(msgs.map((m, i) => (i === mi ? { ...m, goals: m.goals.map((g, k) => (ks.includes(k) ? { ...g, added: true } : g)) } : m)))
  }
  const bubble = 'max-w-[80%] break-words px-3.5 py-2 text-[0.9375rem] leading-snug'
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <img src="/favicon.svg" alt="Desker AI agent" className="h-9 w-9" />
        {onClose && <button className="flex min-h-11 items-center rounded-full px-4 text-accent hover:bg-pale" onClick={onClose}>Close</button>}
      </header>
      <div role="log" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3">
        <div className={`${bubble} mr-auto rounded-2xl rounded-bl-md bg-panel text-ink`}>
          Hi! I can help you plan around your tasks, deadlines and free time. How are you feeling today?
        </div>
        {msgs.map((m, i) => (
          <div key={i} className={`${bubble} ${m.role === 'user' ? 'ml-auto rounded-2xl rounded-br-md bg-primary text-ink' : 'mr-auto rounded-2xl rounded-bl-md bg-panel text-ink'}`}>
            {m.label ?? m.content}
            {m.goals?.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {m.goals.map((g, k) => (
                  <li key={k} className="rounded-xl bg-white p-2 text-sm">
                    <span className="text-xs text-slate-600">{LEVELS[g.level].name}{g.happiness ? ' · happiness' : ''}</span><br />{g.title}
                    <button className={`${btn} mt-1 block !px-3 !py-1 ${g.added ? 'bg-slate-100 text-slate-600' : BLUE}`} disabled={g.added}
                      onClick={() => addGoals(i, [k])}>{g.added ? 'Added' : 'Add goal'}</button>
                  </li>
                ))}
                {m.goals.some((g) => !g.added) && <li><button className={`${btn} ${BLUE} !py-1.5`} onClick={() => addGoals(i, m.goals.flatMap((g, k) => (g.added ? [] : [k])))}>Add all</button></li>}
              </ul>
            )}
          </div>
        ))}
        {busy && (
          <div className="mr-auto flex gap-1 rounded-2xl rounded-bl-md bg-panel px-4 py-3" aria-label="AI agent is typing">
            <span className="dot" /><span className="dot" style={{ animationDelay: '150ms' }} /><span className="dot" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        {error && <p className="text-center text-xs text-danger">{error}</p>}
        <div ref={end} />
      </div>
      {!msgs.length && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {QUICK.map((q) => (
            <button key={q} className="rounded-full border border-control bg-white px-4 py-2 text-sm text-ink transition hover:bg-pale disabled:opacity-60" disabled={busy} onClick={() => chipClick(q)}>{q}</button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-black/5 px-3 pt-2 text-xs text-slate-600">
        <label className="flex items-center gap-2">Free time today (hours)
          <input type="number" min="0" max="24" step="0.5" className={`${input} w-16 !py-1`} placeholder={String(data.freeHours ?? 4)} value={freeTodayOf(data) ?? ''}
            onChange={(e) => setData((d) => ({ ...d, freeToday: e.target.value === '' ? undefined : { date: todayStr(), hours: +e.target.value } }))} />
        </label>
        <label className="flex items-center gap-2">Free time per day (hours)
          <input type="number" min="0" max="24" step="0.5" className={`${input} w-16 !py-1`} placeholder="4" value={data.freeHours ?? ''}
            onChange={(e) => setData((d) => ({ ...d, freeHours: e.target.value === '' ? undefined : +e.target.value }))} />
        </label>
        <p className="w-full">Leave today blank to use your daily number.</p>
      </div>
      <form className="flex items-center gap-2 p-3" onSubmit={submit}>
        <label className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-panel text-slate-700 transition hover:bg-slate-300 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
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

