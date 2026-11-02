import { useState } from 'react'
import { post } from '../api.js'
import { addTasks, timeRatio } from '../tasks.js'
import { validType } from '../rhythm.js'
import { BLUE, btn, input, ghost, panel, Q, LEVELS } from '../ui.js'
import { ratioOf, fmtDate, readSource, plannerArgs, busyForAI, patternOf, freeTodayOf } from '../shared.jsx'
import { planWeek, withSlot } from '../schedule.js'
import { withPlanned } from '../taskTime.js'
import { timeProfile } from '../rhythm.js'
import { getTaskTime, timeLabel, workLeft, workLeftText } from '../taskTime.js'
import SaveButton from '../components/SaveButton.jsx'
import DateField from '../components/DateField.jsx'

export function DeadlineCard({ data, dl, goals, projects = [], tasks, setTasks, patch, remove, ratio, rhythm }) {
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
  const finished = dl.done || (linked > 0 && mine.every((t) => t.done)) // crossed out once every linked task is done
  const left = finished ? null : linked ? workLeft(mine, rhythm) : dl.hours > 0 ? workLeft([{ title: dl.title, hours: dl.hours }], rhythm) : null // Desker's planned time for what is not done yet
  const [own, setOwn] = useState('')
  const [sched, setSched] = useState(null) // { busy } | { error } | { options: [{ name, note, sessions }] }

  // Ask the AI to split this deadline's open tasks into sessions and offer three schedules. Only the shape is checked here; the slots are checked again when one is applied.
  const openMine = mine.filter((t) => !t.done)
  const today = new Date().toLocaleDateString('sv')
  const askSchedule = async () => {
    setSched({ busy: true })
    try {
      const out = await post('/api/deadline', { split: {
        deadline: { title: dl.title, date: dl.date, time: dl.time },
        tasks: withPlanned(openMine, timeProfile(data)).map(({ id, title, hours, plannedMinutes, due }) => ({ id, title, hours, plannedMinutes, due })),
        freeHours: data.freeHours, busy: busyForAI(data.busy), energy: patternOf(data), ratio, now: new Date().toLocaleString(),
      } })
      const ids = new Set(openMine.map((t) => t.id))
      const options = (Array.isArray(out.options) ? out.options : []).map((o) => ({
        name: String(o.name || 'Option').slice(0, 40), note: String(o.note || '').slice(0, 200),
        sessions: (Array.isArray(o.sessions) ? o.sessions : []).filter((s) => ids.has(s?.id) && s.title && +s.hours > 0 && /^\d{4}-\d\d-\d\d$/.test(s.when) && s.when >= today && s.when <= dl.date)
          .map((s) => ({ id: s.id, title: String(s.title).slice(0, 200), hours: Math.round(Math.min(+s.hours, 1.5) * 4) / 4, when: s.when, start: /^\d\d:\d\d$/.test(s.start) ? s.start : undefined }))
          .sort((a, b) => (a.when + (a.start || '')).localeCompare(b.when + (b.start || ''))),
      })).filter((o) => o.sessions.length)
      if (!options.length) throw new Error('The AI gave no usable schedule. Try again.')
      setSched({ options })
    } catch (err) { setSched({ error: err.message }) }
  }
  // The first session of a task updates it, the rest become new tasks; then the planner places every session, honouring the AI's slots where they are free.
  const applySchedule = (o) => {
    const first = new Set()
    let next = tasks.map((t) => {
      const s = o.sessions.find((x) => x.id === t.id)
      if (!s) return t
      first.add(t.id)
      return { ...t, title: s.title, hours: s.hours, when: undefined, start: undefined, pinned: undefined }
    })
    const slots = o.sessions.filter((s) => first.has(s.id)).filter((s, i, a) => a.findIndex((y) => y.id === s.id) === i).map(({ id, when, start }) => ({ id, when, start }))
    const rest = o.sessions.filter((s) => !slots.some((x) => x.id === s.id && x.when === s.when && x.start === s.start))
    const before = next.length
    next = addTasks(next, rest.map((s) => { const src = tasks.find((t) => t.id === s.id); return { title: s.title, hours: s.hours, due: dl.date, deadlineId: dl.id, projectId: dl.projectId, goalId: dl.goalId, type: src?.type } }), 'ai')
    rest.forEach((s, k) => slots.push({ id: next[before + k].id, when: s.when, start: s.start }))
    const { plan } = planWeek({ tasks: next, busy: data.busy || [], deadlines: data.deadlines || [], freeHours: data.freeHours ?? 4, freeToday: freeTodayOf(data), aiPlan: slots, ...plannerArgs(data) })
    setTasks(next.map((t) => { const p = plan.find((x) => x.id === t.id); return p ? withSlot(t, p) : t }), { auto: true })
    setSched(null)
  }

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
      return { title: o.title, due: ok(o.due) ? o.due : dl.date, hours: Number(o.hours) || undefined, type: validType(o.type), deadlineId: dl.id, projectId: dl.projectId }
    }), 'ai'))
    setRes(null)
  }
  const upd = (id, patch) => setTasks(tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const addOwn = (e) => {
    e.preventDefault()
    if (!own.trim()) return
    setTasks(addTasks(tasks, [{ title: own, due: dl.date, deadlineId: dl.id, projectId: dl.projectId, goalId: dl.goalId }]))
    setOwn('')
  }
  const toggle = (i) => setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i])

  return (
    <li className={`border ${finished ? 'border-accent bg-panel' : 'border-line bg-white'}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 pb-2">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <input key={dl.title} size={Math.max(8, Math.min(40, dl.title.length + 1))} className={`min-w-0 max-w-full border border-transparent bg-transparent px-2 py-1 text-base font-semibold hover:border-control focus:border-accent focus:bg-white ${finished ? 'text-slate-500 line-through decoration-2' : ''}`}
            aria-label="Deadline name (click to rename)" defaultValue={dl.title} maxLength={200} onKeyDown={(e) => e.key === 'Enter' && e.target.blur() /* pixel-ok: DOM blur() method, not a CSS filter */}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== dl.title) patch({ title: v }); else e.target.value = dl.title }} />
          <DateField className="w-36 border border-transparent bg-transparent px-1 py-1 text-base text-slate-600 hover:border-control focus:border-accent focus:bg-white" aria-label="Deadline date"
            value={dl.date} onChange={(e) => e.target.value && patch({ date: e.target.value })} />
          <input type="time" className="w-32 border border-transparent bg-transparent px-1 py-1 text-base text-slate-600 hover:border-control focus:border-accent focus:bg-white" aria-label="Deadline time (optional)"
            value={dl.time || ''} onChange={(e) => patch({ time: e.target.value || undefined })} />
          {left && left.plannedMinutes > 0 && <span className="text-base text-slate-600" title="Desker's planned time for what is not done, minus time you already focused">{workLeftText(left)}</span>}
        </span>
        <SaveButton />
        {linked > 0 && <span className="text-base tabular-nums text-slate-600">{mine.filter((t) => t.done).length}/{linked}</span>}
        <span className={` px-3 py-0.5 text-base ${finished ? 'bg-accent text-yuki-0' : days <= 1 ? 'bg-beni text-yuki-0' : 'bg-pale text-accent-dark'}`}>
          {finished ? '✓ Done' : days < 0 ? 'Passed' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}
        </span>
      </div>
      {openMine.length > 0 && !finished && (
        <div className="px-4 pb-2">
          <button className={`${btn} ${BLUE}`} disabled={sched?.busy} onClick={askSchedule}>{sched?.busy ? 'Planning…' : 'Split and schedule with AI'}</button>
          {sched?.error && <p className="mt-2 text-base text-danger">{sched.error}</p>}
          {sched?.options && (
            <div className="mt-2 bg-pale p-3 text-base">
              <p className="mb-2 font-medium">Pick a plan. Nothing changes until you do.</p>
              <ul className="grid gap-2 md:grid-cols-3">
                {sched.options.map((o) => (
                  <li key={o.name} className="flex flex-col border border-line bg-white p-2">
                    <b className="font-medium">{o.name}</b>
                    <span className="text-xs text-slate-600">{o.note}</span>
                    <ul className="my-2 flex-1 space-y-1 text-xs">
                      {o.sessions.map((s, i) => <li key={i}><span className="text-slate-600">{fmtDate(s.when)}{s.start ? ` ${s.start}` : ''}, {s.hours}h</span> {s.title}</li>)}
                    </ul>
                    <button className={`${btn} ${BLUE}`} onClick={() => applySchedule(o)}>Use this plan</button>
                  </li>
                ))}
              </ul>
              <button className={`${btn} ${ghost} mt-2`} onClick={() => setSched(null)}>Cancel</button>
            </div>
          )}
        </div>
      )}
      <ul className="space-y-1 px-4 pb-1">
        {mine.map((t) => (
          <li key={t.id} className="flex min-h-11 flex-wrap items-center gap-x-1 gap-y-1 text-base">
            <input type="checkbox" checked={!!t.done} aria-label={`Done: ${t.title}`} onChange={() => upd(t.id, { done: !t.done })} />
            <input key={t.title} size={Math.max(6, Math.min(40, t.title.length + 1))} className={`min-w-0 max-sm:flex-1 max-sm:basis-40 border border-transparent bg-transparent px-2 py-1 hover:border-control focus:border-accent focus:bg-white ${t.done ? 'text-slate-500 line-through' : ''}`}
              aria-label="Task name (click to rename)" defaultValue={t.title} maxLength={200}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur() /* pixel-ok: DOM blur() method, not a CSS filter */}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.title) upd(t.id, { title: v }); else e.target.value = t.title }} />
            <span className="flex basis-full flex-wrap items-center gap-1 pl-8 sm:contents">
            <DateField className="w-36 border border-transparent bg-transparent px-1 py-1 text-xs text-slate-600 hover:border-control focus:border-accent focus:bg-white" aria-label={`Date for ${t.title}`}
              value={t.due || ''} onChange={(e) => upd(t.id, { due: e.target.value || undefined })} />
            <input type="time" className="w-32 border border-transparent bg-transparent px-1 py-1 text-xs text-slate-600 hover:border-control focus:border-accent focus:bg-white" aria-label={`Time for ${t.title} (optional)`}
              value={t.start || ''} onChange={(e) => upd(t.id, e.target.value ? { start: e.target.value, pinned: true, when: t.when || t.due || dl.date } : { start: undefined, pinned: undefined, when: undefined })} />
            {t.hours > 0 && (() => { const tt = getTaskTime(t, rhythm); return <span className="text-xs text-slate-600" title={tt.reason}>{timeLabel(tt)}</span> })()}
            </span>
          </li>
        ))}
      </ul>
      <form className="px-4 pb-3" onSubmit={addOwn}>
        <input className="w-full border border-transparent bg-transparent px-2 py-2 text-base placeholder:text-slate-500 hover:border-control focus:border-accent focus:bg-white" aria-label={`Add a task to ${dl.title}`} placeholder="+ Add a task (press Enter)" value={own} onChange={(e) => setOwn(e.target.value)} />
      </form>
      <details className="group border-t border-line">
        <summary className="cursor-pointer px-4 py-2 text-base text-accent">{linked ? 'More: AI, hours, project, context' : 'Break into tasks with AI, more'}</summary>
        <div className="border-t border-line p-4 pt-3">
      <div className="mb-3 flex flex-wrap gap-2">
        <button className={`${btn} ${dl.done ? BLUE : ghost}`} onClick={() => { patch({ done: !dl.done }); if (!dl.done) setTasks(tasks.map((t) => (t.deadlineId === dl.id ? { ...t, done: true } : t))) }}>{dl.done ? 'Reopen' : 'Mark done'}</button>
        <button className={`${btn} ${BLUE}`} disabled={busy} onClick={() => plan()}>
          {busy ? 'Thinking…' : res?.options ? 'Re-plan' : linked ? 'Add more with AI' : 'Break into tasks'}
        </button>
        <button className={`${btn} text-danger hover:bg-slate-50`} aria-label={`Delete ${dl.title}`} onClick={remove}>Delete</button>
      </div>


      <details className="mt-3">
        <summary className="cursor-pointer text-base text-accent">Edit details and context</summary>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-base">
          {ratio && ratio !== 1 && <span className="text-xs text-slate-600">Your timed tasks take about {ratio}x your estimates; the AI allows for that.</span>}
          <label className="flex items-center gap-1">Hours I need
            <input type="number" min="0" step="0.5" className={`${input} w-20`} placeholder="Not sure" value={dl.hours ?? ''}
              onChange={(e) => patch({ hours: e.target.value === '' ? null : +e.target.value })} />
          </label>
          <label className="flex items-center gap-1">Goal
            <select className={input} value={dl.goalId ?? ''} onChange={(e) => {
              const goalId = e.target.value === '' ? undefined : +e.target.value
              patch({ goalId }); setTasks(tasks.map((t) => (t.deadlineId === dl.id ? { ...t, goalId } : t))) // its tasks follow, and count as hours put into the goal
            }}>
              <option value="">None</option>
              {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
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
            <DateField className={input} value={dl.date} onChange={(e) => e.target.value && patch({ date: e.target.value })} />
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
        <div className="mt-2 flex flex-wrap items-center gap-2 text-base">
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

      {error && <p className="mt-2 text-base text-danger">{error}</p>}
      {res?.question && (
        <form className="mt-3 bg-pale p-3 text-base" onSubmit={reply}>
          <p className="mb-2 font-medium">{res.question}</p>
          <div className="flex gap-2">
            <input className={`${input} min-w-0 flex-1`} aria-label="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
            <button className={`${btn} ${BLUE}`} disabled={busy}>Answer</button>
          </div>
        </form>
      )}
      {res?.options && (
        <div className="mt-3">
          <p className="mb-2 text-base text-slate-600">{res.summary} {res.options.length > 1 ? `This needs ${res.options.length} tasks. Split the work?` : 'One task is enough.'}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {res.options.map((o, i) => (
              <li key={i}>
                <label className={`flex cursor-pointer gap-2 border p-2 text-base ${picked.includes(i) ? 'border-ink bg-yuki-1' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={picked.includes(i)} onChange={() => toggle(i)} />
                  <span><b className="font-medium">{o.title}</b><br /><span className="text-slate-600">{o.hours}h, by {o.due}</span></span>
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
