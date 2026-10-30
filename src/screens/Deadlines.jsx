import { useState } from 'react'
import { post } from '../api.js'
import { addTasks, timeRatio } from '../tasks.js'
import { BLUE, btn, input, ghost, panel, LEVELS } from '../ui.js'
import { fmtDuration } from '../format.js'
import { ratioOf, fmtDate, readSource } from '../shared.jsx'
import { Button } from '../components/ui.jsx'

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
  const upd = (id, patch) => setTasks(tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const addOwn = (e) => {
    e.preventDefault()
    if (!own.trim()) return
    setTasks(addTasks(tasks, [{ title: own, due: dl.date, deadlineId: dl.id, projectId: dl.projectId }]))
    setOwn('')
  }
  const toggle = (i) => setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i])

  return (
    <li className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 pb-2">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <input key={dl.title} size={Math.max(8, Math.min(40, dl.title.length + 1))} className={`min-w-0 max-w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-base font-semibold hover:border-control focus:border-accent focus:bg-white ${dl.done ? 'text-slate-500 line-through' : ''}`}
            aria-label="Deadline name (click to rename)" defaultValue={dl.title} maxLength={200} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== dl.title) patch({ title: v }); else e.target.value = dl.title }} />
          <input type="date" className="w-36 rounded-lg border border-transparent bg-transparent px-1 py-1 text-sm text-slate-600 hover:border-control focus:border-accent focus:bg-white" aria-label="Deadline date"
            value={dl.date} onChange={(e) => e.target.value && patch({ date: e.target.value })} />
          <input type="time" className="w-24 rounded-lg border border-transparent bg-transparent px-1 py-1 text-sm text-slate-600 hover:border-control focus:border-accent focus:bg-white" aria-label="Deadline time (optional)"
            value={dl.time || ''} onChange={(e) => patch({ time: e.target.value || undefined })} />
          {dl.hours != null && <span className="text-sm text-slate-600">{fmtDuration(dl.hours)}</span>}
        </span>
        {linked > 0 && <span className="text-sm tabular-nums text-slate-600">{mine.filter((t) => t.done).length}/{linked}</span>}
        <span className={`rounded-full px-3 py-0.5 text-sm ${dl.done ? 'bg-panel text-slate-600' : days <= 1 ? 'bg-[#fdf1ee] text-[#7a1a14]' : 'bg-pale text-accent-dark'}`}>
          {dl.done ? 'Done' : days < 0 ? 'Passed' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}
        </span>
      </div>
      <ul className="space-y-1 px-4 pb-1">
        {mine.map((t) => (
          <li key={t.id} className="flex min-h-11 flex-wrap items-center gap-x-1 gap-y-1 text-sm">
            <input type="checkbox" checked={!!t.done} aria-label={`Done: ${t.title}`} onChange={() => upd(t.id, { done: !t.done })} />
            <input key={t.title} size={Math.max(6, Math.min(40, t.title.length + 1))} className={`min-w-0 max-w-full rounded-lg border border-transparent bg-transparent px-2 py-1 hover:border-control focus:border-accent focus:bg-white ${t.done ? 'text-slate-500 line-through' : ''}`}
              aria-label="Task name (click to rename)" defaultValue={t.title} maxLength={200}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.title) upd(t.id, { title: v }); else e.target.value = t.title }} />
            <input type="date" className="w-36 rounded-lg border border-transparent bg-transparent px-1 py-1 text-xs text-slate-600 hover:border-control focus:border-accent focus:bg-white" aria-label={`Date for ${t.title}`}
              value={t.due || ''} onChange={(e) => upd(t.id, { due: e.target.value || undefined })} />
            <input type="time" className="w-24 rounded-lg border border-transparent bg-transparent px-1 py-1 text-xs text-slate-600 hover:border-control focus:border-accent focus:bg-white" aria-label={`Time for ${t.title} (optional)`}
              value={t.start || ''} onChange={(e) => upd(t.id, e.target.value ? { start: e.target.value, when: t.when || t.due || dl.date } : { start: undefined, when: undefined })} />
            {t.hours > 0 && <span className="text-xs text-slate-600">{fmtDuration(t.hours)}</span>}
          </li>
        ))}
      </ul>
      <form className="px-4 pb-3" onSubmit={addOwn}>
        <input className="w-full rounded-lg border border-transparent bg-transparent px-2 py-2 text-sm placeholder:text-slate-500 hover:border-control focus:border-accent focus:bg-white" aria-label={`Add a task to ${dl.title}`} placeholder="+ Add a task (press Enter)" value={own} onChange={(e) => setOwn(e.target.value)} />
      </form>
      <details className="group border-t border-line">
        <summary className="cursor-pointer px-4 py-2 text-sm text-accent">{linked ? 'More: AI, hours, project, context' : 'Break into tasks with AI, more'}</summary>
        <div className="border-t border-line p-4 pt-3">
      <div className="mb-3 flex flex-wrap gap-2">
        <button className={`${btn} ${dl.done ? BLUE : ghost}`} onClick={() => { patch({ done: !dl.done }); if (!dl.done) setTasks(tasks.map((t) => (t.deadlineId === dl.id ? { ...t, done: true } : t))) }}>{dl.done ? 'Reopen' : 'Mark done'}</button>
        <Button variant="primary" disabled={busy} onClick={() => plan()}>
          {busy ? 'Thinking…' : res?.options ? 'Re-plan' : linked ? '✨ Add more with AI' : '✨ Break into tasks'}
        </Button>
        <button className={`${btn} text-danger hover:bg-slate-50`} aria-label={`Delete ${dl.title}`} onClick={remove}>Delete</button>
      </div>


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
            <Button variant="secondary" disabled={reading || !link.trim()}>Read</Button>
          </form>
        </div>

      </details>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {res?.question && (
        <form className="mt-3 rounded-xl bg-pale p-3 text-sm" onSubmit={reply}>
          <p className="mb-2 font-medium">{res.question}</p>
          <div className="flex gap-2">
            <input className={`${input} min-w-0 flex-1`} aria-label="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
            <Button variant="primary" disabled={busy}>Answer</Button>
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
                  <span><b className="font-medium">{o.title}</b><br /><span className="text-slate-600">{fmtDuration(o.hours)} · by {o.due}</span></span>
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
        </div>
      </details>
    </li>
  )
}
