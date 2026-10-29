import { useState } from 'react'
import { post } from '../api.js'
import { addTasks } from '../tasks.js'
import { progress, unlink } from '../projects.js'
import { BLUE, btn, input, ghost, panel, LEVELS } from '../ui.js'
import { ratioOf, fmtDate } from '../shared.jsx'

const KINDS = ['Investment', 'Exam', 'Test', 'Study', 'Work', 'Trip', 'Personal']

function ProjectCard({ p, goals, tasks, setTasks, patch, remove, ratio }) {
  const [res, setRes] = useState(null) // { question } or { hours, summary, options }
  const [picked, setPicked] = useState([])
  const [answer, setAnswer] = useState('')
  const [asked, setAsked] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const mine = tasks.filter((t) => t.projectId === p.id && !t.fun)
  const pr = progress(p, tasks)
  const goal = goals.find((g) => g.id === p.goalId)

  const plan = async (context = p.context) => {
    setBusy(true); setError('')
    try {
      const out = await post('/api/deadline', {
        goals: goals.map(({ id, title, level, happiness }) => ({ id, level: LEVELS[level].name, kind: happiness ? 'happiness' : 'work', title })),
        project: { title: p.title, kind: p.kind, date: p.date, hours: p.hours ?? null, context },
        tasks: mine.map(({ title, done }) => ({ title, done })), asked, ratio,
      })
      if (out.question) { setAsked(asked + 1); setRes({ question: out.question }) }
      else if (Array.isArray(out.options)) { setRes(out); setPicked(out.options.map((_, i) => i)) }
      else throw new Error('Unexpected answer from AI')
    } catch (err) { setError(err.message) }
    setBusy(false)
  }
  const reply = (e) => {
    e.preventDefault()
    if (!answer.trim()) return
    const context = `${p.context || ''}\nQ: ${res.question}\nA: ${answer.trim()}`.trim()
    patch({ context }); setAnswer(''); plan(context)
  }
  const add = () => {
    const ok = (d) => /^\d{4}-\d\d-\d\d$/.test(d) && (!p.date || d <= p.date)
    setTasks(addTasks(tasks, picked.map((i) => {
      const o = res.options[i]
      return { title: o.title, due: ok(o.due) ? o.due : p.date, hours: Number(o.hours) || undefined, projectId: p.id, goalId: p.goalId }
    })))
    setRes(null)
  }
  const addOne = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setTasks(addTasks(tasks, [{ title, due: p.date, projectId: p.id, goalId: p.goalId }]))
    setTitle('')
  }
  const toggle = (i) => setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i])

  return (
    <li className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words font-semibold">{p.title} <span className="ml-1 rounded-full bg-pale px-2 py-0.5 text-xs font-normal text-accent-dark">{p.kind || 'Project'}</span></h3>
          <p className="text-sm text-slate-600">
            {p.date ? `Ends ${fmtDate(p.date)}` : 'No end date'}{goal && ` · ${goal.title}`}
            {pr.total > 0 && ` · ${pr.done}/${pr.total} done`}{pr.hoursLeft > 0 && ` · ${pr.hoursLeft}h left`}
          </p>
        </div>
        <span className="flex gap-1">
          <button className={`${btn} ${BLUE}`} disabled={busy} onClick={() => plan()}>{busy ? 'Thinking…' : 'Break down with AI'}</button>
          <button className={`${btn} text-danger hover:bg-slate-50`} aria-label={`Delete ${p.title}`}
            onClick={() => { if (confirm(`Delete ${p.title}? Its ${pr.total} tasks stay, without a project.`)) remove() }}>Delete</button>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel" role="progressbar" aria-valuenow={pr.pct} aria-valuemin="0" aria-valuemax="100" aria-label="Progress">
        <div className="h-full bg-primary" style={{ width: `${pr.pct}%` }} />
      </div>

      <ul className="mt-3 space-y-1">
        {mine.map((t) => (
          <li key={t.id} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={!!t.done} aria-label={`Done: ${t.title}`} onChange={() => setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} />
            <span className={`min-w-0 flex-1 break-words ${t.done ? 'text-slate-500 line-through' : ''}`}>{t.title}</span>
            <span className="shrink-0 text-xs text-slate-600">{t.hours ? `${t.hours}h` : ''}{t.due ? ` · ${fmtDate(t.due)}` : ''}</span>
          </li>
        ))}
        {!mine.length && <li className="text-sm text-slate-600">No tasks yet. Add one, or let the AI break it down.</li>}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={addOne}>
        <input className={`${input} min-w-0 flex-1`} aria-label={`New task for ${p.title}`} placeholder="Add a task to this project" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className={`${btn} ${ghost}`}>Add</button>
      </form>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-accent">Details</summary>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1">End date
            <input type="date" className={input} value={p.date || ''} onChange={(e) => patch({ date: e.target.value || undefined })} />
          </label>
          <label className="flex items-center gap-1">Hours I need
            <input type="number" min="0" step="0.5" className={`${input} w-20`} placeholder="Not sure" value={p.hours ?? ''} onChange={(e) => patch({ hours: e.target.value === '' ? null : +e.target.value })} />
          </label>
          <label className="flex items-center gap-1">Goal
            <select className={input} value={p.goalId ?? ''} onChange={(e) => patch({ goalId: e.target.value === '' ? undefined : +e.target.value })}>
              <option value="">None</option>
              {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </label>
        </div>
        <textarea className={`${input} mt-2 w-full`} rows={3} aria-label="Context" placeholder="Scope, notes, how ready you feel. The AI uses this to plan."
          value={p.context || ''} onChange={(e) => patch({ context: e.target.value })} />
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
          <p className="mb-2 text-sm text-slate-600">{res.summary} Pick the tasks to add.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {res.options.map((o, i) => (
              <li key={i}>
                <label className={`flex cursor-pointer gap-2 rounded-2xl border p-2 text-sm ${picked.includes(i) ? 'border-accent bg-accent/10' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={picked.includes(i)} onChange={() => toggle(i)} />
                  <span><b className="font-medium">{o.title}</b><br /><span className="text-slate-600">{o.hours}h{o.due ? ` · by ${o.due}` : ''}</span></span>
                </label>
              </li>
            ))}
          </ul>
          <button className={`${btn} mt-3 ${BLUE}`} disabled={!picked.length} onClick={add}>Add {picked.length} task{picked.length === 1 ? '' : 's'}</button>
        </div>
      )}
    </li>
  )
}

// Projects: bigger than a task. A project (investment, exam, test...) owns tasks and shows how far along it is.
export default function Projects({ goals, projects, setProjects, tasks, setTasks }) {
  const blank = { title: '', kind: 'Investment', date: '', context: '' }
  const [d, setD] = useState(blank)
  const submit = (e) => {
    e.preventDefault()
    if (!d.title.trim()) return
    setProjects([...projects, { id: Date.now(), title: d.title.trim(), kind: d.kind.trim() || undefined, date: d.date || undefined, context: d.context }])
    setD(blank)
  }
  const patch = (id) => (p) => setProjects(projects.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <>
      <form className="mb-4 flex flex-wrap items-start gap-3 rounded-2xl bg-panel p-4" onSubmit={submit}>
        <input className={`${input} min-w-48 flex-1`} aria-label="Project name" placeholder="Project, e.g. Build an index-fund portfolio" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        <input className={`${input} w-36`} list="project-kinds" aria-label="Kind" placeholder="Kind" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value })} />
        <datalist id="project-kinds">{KINDS.map((k) => <option key={k} value={k} />)}</datalist>
        <input type="date" aria-label="End date (optional)" title="End date (optional)" className={input} value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        <textarea className={`${input} w-full`} rows={2} aria-label="Context" placeholder="What is it about? Scope, budget, topics, how ready you feel (optional)"
          value={d.context} onChange={(e) => setD({ ...d, context: e.target.value })} />
        <button className={`${btn} ${BLUE}`}>Add project</button>
      </form>
      {!projects.length && <p className="text-sm text-slate-600">No projects yet. A project groups the tasks of something bigger: an investment plan, a final exam, a launch.</p>}
      <ul className="space-y-3">
        {projects.map((p) => (
          <ProjectCard key={p.id} p={p} goals={goals} tasks={tasks} setTasks={setTasks} ratio={ratioOf(tasks)} patch={patch(p.id)}
            remove={() => { setTasks(unlink(tasks, p.id)); setProjects(projects.filter((x) => x.id !== p.id)) }} />
        ))}
      </ul>
    </>
  )
}
