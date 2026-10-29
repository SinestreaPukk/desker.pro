import { useState, useEffect, useRef } from 'react'
import { post } from '../api.js'
import { addTasks, timeRatio } from '../tasks.js'
import Syllabus from '../Syllabus.jsx'
import { BLUE, btn, input, ghost, panel, Q, LEVELS } from '../ui.js'
import { quadrant, ratioOf, todayStr, fmtDate, readSource } from '../shared.jsx'

function DeadlineCard({ dl, goals, tasks, setTasks, patch, remove, ratio }) {
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
  const linked = tasks.filter((t) => t.deadlineId === dl.id).length

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
      return { title: o.title, due: ok(o.due) ? o.due : dl.date, hours: Number(o.hours) || undefined, deadlineId: dl.id }
    })))
    setRes(null)
  }
  const toggle = (i) => setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i])

  return (
    <li className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words font-semibold">{dl.title}</h3>
          <p className="text-sm text-slate-600">
            {dl.date} · {days < 0 ? 'passed' : days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} left`}
            {dl.hours != null && ` · ${dl.hours}h needed`}{linked > 0 && ` · ${linked} task${linked === 1 ? '' : 's'} added`}
          </p>
        </div>
        <span className="flex gap-1">
          <button className={`${btn} ${BLUE}`} disabled={busy} onClick={() => plan()}>
            {busy ? 'Thinking…' : res?.options ? 'Re-plan' : 'Plan with AI'}
          </button>
          <button className={`${btn} text-danger hover:bg-slate-50`} aria-label={`Delete ${dl.title}`} onClick={remove}>Delete</button>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        {ratio && ratio !== 1 && <span className="text-xs text-slate-600">Your timed tasks take about {ratio}x your estimates; the AI allows for that.</span>}
        <label className="flex items-center gap-1">Hours I need
          <input type="number" min="0" step="0.5" className={`${input} w-20`} placeholder="Not sure" value={dl.hours ?? ''}
            onChange={(e) => patch({ hours: e.target.value === '' ? null : +e.target.value })} />
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
          <p className="mb-2 text-sm text-slate-600">{res.summary} Pick the tasks to add.</p>
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
            Add {picked.length} task{picked.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </li>
  )
}

export default function Deadlines({ goals, deadlines, setDeadlines, tasks, setTasks }) {
  const blank = { title: '', date: '', time: '', hours: '', context: '' }
  const [d, setD] = useState(blank)
  const submit = (e) => {
    e.preventDefault()
    if (!d.title.trim() || !d.date) return
    setDeadlines([...deadlines, { id: Date.now(), title: d.title.trim(), date: d.date, time: d.time || undefined, hours: d.hours === '' ? null : +d.hours, context: d.context }])
    setD(blank)
  }
  const patch = (id) => (p) => setDeadlines(deadlines.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <>
      <Syllabus deadlines={deadlines} setDeadlines={setDeadlines} tasks={tasks} setTasks={setTasks} ratio={ratioOf(tasks)} />
      <form className="mb-4 flex flex-wrap items-start gap-3 rounded-2xl bg-panel p-4" onSubmit={submit}>
        <input className={`${input} min-w-48 flex-1`} placeholder="Deadline, e.g. Statics quiz" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        <input type="date" aria-label="Date" className={input} value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        <input type="time" aria-label="Time (optional)" title="Time (optional)" className={input} value={d.time} onChange={(e) => setD({ ...d, time: e.target.value })} />
        <input type="number" min="0" step="0.5" aria-label="Hours needed" className={`${input} w-36`} placeholder="Hours (opt.)" value={d.hours} onChange={(e) => setD({ ...d, hours: e.target.value })} />
        <textarea className={`${input} w-full`} rows={2} aria-label="Context" placeholder="Not sure about the hours? Add syllabus, topics, or how ready you feel (optional)"
          value={d.context} onChange={(e) => setD({ ...d, context: e.target.value })} />
        <button className={`${btn} ${BLUE}`}>Add deadline</button>
      </form>
      {!deadlines.length && <p className="text-sm text-slate-600">No deadlines yet.</p>}
      <ul className="space-y-3">
        {[...deadlines].sort((a, b) => a.date.localeCompare(b.date)).map((dl) => (
          <DeadlineCard key={dl.id} dl={dl} goals={goals} tasks={tasks} setTasks={setTasks} ratio={ratioOf(tasks)} patch={patch(dl.id)}
            remove={() => setDeadlines(deadlines.filter((x) => x.id !== dl.id))} />
        ))}
      </ul>
    </>
  )
}

// Learned energy hours and the user's real-vs-estimated time, passed to the AI so plans can use them.