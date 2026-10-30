import { useState } from 'react'
import { post } from '../api.js'
import { addTasks, timeRatio } from '../tasks.js'
import { BLUE, btn, input, ghost, panel, Q, LEVELS } from '../ui.js'
import { ratioOf, fmtDate, readSource } from '../shared.jsx'

export function DeadlineCard({ dl, goals, projects = [], tasks, setTasks, patch, remove, ratio }) {
  const [res, setRes] = useState(null) // { question } or { hours, summary, options }
  const [picked, setPicked] = useState([])
  const [answer, setAnswer] = useState('')
  const [asked, setAsked] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [reading, setReading] = useState(false)
  const days = Math.ceil((new Date(dl.date) - new Date(new Date().toLocaleDateString('sv'))) / 864e5)
  const mine = tasks.filter((t) => t.deadlineId === dl.id)
  const linked = mine.length
  const [own, setOwn] = useState('')

  const plan = async (context = dl.context) => {
    setBusy(true); setError('')
    try {
      const out = await post('/api/deadline', {
        goals: goals.map(({ id, title, level, happiness }) => ({ id, level: LEVELS[level].name, kind: happiness ? 'happiness' : 'work', title })),
        deadline: { title: dl.title, date: dl.date, hours: dl.hours ?? null, context }, asked, ratio,
      })
      if (out.question) { setAsked(asked + 1); setRes({ question: out.question }) }
      else if (Array.isArray(out.options)) {
        setRes(out); setPicked(out.options.map((_, i) => i))
        if (dl.hours == null && Number.isFinite(out.hours)) patch({ hours: out.hours })
      } else throw new Error('Unexpected answer from AI')
    } catch (err) { setError(err.message) }
    setBusy(false)
  }
  const attach = async (src, label) => {
    setReading(true); setError('')
    try {
      const notes = await readSource(src)
      patch({ context: `${dl.context || ''}\n[From ${label}]\n${notes}`.trim() })
      setLink(''); setOpen(true)
    } catch (err) { setError(err.message) }
    setReading(false)
  }
  const reply = (e) => {
    e.preventDefault()
    if (!answer.trim()) return
    const context = `${dl.context || ''}\nQ: ${res.question}\nA: ${answer.trim()}`.trim()
    patch({ context }); setAnswer(''); plan(context)
  }
  const add = () => {
    const ok = (d) => /^\d{4}-\d\d-\d\d$/.test(d) && d <= dl.date
    setTasks(addTasks(tasks, picked.map((i) => {
      const o = res.options[i]
      return { title: o.title, due: ok(o.due) ? o.due : dl.date, hours: Number(o.hours) || undefined, deadlineId: dl.id, projectId: dl.projectId }
    })))
    setRes(null)
  }
  const addOwn = (e) => {
    e.preventDefault()
    if (!own.trim()) return
    setTasks(addTasks(tasks, [{ title: own, due: dl.date, deadlineId: dl.id, projectId: dl.projectId }]))
    setOwn('')
  }
  const toggle = (i) => setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i])

  return (
    <li className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className={`break-words font-semibold ${dl.done ? 'text-slate-500 line-through' : ''}`}>{dl.title}</h3>
          <p className="text-sm text-slate-600">
            {dl.date} · {dl.done ? 'done' : days < 0 ? 'passed' : days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} left`}
            {dl.hours != null && ` · ${dl.hours}h needed`}{linked > 0 && ` · ${linked} task${linked === 1 ? '' : 's'} added`}
          </p>
        </div>
        <span className="flex gap-1">
          <button className={`${btn} ${dl.done ? BLUE : ghost}`} onClick={() => { patch({ done: !dl.done }); if (!dl.done) setTasks(tasks.map((t) => (t.deadlineId === dl.id ? { ...t, done: true } : t))) }}>{dl.done ? 'Reopen' : 'Mark done'}</button>
          <button className={`${btn} ${BLUE}`} disabled={busy} onClick={() => plan()}>
            {busy ? 'Thinking…' : res?.options ? 'Re-plan' : '✨ Break into tasks'}
          </button>
          <button className={`${btn} text-danger hover:bg-slate-50`} aria-label={`Delete ${dl.title}`} onClick={remove}>Delete</button>
        </span>
      </div>

      <ul className="mt-3 space-y-1">
        {mine.map((t) => (
          <li key={t.id} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={!!t.done} aria-label={`Done: ${t.title}`} onChange={() => setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} />
            <span className={`min-w-0 flex-1 break-words ${t.done ? 'text-slate-500 line-through' : ''}`}>{t.title}</span>
            <span className="shrink-0 text-xs text-slate-600">{t.hours ? `${t.hours}h` : ''}{t.due ? ` · ${fmtDate(t.due)}` : ''}</span>
          </li>
        ))}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={addOwn}>
        <input className={`${input} min-w-0 flex-1`} aria-label={`New task for ${dl.title}`} placeholder="Add your own task for this deadline" value={own} onChange={(e) => setOwn(e.target.value)} />
        <button className={`${btn} ${ghost}`}>Add</button>
      </form>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-accent">Edit details and context</summary>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {ratio && ratio !== 1 && <span className="text-xs text-slate-600">Your timed tasks take about {ratio}x your estimates; the AI allows for that.</span>}
          <label className="flex items-center gap-1">Hours I need
            <input type="number" min="0" step="0.5" className={`${input} w-20`} placeholder="Not sure" value={dl.hours ?? ''}
              onChange={(e) => patch({ hours: e.target.value === '' ? null : +e.target.value })} />
          </label>
          <label className="flex items-center gap-1">Project
            <select className={input} value={dl.projectId ?? ''} onChange={(e) => {
              const projectId = e.target.value === '' ? undefined : +e.target.value
              patch({ projectId }); setTasks(tasks.map((t) => (t.deadlineId === dl.id ? { ...t, projectId } : t))) // its tasks follow
            }}>
              <option value="">None</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">Date
            <input type="date" className={input} value={dl.date} onChange={(e) => e.target.value && patch({ date: e.target.value })} />
          </label>
          <label className="flex items-center gap-1">Time
            <input type="time" className={input} value={dl.time || ''} onChange={(e) => patch({ time: e.target.value || undefined })} />
          </label>
          <button className="text-accent-dark underline" onClick={() => setOpen(!open)}>{open ? 'Hide context' : dl.context ? 'Edit context' : 'Add context'}</button>
        </div>
        {open && (
          <textarea className={`${input} mt-2 w-full`} rows={4} aria-label="Context"
            placeholder="Not sure how long it takes? Paste a syllabus, topics, notes, or say how ready you feel."
            value={dl.context || ''} onChange={(e) => patch({ context: e.target.value })} />
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <label className={`${btn} cursor-pointer ${ghost} ${reading ? 'pointer-events-none opacity-50' : ''}`}>
            {reading ? 'Reading…' : 'Attach photo or file'}
            <input type="file" className="sr-only" accept="image/*,application/pdf,.txt,.md,.csv,.json,.ics" disabled={reading}
              onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) attach({ file: f }, f.name) }} />
          </label>
          <form className="flex min-w-48 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); if (link.trim()) attach({ url: link.trim() }, link.trim()) }}>
            <input className={`${input} min-w-0 flex-1`} aria-label="Web link" placeholder="Paste a link (syllabus, assignment page)" value={link} onChange={(e) => setLink(e.target.value)} />
            <button className={`${btn} ${ghost}`} disabled={reading || !link.trim()}>Read</button>
          </form>
        </div>

      </details>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {res?.question && (
        <form className="mt-3 rounded-xl bg-pale p-3 text-sm" onSubmit={reply}>
          <p className="mb-2 font-medium">{res.question}</p>
          <div className="flex gap-2">
            <input className={`${input} min-w-0 flex-1`} aria-label="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
            <button className={`${btn} ${BLUE}`} disabled={busy}>Answer</button>
          </div>
        </form>
      )}
      {res?.options && (
        <div className="mt-3">
          <p className="mb-2 text-sm text-slate-600">{res.summary} {res.options.length > 1 ? `This needs ${res.options.length} tasks. Split the work?` : 'One task is enough.'}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {res.options.map((o, i) => (
              <li key={i}>
                <label className={`flex cursor-pointer gap-2 rounded-2xl border p-2 text-sm ${picked.includes(i) ? 'border-accent bg-accent/10' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={picked.includes(i)} onChange={() => toggle(i)} />
                  <span><b className="font-medium">{o.title}</b><br /><span className="text-slate-600">{o.hours}h · by {o.due}</span></span>
                </label>
              </li>
            ))}
          </ul>
          <button className={`${btn} mt-3 ${BLUE}`} disabled={!picked.length} onClick={add}>
            Split into {picked.length} task{picked.length === 1 ? '' : 's'}
          </button>
          <button className={`${btn} ml-2 ${ghost}`} onClick={() => setRes(null)}>Keep as is</button>
        </div>
      )}
    </li>
  )
}
