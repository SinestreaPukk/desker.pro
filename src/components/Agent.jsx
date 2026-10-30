import { useState, useEffect, useRef } from 'react'
import { post } from '../api.js'
import { BLUE, btn, ghost, input, LEVELS } from '../ui.js'
import { Avatar } from '../px.jsx'
import { Icon } from '../icons.jsx'
import { weekReview } from '../review.js'
import { patternOf, ratioOf, readSource, busyForAI, freeTodayOf, applyPlan, QUICK, todayStr } from '../shared.jsx'

export default function Agent({ data, setData, onClose, onReplan, onGuide, reviewReq }) {
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
  const chipClick = (q) => (q === 'Replan my week' ? onReplan() : q === 'Weekly review' ? review() : q === 'Help me find my goals' ? onGuide() : send(q))
  const addGoals = (mi, ks) => {
    const picked = ks.map((k) => msgs[mi].goals[k])
    setData((d) => ({ ...d, goals: [...d.goals, ...picked.map((g, n) => ({ id: Date.now() + n, title: g.title, level: g.level, happiness: g.happiness }))] }))
    setMsgs(msgs.map((m, i) => (i === mi ? { ...m, goals: m.goals.map((g, k) => (ks.includes(k) ? { ...g, added: true } : g)) } : m)))
  }
  const bubble = 'max-w-[80%] break-words px-3 py-2'
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <Avatar label="Desker AI agent" />
        {onClose && <button className={`${btn} ${ghost}`} onClick={onClose}>Close</button>}
      </header>
      <div role="log" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3">
        <div className="mr-auto flex items-start gap-2">
          <Avatar />
          <div className={`${bubble} px-sunk`}>Hi! I can help you plan around your tasks, deadlines and free time. How are you feeling today?</div>
        </div>
        {msgs.map((m, i) => (
          <div key={i} className={`flex items-start gap-2 ${m.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
            {m.role !== 'user' && <Avatar />}
            <div className={`${bubble} ${m.role === 'user' ? 'px-btn-primary' : 'px-sunk'}`}>
            {m.label ?? m.content}
            {m.goals?.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {m.goals.map((g, k) => (
                  <li key={k} className="px-rule py-2">
                    <span className="text-xs">{LEVELS[g.level].name}{g.happiness ? ', happiness' : ''}</span><br />{g.title}
                    <button className={`${btn} mt-1 ${g.added ? ghost : BLUE}`} disabled={g.added}
                      onClick={() => addGoals(i, [k])}>{g.added ? 'Added' : 'Add goal'}</button>
                  </li>
                ))}
                {m.goals.some((g) => !g.added) && <li><button className={`${btn} ${BLUE}`} onClick={() => addGoals(i, m.goals.flatMap((g, k) => (g.added ? [] : [k])))}>Add all</button></li>}
              </ul>
            )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="mr-auto flex items-center gap-2" role="status" aria-label="AI agent is typing"><Avatar /><span className="px-sunk flex gap-1 px-3 py-3">
            <span className="dot" /><span className="dot" style={{ animationDelay: '150ms' }} /><span className="dot" style={{ animationDelay: '300ms' }} /></span>
          </div>
        )}
        {error && <p className="text-center text-xs text-danger">{error}</p>}
        <div ref={end} />
      </div>
      {!msgs.length && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {QUICK.map((q) => (
            <button key={q} className={`${btn} ${ghost}`} disabled={busy} onClick={() => chipClick(q)}>{q}</button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 pt-2 text-xs text-slate-600">
        <label className="flex items-center gap-2">Free time today (hours)
          <input type="number" min="0" max="24" step="0.5" className={`${input} w-20`} placeholder={String(data.freeHours ?? 4)} value={freeTodayOf(data) ?? ''}
            onChange={(e) => setData((d) => ({ ...d, freeToday: e.target.value === '' ? undefined : { date: todayStr(), hours: +e.target.value } }))} />
        </label>
        <label className="flex items-center gap-2">Free time per day (hours)
          <input type="number" min="0" max="24" step="0.5" className={`${input} w-20`} placeholder="4" value={data.freeHours ?? ''}
            onChange={(e) => setData((d) => ({ ...d, freeHours: e.target.value === '' ? undefined : +e.target.value }))} />
        </label>
        <p className="w-full">Leave today blank to use your daily number.</p>
      </div>
      <form className="flex items-center gap-2 p-3" onSubmit={submit}>
        <label className={`${btn} ${ghost} w-11 shrink-0 !px-0 ${busy ? 'pointer-events-none text-yoru-0' : ''}`}>
          <span className="sr-only">Attach a photo, PDF or text file</span>
          <Icon name="Add" />
          <input type="file" className="sr-only" accept="image/*,application/pdf,.txt,.md,.csv,.json,.ics" disabled={busy}
            onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) attachFile(f) }} />
        </label>
        <div className="relative flex-1">
          <input className={`${input} w-full pr-14`} aria-label="Message" placeholder="Message or paste a link" value={text} onChange={(e) => setText(e.target.value)} />
          <button className={`absolute right-1 top-1/2 -translate-y-1/2 ${text.trim() && !busy ? 'px-btn flex w-11' : 'hidden'}`} aria-label="Send" tabIndex={text.trim() && !busy ? 0 : -1}>
            <Icon name="Send" />
          </button>
        </div>
      </form>
    </div>
  )
}

