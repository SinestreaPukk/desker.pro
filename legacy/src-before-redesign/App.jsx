import { useState, useEffect, useRef } from 'react'
import { post, uid, stateUrl } from './api.js'
import { addTasks, settle, doneStats, isMissed, timeRatio } from './tasks.js'
import { applyPlan as applyReplan } from './replan.js'
import { logEnergy, energyProfile, ranges } from './energy.js'
import { weekReview } from './review.js'
import { encodeFile } from './files.js'
import Replan from './Replan.jsx'
import Review from './Review.jsx'
import Syllabus from './Syllabus.jsx'
import Focus from './Focus.jsx'
import { migrate } from './storage.js'
import { METHODS } from './methods.js'
import { Icon } from './icons.jsx'
import { BLUE, btn, input, Q, LEVELS } from './ui.js'
import TimeGrid from './TimeGrid.jsx'
import Settings from './Settings.jsx'

// undefined until the AI has ranked the task
const quadrant = (t) => t.important === undefined ? undefined : (t.important ? 0 : 2) + (t.urgent ? 0 : 1)

async function prioritise(goals, tasks) {
  const out = await post('/api/prioritise', { goals: goals.map(({ id, title, level, happiness }) => ({ id, level: LEVELS[level].name, kind: happiness ? 'happiness' : 'work', title })), tasks: tasks.map(({ id, title, due }) => ({ id, title, due })) })
  if (!Array.isArray(out)) throw new Error('The AI gave an unreadable answer. Please try again.')
  return out
}

// Photos, PDFs, text files and web pages -> plain notes the planner can use.
async function readSource({ file, url }) {
  let body = { url }
  if (!url) {
    body = await encodeFile(file)
    if (body.text !== undefined) return body.text.slice(0, 6000)
  }
  return (await post('/api/read', body)).text
}

// Imported calendar events: { t: title, d: 'yyyy-mm-dd' } (all-day) or { t, s, e } (epoch ms).
const evDay = (e) => e.d || new Date(e.s).toLocaleDateString('sv')
const hhmm = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const hm24 = (ms) => new Date(ms).toLocaleTimeString('sv').slice(0, 5)
// What the AI sees: the next two weeks, in the user's local time.
function busyForAI(busy = []) {
  const from = new Date().toLocaleDateString('sv'), to = new Date(Date.now() + 14 * 864e5).toLocaleDateString('sv')
  return busy.filter((e) => evDay(e) >= from && evDay(e) <= to).slice(0, 60)
    .map((e) => (e.d ? { date: e.d, allDay: true, title: e.t } : { date: evDay(e), start: hm24(e.s), end: hm24(e.e), title: e.t }))
}
async function importCalendar(body) {
  return (await post('/api/import', body)).events
}

function Happy({ value = 50, onChange, label = 'How do you feel about this task?' }) {
  return (
    <label className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600" title={`Feeling: ${value} of 100`}>
      {label}
      <span className="flex items-center gap-1">
        <span aria-hidden="true">Dread</span>
        <input type="range" aria-label="How do you feel about this task? Left is dreading it, right is looking forward to it" min="0" max="100" className="w-24" value={value} onChange={(e) => onChange(+e.target.value)} />
        <span aria-hidden="true">Look forward</span>
      </span>
    </label>
  )
}

const REPEATS = [['', 'Never'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]

function Row({ t, update, onEdit, onDelete, move, onStart }) {
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [sub, setSub] = useState('')
  const subs = t.subs || []
  const q = quadrant(t)
  const setSubs = (next) => update(t.id, { subs: next })
  useEffect(() => {
    if (!menu) return
    const off = () => setMenu(false)
    const id = setTimeout(() => document.addEventListener('click', off), 0)
    return () => { clearTimeout(id); document.removeEventListener('click', off) }
  }, [menu])
  return (
    <li className="rounded-lg bg-white/80 px-3 py-1">
      <div className="flex items-center justify-between gap-2">
        <span className="hidden shrink-0 cursor-grab text-slate-500 md:block" draggable title="Drag to another box" aria-hidden="true"
          onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.setDragImage(e.currentTarget.closest('li'), 0, 0) }}>
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor"><circle cx="5" cy="4" r="1.2" /><circle cx="11" cy="4" r="1.2" /><circle cx="5" cy="8" r="1.2" /><circle cx="11" cy="8" r="1.2" /><circle cx="5" cy="12" r="1.2" /><circle cx="11" cy="12" r="1.2" /></svg>
        </span>
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <input type="checkbox" checked={!!t.done} onChange={() => update(t.id, { done: !t.done })} />
          <span className={`break-words ${t.done ? 'text-slate-500 line-through' : ''}`}>
            {t.title}
            {t.due && <span className="ml-2 text-xs text-slate-500">due {t.due}</span>}
            {t.when && <span className="ml-2 text-xs text-slate-500">planned {t.when}{t.start ? ` ${t.start}` : ''}</span>}
            {t.hours > 0 && <span className="ml-2 text-xs text-slate-500">{t.hours}h</span>}
            {subs.length > 0 && <span className="ml-2 text-xs text-slate-500">{subs.filter((x) => x.done).length}/{subs.length} steps</span>}
            {t.repeat && <span className="ml-2 text-xs text-slate-500">repeats {t.repeat}</span>}
            {t.spent > 0 && <span className="ml-2 text-xs text-slate-500">{t.spent < 1 / 120 ? '<1' : Math.round(t.spent * 60)} min focused</span>}
            {isMissed(t) && <span className="ml-2 rounded bg-danger/15 px-1.5 text-xs text-danger">missed</span>}
          </span>
        </label>
        <span className="relative flex shrink-0 items-center gap-1">
          {!t.done && <button className={`${btn} text-accent hover:bg-pale`} onClick={() => onStart(t)} aria-label={`Start focus on ${t.title}`}>Start</button>}
          <button className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-white" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} aria-label={`More actions for ${t.title}`}>
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-line bg-white p-1 shadow-md" onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}>
              <button role="menuitem" className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-slate-100" onClick={() => { setOpen(!open); setMenu(false) }}>{open ? 'Hide details' : 'Details'}</button>
              <button role="menuitem" className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-slate-100" onClick={() => { onEdit(); setMenu(false) }}>Edit</button>
              <button role="menuitem" className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm text-danger hover:bg-slate-100" onClick={() => { onDelete(); setMenu(false) }}>Delete</button>
            </div>
          )}
        </span>
      </div>
      {open && (
        <div className="space-y-2 pl-6 pt-2 text-sm">
          <Happy value={t.happy} onChange={(happy) => update(t.id, { happy })} label="Feeling about it" />
          <p><b>Why here?</b> {t.reason || (q === undefined ? 'Not ranked yet. Use Prioritise with AI, or move it yourself below.' : 'No reason saved.')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1">Move to
              <select className={input} value={q ?? ''} onChange={(e) => move(t.id, e.target.value === '' ? '' : +e.target.value)}>
                <option value="">Let the AI decide</option>
                {Q.map((x, i) => <option key={x.name} value={i}>{x.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1">Repeat
              <select className={input} value={t.repeat || ''} onChange={(e) => update(t.id, { repeat: e.target.value || undefined })}>
                {REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <div>
            <p className="font-medium">Steps</p>
            <ul className="space-y-1">
              {subs.map((x) => (
                <li key={x.id} className="flex items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input type="checkbox" checked={x.done} onChange={() => setSubs(subs.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)))} />
                    <span className={`break-words ${x.done ? 'text-slate-500 line-through' : ''}`}>{x.title}</span>
                  </label>
                  <button className={`${btn} !px-2 !py-1 text-danger hover:bg-white`} aria-label={`Remove step ${x.title}`} onClick={() => setSubs(subs.filter((y) => y.id !== x.id))}>Remove</button>
                </li>
              ))}
            </ul>
            <form className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (sub.trim()) { setSubs([...subs, { id: Date.now(), title: sub.trim(), done: false }]); setSub('') } }}>
              <input className={`${input} min-w-0 flex-1 !py-1`} aria-label="New step" placeholder="Add a step" value={sub} onChange={(e) => setSub(e.target.value)} />
              <button className={`${btn} bg-slate-100 !py-1 hover:bg-slate-200`}>Add</button>
            </form>
          </div>
        </div>
      )}
    </li>
  )
}

function Hobbies({ hobbies, setHobbies }) {
  const [v, setV] = useState('')
  const add = (e) => {
    e.preventDefault()
    if (!v.trim()) return
    setHobbies([...hobbies, { id: Date.now(), title: v.trim() }])
    setV('')
  }
  return (
    <section className="mt-6">
      <h2 className="mb-1 text-lg font-semibold">Things I want to do for fun</h2>
      <p className="mb-2 text-sm text-slate-600">Hobbies and things that make you happy. The coach schedules them between your tasks.</p>
      <form className="mb-2 flex gap-2" onSubmit={add}>
        <input className={`${input} min-w-48 flex-1`} placeholder="e.g. Play guitar" value={v} onChange={(e) => setV(e.target.value)} />
        <button className={`${btn} ${BLUE}`}>Add</button>
      </form>
      <ul className="flex flex-wrap gap-2">
        {hobbies.map((h) => (
          <li key={h.id} className="flex items-center gap-1 rounded-lg bg-pale py-1 pl-3 pr-1 text-sm">
            {h.title}
            <button className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-white" aria-label={`Remove ${h.title}`}
              onClick={() => setHobbies(hobbies.filter((x) => x.id !== h.id))}>×</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Goals({ goals, setGoals, hobbies, setHobbies, tasks, onReview }) {
  const blank = { title: '', level: 3, happiness: false }
  const [d, setD] = useState(blank)
  const submit = (e) => {
    e.preventDefault()
    if (!d.title.trim()) return
    setGoals(d.id ? goals.map((g) => (g.id === d.id ? d : g)) : [...goals, { ...d, id: Date.now() }])
    setD(blank)
  }
  return (
    <>
      <Review tasks={tasks} goals={goals} onCoach={onReview} />
      <p className="mb-2 text-sm text-slate-600">Build your goals pyramid. The AI links each task to a goal and uses its level to judge importance.</p>
      <form className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 border border-line" onSubmit={submit}>
        <input className={`${input} min-w-48 flex-1`} placeholder="Goal" value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })} />
        <select className={input} value={d.level} onChange={(e) => setD({ ...d, level: +e.target.value })}>
          {LEVELS.map((l, i) => <option key={l.name} value={i}>{l.name} ({l.hint})</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={!!d.happiness} onChange={(e) => setD({ ...d, happiness: e.target.checked })} /> Happiness goal
        </label>
        <button className={`${btn} ${BLUE}`}>{d.id ? 'Save' : 'Add'}</button>
        {d.id && <button type="button" className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={() => setD(blank)}>Cancel</button>}
      </form>
      <div className="flex flex-col items-center gap-1">
        {LEVELS.map((l, i) => (
          <section key={l.name} className={`w-full ${l.w} ${l.cls} rounded-xl p-4`}>
            <h2 className="text-center font-semibold">{l.name} <span className="text-xs font-normal text-slate-800">{l.hint}</span></h2>
            <ul className="mt-2 space-y-1">
              {!goals.some((g) => g.level === i) && <li className="text-center text-sm text-slate-800">No goals yet</li>}
              {goals.filter((g) => g.level === i).map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-1.5">
                  <span className="min-w-0 break-words">{g.title}{g.happiness && <span className="ml-2 rounded-md bg-white px-1.5 text-xs">happiness</span>}</span>
                  <span className="flex shrink-0 gap-1">
                    <button className={`${btn} hover:bg-white`} onClick={() => setD(g)}>Edit</button>
                    <button className={`${btn} text-danger hover:bg-white`} onClick={() => setGoals(goals.filter((x) => x.id !== g.id))}>Delete</button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Hobbies hobbies={hobbies} setHobbies={setHobbies} />
    </>
  )
}

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
    <li className="rounded-2xl bg-white p-3 border border-line">
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
        <label className={`${btn} cursor-pointer bg-slate-100 hover:bg-slate-200 ${reading ? 'pointer-events-none opacity-50' : ''}`}>
          {reading ? 'Reading…' : 'Attach photo or file'}
          <input type="file" className="sr-only" accept="image/*,application/pdf,.txt,.md,.csv,.json,.ics" disabled={reading}
            onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) attach({ file: f }, f.name) }} />
        </label>
        <form className="flex min-w-48 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); if (link.trim()) attach({ url: link.trim() }, link.trim()) }}>
          <input className={`${input} min-w-0 flex-1`} aria-label="Web link" placeholder="Paste a link (syllabus, assignment page)" value={link} onChange={(e) => setLink(e.target.value)} />
          <button className={`${btn} bg-slate-100 hover:bg-slate-200`} disabled={reading || !link.trim()}>Read</button>
        </form>
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {res?.question && (
        <form className="mt-3 rounded-2xl bg-slate-100 p-3 text-sm" onSubmit={reply}>
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
          <button className={`${btn} mt-3 bg-primary text-ink hover:bg-slate-800`} disabled={!picked.length} onClick={add}>
            Add {picked.length} task{picked.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </li>
  )
}

function Deadlines({ goals, deadlines, setDeadlines, tasks, setTasks }) {
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
      <p className="mb-2 text-sm text-slate-600">Add anything with a due date: an exam, a project, a trip. The AI works out the hours and suggests tasks to pick from.</p>
      <Syllabus deadlines={deadlines} setDeadlines={setDeadlines} tasks={tasks} setTasks={setTasks} ratio={ratioOf(tasks)} />
      <form className="mb-4 flex flex-wrap items-start gap-3 rounded-2xl bg-white p-3 border border-line" onSubmit={submit}>
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
const patternOf = (d) => { const p = energyProfile(d.energyLog); return p.enough && (p.high.length || p.low.length) ? { high: p.high, low: p.low } : undefined }
const ratioOf = (tasks) => timeRatio(tasks)?.ratio
const todayStr = () => new Date().toLocaleDateString('sv')
// Calendar-based suggestion: what the schedule says to do now.
function fromCalendar(tasks) {
  const open = tasks.filter((t) => !t.done)
  const due = open.filter((t) => dateKey(t) && dateKey(t) <= todayStr())
  const pool = due.length ? due : open.filter((t) => !t.fun)
  const best = [...pool].sort((a, b) => (quadrant(a) ?? 9) - (quadrant(b) ?? 9) || (dateKey(a) || '9').localeCompare(dateKey(b) || '9'))[0]
  return best && { taskId: best.id, title: best.title, method: 'Calendar plan',
    why: due.length ? (dateKey(best) < todayStr() ? 'Overdue on your calendar.' : 'Planned for today on your calendar.') : 'Top of your priority list.', minutes: best.hours ? Math.round(best.hours * 60) : undefined }
}

function Hero({ tasks, setTasks, focus, pick, setFocus, go, openTimer }) {
  const cur = focus || pick || fromCalendar(tasks)
  const finish = () => {
    if (cur.taskId) setTasks(tasks.map((t) => (t.id === cur.taskId ? { ...t, done: true } : t)))
    setFocus(null)
  }
  return (
    <section className="mb-4 rounded-xl border border-[#cddcf5] bg-pale p-5" aria-label="What to do now">
      <p className="text-sm text-slate-600">{focus ? 'You are doing' : 'Right now, try'}</p>
      {cur ? (
        <>
          <p className="mt-1 break-words text-2xl font-semibold leading-tight">{cur.title}</p>
          <p className="mt-1 text-sm text-slate-600">{pick && !focus ? `You picked: ${cur.method}` : cur.method}{cur.minutes ? ` · ${cur.minutes} min` : ''} · {cur.why}</p>
        </>
      ) : (
        <p className="mt-1 text-2xl font-semibold leading-tight">Nothing pending. Add a task or enjoy a hobby.</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {cur && <button className={`${btn} ${BLUE}`} onClick={focus ? finish : () => setFocus({ ...cur, at: Date.now() })}>{focus ? 'Done' : 'Start'}</button>}
        {focus && <button className={`${btn} border border-[#b4caf0] bg-white hover:bg-slate-50`} onClick={openTimer}>Open timer</button>}
        {focus && <button className={`${btn} border border-control bg-white hover:bg-slate-100`} onClick={() => setFocus(null)}>Stop</button>}
        <button className={`${btn} border border-control bg-white hover:bg-slate-100`} onClick={go}>Compare other ways</button>
      </div>
    </section>
  )
}

function EnergyPanel({ log, reset }) {
  const [sure, setSure] = useState(false)
  const p = energyProfile(log)
  return (
    <section className="mb-4 rounded-2xl bg-white p-3 text-sm border border-line" aria-label="Your energy pattern">
      <h2 className="text-lg font-semibold">Your energy pattern</h2>
      {p.enough
        ? <p className="mt-1 text-slate-700">Usually high energy: {ranges(p.high) || 'no clear hours yet'}. Usually low: {ranges(p.low) || 'no clear hours yet'}. The coach and Replan put demanding work in your high hours.</p>
        : <p className="mt-1 text-slate-600">Tap your energy level a few times a day. After {8 - p.n > 0 ? `${8 - p.n} more` : 'a few more'} check-ins, Desker learns when you do your best work.</p>}
      {log.length > 0 && (
        <>
          <details className="mt-2">
            <summary className="cursor-pointer text-accent-dark">View check-ins ({log.length})</summary>
            <ul className="mt-1 max-h-40 overflow-y-auto text-slate-700">
              {[...log].reverse().slice(0, 50).map((e) => <li key={e.at}>{new Date(e.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}: {e.level}</li>)}
            </ul>
          </details>
          {sure
            ? <p className="mt-2" role="alert">Delete all {log.length} check-ins? <button className={`${btn} text-danger hover:bg-slate-100`} onClick={() => { reset(); setSure(false) }}>Delete</button><button className={`${btn} hover:bg-slate-100`} onClick={() => setSure(false)}>Cancel</button></p>
            : <button className={`${btn} mt-2 bg-slate-100 hover:bg-slate-200`} onClick={() => setSure(true)}>Reset energy data</button>}
        </>
      )}
    </section>
  )
}

function DoNow({ data, tasks, setFocus, setPick, setData }) {
  const [minutes, setMinutes] = useState(60)
  const [energy, setEnergy] = useState('medium')
  const [opts, setOpts] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cal = fromCalendar(tasks)
  const ask = async () => {
    setBusy(true); setError('')
    try {
      const out = await post('/api/now', {
        goals: data.goals.map(({ id, title, level, happiness }) => ({ id, level: LEVELS[level].name, kind: happiness ? 'happiness' : 'work', title })),
        tasks: tasks.filter((t) => !t.done).map(({ id, title, due, when, hours, readiness, important, urgent, fun }) => ({ id, title, due, when, hours, readiness, important, urgent, fun })),
        hobbies: (data.hobbies || []).map((h) => h.title),
        deadlines: (data.deadlines || []).map(({ title, date, hours }) => ({ title, date, hours })),
        minutes, energy, pattern: patternOf(data), mood: data.mood, freeToday: freeTodayOf(data), busy: busyForAI(data.busy), now: new Date().toLocaleString(),
      })
      if (!Array.isArray(out.options)) throw new Error('The AI gave an unreadable answer. Please try again.')
      setOpts(out.options)
    } catch (err) { setError(err.message) }
    setBusy(false)
  }
  const top = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const start = (o) => {
    setFocus({ taskId: tasks.some((t) => t.id === o.taskId) ? o.taskId : null, title: o.title, method: o.method, why: o.why, minutes: o.minutes, at: Date.now() })
    top()
  }
  const choose = (m, t, why) => {
    setPick({ taskId: t.id, title: t.title, method: m.name, why, minutes: t.hours ? Math.round(t.hours * 60) : undefined })
    top()
  }
  const cards = [...(cal ? [cal] : []), ...(opts || [])]
  const picks = METHODS.map((m) => ({ m, r: m.pick(tasks, { minutes, energy }) }))
  const card = 'flex flex-col justify-between rounded-xl border border-line bg-white p-3'
  const lead = picks.find((p) => p.r)
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-3">
        <label className="flex flex-col gap-1 text-sm">Minutes free right now
          <input type="number" min="5" step="5" className={`${input} w-28`} value={minutes} onChange={(e) => setMinutes(+e.target.value)} />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span id="energy-label">Your energy right now</span>
          <div role="group" aria-labelledby="energy-label" className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {['low', 'medium', 'high'].map((l) => (
              <button key={l} aria-pressed={energy === l} className={`${btn} !px-3 !py-1 capitalize !transition-none ${energy === l ? 'bg-pale font-medium text-ink' : 'text-slate-600'}`}
                onClick={() => { setEnergy(l); setData((d) => ({ ...d, energyLog: logEnergy(d.energyLog, l) })) }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      {lead ? (
        <section className="mb-4 rounded-xl border border-line bg-white p-4" aria-label="Suggested next task">
          <p className="text-sm text-slate-600">Suggested for your {minutes} minutes</p>
          <p className="mt-1 break-words text-xl font-semibold">{lead.r.t.title}</p>
          <p className="mt-1 text-sm text-slate-700">{lead.m.name}: {lead.r.why}</p>
          <button className={`${btn} mt-3 ${BLUE}`} onClick={() => choose(lead.m, lead.r.t, lead.r.why)}>Pick this</button>
        </section>
      ) : <p className="mb-4 text-sm text-slate-600">{tasks.some((t) => !t.done && !t.fun) ? 'Nothing fits your minutes. Try more time.' : 'No open tasks yet. Add some in Tasks.'}</p>}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button className={`${btn} border border-control bg-white hover:bg-slate-100`} disabled={busy} onClick={ask}>{busy ? 'Thinking…' : opts ? 'Ask the AI again' : 'Ask the AI for a second opinion'}</button>
        <span className="text-sm text-slate-600">It also weighs your mood, calendar and hobbies.</span>
        {error && <span role="alert" className="text-sm text-danger">{error}</span>}
      </div>
      <ul className="mb-4 grid gap-3 sm:grid-cols-2">
        {cards.map((o, i) => (
          <li key={i} className={card}>
            <div>
              <p className="text-sm font-medium text-accent">{o.method}</p>
              <p className="mt-1 break-words font-semibold">{o.title}</p>
              <p className="mt-1 text-sm text-slate-700">{o.minutes ? `${o.minutes} min · ` : ''}{o.why}</p>
            </div>
            <button className={`${btn} mt-3 self-start ${BLUE}`} onClick={() => start(o)}>Do this now</button>
          </li>
        ))}
      </ul>
      <details className="mb-3">
        <summary className="cursor-pointer text-sm font-medium text-accent">Compare all four ways to choose</summary>
        <p className="mb-2 mt-2 text-sm text-slate-600">Each method picks a different task from your list. Pick one and it becomes your "Right now, try" at the top.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {picks.map(({ m, r }) => (
            <li key={m.name} className={card}>
              <div>
                <p className="text-sm font-medium text-accent">{m.name} <span className="font-normal text-slate-700">· {m.how}</span></p>
                {r ? <>
                  <p className="mt-1 break-words font-semibold">{r.t.title}</p>
                  <p className="mt-1 text-sm text-slate-700">{r.t.hours ? `${r.t.hours}h · ` : ''}{r.why}</p>
                </> : <p className="mt-1 text-sm text-slate-600">Nothing fits right now.</p>}
              </div>
              {r && <button className={`${btn} mt-3 self-start ${BLUE}`} onClick={() => choose(m, r.t, r.why)}>Pick this</button>}
            </li>
          ))}
        </ul>
      </details>
      <details className="mb-3">
        <summary className="cursor-pointer text-sm font-medium text-accent">Your energy pattern</summary>
        <div className="mt-2"><EnergyPanel log={data.energyLog || []} reset={() => setData((d) => ({ ...d, energyLog: [] }))} /></div>
      </details>
    </>
  )
}

function Tasks({ goals, tasks, setTasks, goTab, setFocus, deleteTask }) {
  const startTask = (t) => setFocus({ taskId: t.id, title: t.title, method: 'Your choice', why: 'You started it from your task list.', minutes: t.hours ? Math.round(t.hours * 60) : undefined, at: Date.now() })
  const blank = { title: '', due: '', happy: 50, hours: '', repeat: '' }
  const [d, setD] = useState(blank)
  const [over, setOver] = useState(null) // quadrant under a dragged task
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dump, setDump] = useState('')
  const [added, setAdded] = useState(0) // how many tasks the dump box just added, to offer sorting them

  const submit = (e) => {
    e.preventDefault()
    if (!d.title.trim()) return
    const hours = d.hours === '' || d.hours == null ? undefined : +d.hours
    // editing drops the old ranking so the task gets re-prioritised
    setTasks(d.id
      ? tasks.map((t) => {
          if (t.id !== d.id) return t
          const { important, urgent, goalId, reason, manual, ...keep } = t // keeps hours, planned date, readiness, deadline link
          return { ...keep, title: d.title, due: d.due, happy: d.happy ?? 50, hours: hours, repeat: d.repeat || undefined }
        })
      : addTasks(tasks, [{ ...d, hours, repeat: d.repeat || undefined }]))
    setD(blank)
  }
  const update = (id, patch) => setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  // Placing a task yourself sticks: the AI skips it unless you ask to re-rank everything.
  const move = (id, qi) => update(id, qi === ''
    ? { important: undefined, urgent: undefined, goalId: undefined, reason: undefined, manual: false }
    : { important: qi < 2, urgent: qi % 2 === 0, manual: true, reason: 'You placed this here yourself.' })
  const lines = dump.split('\n').map((l) => l.trim()).filter(Boolean)
  const addDump = (e) => {
    e.preventDefault()
    if (!lines.length) return
    setTasks(addTasks(tasks, lines.slice(0, 50).map((title) => ({ title }))))
    setAdded(lines.length); setDump('')
  }

  const run = async (everything = false) => {
    setAdded(0); setBusy(true); setError('')
    try {
      const pool = tasks.filter((t) => !t.done && !t.fun && (everything || !t.manual))
      const ranks = await prioritise(goals, pool)
      setTasks(tasks.map((t) => {
        const r = ranks.find((r) => r.id === t.id)
        return r ? { ...t, goalId: r.goalId, important: !!r.important, urgent: !!r.urgent, reason: r.reason, manual: false } : t
      }))
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  const all = tasks.filter((t) => !t.fun).map((t) => ({ ...t, q: quadrant(t) }))
  const open = all.filter((t) => !t.done)
  const doneList = all.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0))
  const stats = doneStats(tasks)
  const sorted = [...open].sort((a, b) => (a.q ?? 9) - (b.q ?? 9) || (a.due || '9').localeCompare(b.due || '9'))
  const row = (t) => (
    <Row key={t.id} t={t} update={update} move={move} onStart={startTask} onEdit={() => setD({ ...t, repeat: t.repeat || '' })}
      onDelete={() => deleteTask(t)} />
  )
  const unranked = open.filter((t) => t.q === undefined)

  return (
    <>
      <p className="mb-4 text-sm text-slate-600">Sorted by what is urgent and what is important.</p>
      <form className="mb-3 rounded-xl border border-line bg-white p-3" onSubmit={submit}>
        <div className="flex gap-2">
          <input className={`${input} min-w-0 flex-1`} placeholder="Add a task" aria-label="Task" value={d.title}
            onChange={(e) => setD({ ...d, title: e.target.value })} />
          <button className={`${btn} ${BLUE}`}>{d.id ? 'Save' : 'Add'}</button>
          {d.id && <button type="button" className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={() => setD(blank)}>Cancel</button>}
        </div>
        <details className="mt-2" open={!!d.id || undefined}>
          <summary className="cursor-pointer text-sm text-accent">Date, hours, repeat, how you feel</summary>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input type="date" aria-label="Due date" className={input} value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} />
            <input type="number" min="0" step="0.5" aria-label="Hours needed" className={`${input} w-36`} placeholder="Hours (opt.)" value={d.hours ?? ''} onChange={(e) => setD({ ...d, hours: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">Repeat
              <select className={input} value={d.repeat || ''} onChange={(e) => setD({ ...d, repeat: e.target.value })}>
                {REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <Happy value={d.happy} onChange={(happy) => setD({ ...d, happy })} />
          </div>
        </details>
      </form>
      <details className="mb-3 rounded-xl border border-line bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium">Add many at once</summary>
        <form className="mt-2" onSubmit={addDump}>
          <label className="mb-1 block text-sm text-slate-600" htmlFor="dump">What's on your mind? One task per line.</label>
          <textarea id="dump" className={`${input} w-full`} rows={4} placeholder={'Study for statics quiz\nCall the dentist\nBuy a birthday gift'} value={dump} onChange={(e) => setDump(e.target.value)} />
          <button className={`${btn} mt-2 ${BLUE}`} disabled={!lines.length}>{lines.length > 1 ? `Add ${lines.length} tasks` : 'Add task'}</button>
        </form>
      </details>
      {added > 0 && (
        <div role="status" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-pale p-3 text-sm">
          <span>Added {added} task{added === 1 ? '' : 's'}. Sort them into the matrix?</span>
          <button className={`${btn} ${BLUE}`} disabled={busy} onClick={() => run()}>{busy ? 'Sorting…' : 'Sort with AI'}</button>
          <button className={`${btn} hover:bg-white`} onClick={() => setAdded(0)}>Later</button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button className={`${btn} ${BLUE}`}
          disabled={busy || !open.some((t) => !t.manual)} onClick={() => run()}>
          {busy ? 'Prioritising…' : 'Prioritise with AI'}
        </button>
        {open.some((t) => t.manual) && <button className={`${btn} border border-control bg-white hover:bg-slate-100`} disabled={busy} onClick={() => run(true)}>Re-rank everything</button>}
        {!goals.length && <button className="text-sm text-accent underline" onClick={() => goTab('Goals')}>Link goals for better ranking.</button>}
        {!busy && !open.some((t) => !t.manual) && <span className="text-sm text-slate-600">{all.length ? 'Everything is already placed.' : 'Add a task first.'}</span>}
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>

      {stats.week > 0 && <p className="mb-2 text-sm text-slate-600">{stats.week} task{stats.week === 1 ? '' : 's'} done this week{stats.streak > 1 ? ` · ${stats.streak}-day streak` : ''}</p>}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        {Q.map((q, i) => (
          <section key={q.name} className={`${q.cls} rounded-xl p-4 ${over === i ? 'ring-2 ring-accent' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(i) }} onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = +e.dataTransfer.getData('text/plain'); if (tasks.some((t) => t.id === id)) move(id, i) }}>
            <h2 className="flex flex-wrap items-center gap-x-2 text-lg font-semibold"><span className={`h-2.5 w-2.5 rounded-full ${q.dot}`} aria-hidden="true" />{q.name} <span className="text-sm font-normal text-slate-700">{q.hint}</span></h2>
            <ul className="mt-2 space-y-1">{open.filter((t) => t.q === i).map(row)}{!open.some((t) => t.q === i) && <li className="text-sm text-slate-500">Nothing here</li>}</ul>
          </section>
        ))}
      </div>
      {sorted.length > 0 && <h2 className="mb-2 text-lg font-semibold">Priority list</h2>}
      <ol className="mb-6 space-y-2">
        {sorted.map((t) => (
          <li key={t.id} className={`${t.q === undefined ? 'bg-white' : Q[t.q].cls} rounded-lg p-1`}>
            <ul>{row(t)}</ul>
            <span className="px-2 text-xs text-slate-600">{t.q === undefined ? 'Not prioritised yet' : Q[t.q].name}</span>
          </li>
        ))}
      </ol>

      {doneList.length > 0 && (
        <details className="mt-6 rounded-2xl bg-white p-3 border border-line">
          <summary className="cursor-pointer text-lg font-semibold">Done ({doneList.length})</summary>
          <ul className="mt-2 space-y-1">{doneList.map(row)}</ul>
        </details>
      )}
      {sorted.some((t) => t.reason) && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">Why this placement?</h2>
          <ul className="space-y-2 text-sm">
            {sorted.filter((t) => t.reason).map((t) => {
              const goal = goals.find((g) => g.id === t.goalId)
              return (
                <li key={t.id} className={`${Q[t.q].cls} rounded p-2`}>
                  <b>{t.title}</b> → {Q[t.q].name}
                  <span className="text-slate-600"> · {goal ? `${LEVELS[goal.level].name} goal: ${goal.title}` : 'No matching goal'}</span>
                  <p>{t.reason}</p>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {unranked.length > 0 && <p className="mt-3 text-sm text-slate-600">{unranked.length} task(s) waiting for AI prioritisation.</p>}
    </>
  )
}

const dateKey = (t) => t.when || t.due
const color = (t) => (t.fun ? 'bg-pale' : quadrant(t) === undefined ? 'bg-white border' : Q[quadrant(t)].cls)

function Detail({ t, goals, deadlines, update, remove, close, onStart }) {
  const goal = goals.find((g) => g.id === t.goalId)
  const dl = deadlines.find((x) => x.id === t.deadlineId)
  const lbl = 'flex flex-col gap-1 text-sm'
  return (
    <section className={`mt-4 rounded-2xl p-3 border border-line ${color(t)} ${t.fun || quadrant(t) !== undefined ? '' : 'border-slate-200'}`} aria-label="Task details">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t.fun ? 'Fun session' : 'Task details'}</h2>
        <button className={`${btn} hover:bg-white`} onClick={close}>Close</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`${lbl} sm:col-span-2`}>Title
          <input className={input} value={t.title} onChange={(e) => update(t.id, { title: e.target.value })} />
        </label>
        {!t.fun && <label className={lbl}>Due date
          <input type="date" className={input} value={t.due || ''} onChange={(e) => update(t.id, { due: e.target.value })} />
        </label>}
        <label className={lbl}>Planned for
          <input type="date" className={input} value={t.when || ''} onChange={(e) => update(t.id, { when: e.target.value })} />
        </label>
        <label className={lbl}>Start time
          <input type="time" className={input} value={t.start || ''} onChange={(e) => update(t.id, { start: e.target.value || undefined })} />
        </label>
        <label className={lbl}>Hours needed
          <input type="number" min="0" step="0.5" className={input} value={t.hours ?? ''} onChange={(e) => update(t.id, { hours: e.target.value === '' ? undefined : +e.target.value })} />
        </label>
        {!t.fun && <label className={lbl}>Repeat
          <select className={input} value={t.repeat || ''} onChange={(e) => update(t.id, { repeat: e.target.value || undefined })}>
            {REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>}
        {!t.fun && <label className={lbl}>Readiness: {t.readiness ?? '?'}{t.readiness != null && '%'}
          <input type="range" min="0" max="100" value={t.readiness ?? 50} onChange={(e) => update(t.id, { readiness: +e.target.value })} />
        </label>}
        <div className={lbl}><Happy value={t.happy} onChange={(happy) => update(t.id, { happy })} /></div>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={t.done} onChange={() => update(t.id, { done: !t.done })} /> Done
        </label>
      </div>
      {t.spent > 0 && <p className="mt-3 text-sm">Focused so far: {Math.round(t.spent * 60)} min{t.hours ? ` of ${Math.round(t.hours * 60)} min estimated` : ''}</p>}
      {dl && <p className="mt-3 text-sm">For deadline: <b>{dl.title}</b> ({dl.date})</p>}
      {!t.fun && t.reason && (
        <p className="mt-3 text-sm"><b>{Q[quadrant(t)].name}</b>
          <span className="text-slate-600"> · {goal ? `${LEVELS[goal.level].name} goal: ${goal.title}` : 'No matching goal'}</span><br />{t.reason}</p>
      )}
      {!t.done && <button className={`${btn} mt-3 mr-2 ${BLUE}`} onClick={() => onStart(t)}>Start focus</button>}
      <button className={`${btn} mt-3 text-danger hover:bg-white`} onClick={() => { remove(t.id); close() }}>Delete</button>
    </section>
  )
}

function CalendarSync({ data, setData }) {
  const [url, setUrl] = useState(data.sync?.url || '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const feed = `${location.origin}/api/ics?uid=${uid}`
  const webcal = feed.replace(/^https?/, 'webcal')
  const local = ['localhost', '127.0.0.1'].includes(location.hostname)
  const run = async (body) => {
    setLoading(true); setMsg('')
    try {
      const events = await importCalendar(body)
      setData((d) => ({ ...d, busy: events, sync: { url: body.url, at: Date.now() } }))
      setMsg(`Imported ${events.length} event${events.length === 1 ? '' : 's'} for the next 5 weeks.`)
    } catch (err) { setMsg(err.message) }
    setLoading(false)
  }
  const link = `${btn} inline-flex items-center bg-slate-100 hover:bg-slate-200`
  return (
    <details className="mb-4 rounded-2xl bg-white p-3 border border-line">
      <summary className="cursor-pointer font-semibold">
        Connect your calendar
        {data.sync && <span className="ml-2 text-sm font-normal text-slate-600">· {(data.busy || []).length} events imported</span>}
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <section>
          <h3 className="mb-1 text-sm font-semibold">Send Desker to your calendar</h3>
          <p className="mb-2 text-sm text-slate-600">Subscribe once and your tasks, planned days and deadlines show up in Google Calendar, Apple Calendar, Outlook or any app that takes a calendar link.</p>
          <div className="flex flex-wrap gap-2">
            <a className={link} href={`https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer">Google Calendar</a>
            <a className={link} href={webcal}>Apple / Outlook</a>
            <button className={link} onClick={() => navigator.clipboard?.writeText(feed).then(() => setMsg('Link copied.'), () => setMsg(feed))}>Copy link</button>
            <a className={link} href={`${feed}&download=1`}>Download .ics</a>
          </div>
          {local && <p className="mt-2 text-xs text-slate-600">Subscribing only works on the deployed site, because Google cannot reach localhost. Download works anywhere.</p>}
          <p className="mt-2 text-xs text-slate-600">Keep this link private: anyone with it can see your tasks. Google refreshes subscribed calendars about once a day.</p>
        </section>
        <section>
          <h3 className="mb-1 text-sm font-semibold">Bring your calendar into Desker</h3>
          <p className="mb-2 text-sm text-slate-600">The coach plans around your meetings and classes. Paste your calendar's private iCal link (in Google: Settings, your calendar, Integrate calendar, "Secret address in iCal format"), or upload an .ics file.</p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) run({ url: url.trim() }) }}>
            <input className={`${input} min-w-0 flex-1`} aria-label="Calendar link" placeholder="https://… or webcal://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className={`${btn} ${BLUE}`} disabled={loading || !url.trim()}>{loading ? 'Reading…' : 'Import'}</button>
          </form>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className={`${link} cursor-pointer ${loading ? 'pointer-events-none opacity-50' : ''}`}>Upload .ics
              <input type="file" className="sr-only" accept=".ics,text/calendar" disabled={loading}
                onChange={async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) run({ text: await f.text() }) }} />
            </label>
            {data.sync?.url && <button className={link} disabled={loading} onClick={() => run({ url: data.sync.url })}>Refresh</button>}
            {data.sync && <button className={`${link} text-danger`} onClick={() => { setData((d) => ({ ...d, busy: [], sync: undefined })); setUrl(''); setMsg('Disconnected. Imported events removed.') }}>Disconnect</button>}
          </div>
          <p className="mt-2 text-xs text-slate-600">Your link is saved so we can refresh it. Imported events are only used to plan around.</p>
        </section>
      </div>
      {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
    </details>
  )
}

const minutes = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes() }

const Key = () => (
  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700" aria-label="Colour key">
    {[['bg-[#eef3fd]', 'Task (tint shows its box)'], ['bg-pale', 'For fun'], ['bg-[#f6d5cf]', 'Deadline'], ['bg-stone/20', 'Calendar event']].map(([c, l]) => (
      <li key={l} className="flex items-center gap-2"><span className={`h-3 w-3 rounded-sm border border-control ${c}`} aria-hidden="true" />{l}</li>
    ))}
  </ul>
)

const HM = /^(\d\d):(\d\d)$/
const VIEWS = ['month', 'week', 'day']

function Calendar({ goals, tasks, setTasks, freeHours, freeToday, deadlines, setDeadlines, data, setData, onStart, onReplan }) {
  const [adding, setAdding] = useState(null) // date being given a deadline
  const [dl, setDl] = useState({ title: '', hours: '' })
  const [view, setView] = useState('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [sel, setSel] = useState(null)
  const y = anchor.getFullYear(), m = anchor.getMonth()
  const shift = (n) => setAnchor(view === 'month' ? new Date(y, m + n, 1) : new Date(y, m, anchor.getDate() + n * (view === 'week' ? 7 : 1)))
  const key = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const today = todayStr()
  const cells = [...Array(new Date(y, m, 1).getDay()).fill(null), ...Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => i + 1)]
  const update = (id, patch) => setTasks(tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const chip = (t) => (
    <button key={t.id} title={t.title} onClick={() => setSel(t.id)}
      className={`chip block w-full truncate rounded px-1 text-left text-xs ${color(t)} ${t.done ? 'text-slate-500 line-through' : ''} ${sel === t.id ? 'ring-2 ring-slate-800' : ''}`}>
      {t.title}
    </button>
  )
  const undated = tasks.filter((t) => !dateKey(t))
  const selected = tasks.find((t) => t.id === sel)

  // Week/day columns: planned tasks with a start time, fun items, deadlines and imported events become time blocks.
  const column = (date) => {
    const k = date.toLocaleDateString('sv'), blocks = [], allDay = []
    for (const t of tasks) {
      if (dateKey(t) !== k) continue
      const hm = HM.exec(t.start || ''), cls = `${color(t)} ${t.done ? 'text-slate-500 line-through' : ''} ${sel === t.id ? '!ring-2 !ring-slate-800' : ''}`
      if (hm) { const s = +hm[1] * 60 + +hm[2]; blocks.push({ id: `t${t.id}`, label: t.title, s, e: Math.min(1440, s + (t.hours || 1) * 60), cls, title: `${t.start} ${t.title}`, onClick: () => setSel(t.id) }) }
      else allDay.push({ id: `t${t.id}`, label: t.title, cls, onClick: () => setSel(t.id) })
    }
    for (const x of deadlines) {
      if (x.date !== k) continue
      const hm = HM.exec(x.time || ''), cls = 'bg-[#f6d5cf] font-medium text-[#7a1a14]', label = `Due: ${x.title}`
      if (hm) { const s = +hm[1] * 60 + +hm[2]; blocks.push({ id: `d${x.id}`, label, s, e: s + 30, cls, title: `${x.time} ${label}` }) }
      else allDay.push({ id: `d${x.id}`, label, cls })
    }
    ;(data.busy || []).forEach((x, j) => {
      if (evDay(x) !== k) return
      const cls = 'bg-stone/20 text-slate-700'
      if (x.d) return allDay.push({ id: `e${j}`, label: x.t, cls })
      const s = minutes(x.s), e = new Date(x.e).toLocaleDateString('sv') === k ? minutes(x.e) : 1440
      blocks.push({ id: `e${j}`, label: x.t, s, e: e > s ? e : s + 30, cls, title: `${hhmm(x.s)}-${hhmm(x.e)} ${x.t}` })
    })
    return { key: k, today: k === today, head: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }), allDay, blocks }
  }
  const sunday = new Date(y, m, anchor.getDate() - anchor.getDay())
  const days = view === 'week' ? Array.from({ length: 7 }, (_, i) => new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i)) : [anchor]
  const short = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const title = view === 'month' ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : view === 'week' ? `${short(days[0])} – ${short(days[6])}` : anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <>
      <CalendarSync data={data} setData={setData} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <button aria-label={`Previous ${view}`} className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={() => shift(-1)}>←</button>
        <h2 className="text-center font-semibold">{title}</h2>
        <button aria-label={`Next ${view}`} className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={() => shift(1)}>→</button>
      </div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full bg-slate-200/70 p-1" role="group" aria-label="Calendar view">
          {VIEWS.map((v) => (
            <button key={v} className={`${btn} !px-3 !py-1 capitalize !transition-none ${view === v ? 'bg-slate-100 text-slate-900' : 'text-slate-600'}`} aria-pressed={view === v} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>
        <span className="flex gap-2">
          <button className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={onReplan}>Replan my week</button>
          <button className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={() => setAnchor(new Date())}>Today</button>
        </span>
      </div>
      {view !== 'month' && (
        <>
          <TimeGrid cols={days.map(column)} onHead={(k) => { setAnchor(new Date(`${k}T12:00:00`)); setView('day') }} />
          <p className="mt-2 text-xs text-slate-500">Tasks with a start time (set it in the task's details) appear as blocks. Others sit in the Anytime row.</p>
          <Key />
          {view === 'day' && <button className={`${btn} mt-2 bg-slate-100 hover:bg-slate-200`} onClick={() => setAdding(anchor.toLocaleDateString('sv'))}>Add deadline on this day</button>}
        </>
      )}
      {view === 'month' && (
        <>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          const day = d ? tasks.filter((t) => dateKey(t) === key(d)) : []
          const events = d ? (data.busy || []).filter((x) => evDay(x) === key(d)) : []
          const limit = key(d) === today && freeToday != null ? freeToday : freeHours // today's own number wins
          const hrs = day.reduce((n, t) => n + (t.done ? 0 : t.hours || 0), 0)
          return (
            <div key={i} className={`min-h-16 rounded p-1 ${d ? 'border border-line bg-white' : ''} ${d && key(d) === today ? 'ring-2 ring-accent' : ''}`}>
              {d && (
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <button className="chip -m-1 rounded px-1 py-0.5 hover:bg-slate-100" aria-label={`Add deadline on ${key(d)}`} onClick={() => setAdding(key(d))}>{d}</button>
                  {hrs > 0 && <span className={limit && hrs > limit ? 'font-medium text-danger' : ''}>{hrs}h</span>}
                </div>
              )}
              <div className="space-y-0.5">
                {deadlines.filter((x) => x.date === key(d)).map((x) => <div key={x.id} title={`Deadline: ${x.title}`} className="truncate rounded bg-[#f6d5cf] px-1 text-xs font-medium text-[#7a1a14]">Due: {x.title}</div>)}
                {day.map(chip)}
                {events.slice(0, 2).map((x, j) => <div key={j} title={`${x.s ? `${hhmm(x.s)}-${hhmm(x.e)} ` : ''}${x.t}`} className="truncate rounded bg-stone/20 px-1 text-xs text-slate-700">{x.s ? `${hhmm(x.s)} ` : ''}{x.t}</div>)}
                {events.length > 2 && <div className="px-1 text-xs text-slate-600" title={events.slice(2).map((x) => x.t).join(', ')}>+{events.length - 2} more</div>}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">Tasks show on their planned date, or their due date if not planned. Click a task for details, or a date to add a deadline.</p>
      <Key />
        </>
      )}
      {adding && (
        <form className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-3 border border-line" aria-label="Add deadline"
          onSubmit={(e) => {
            e.preventDefault()
            if (!dl.title.trim()) return
            setDeadlines([...deadlines, { id: Date.now(), title: dl.title.trim(), date: adding, hours: dl.hours === '' ? null : +dl.hours, context: '' }])
            setDl({ title: '', hours: '' }); setAdding(null)
          }}>
          <h2 className="w-full font-semibold">Add deadline on {adding}</h2>
          <input className={`${input} min-w-48 flex-1`} autoFocus aria-label="Deadline title" placeholder="e.g. Statics quiz" value={dl.title} onChange={(e) => setDl({ ...dl, title: e.target.value })} />
          <input type="number" min="0" step="0.5" aria-label="Hours needed" className={`${input} w-36`} placeholder="Hours (opt.)" value={dl.hours} onChange={(e) => setDl({ ...dl, hours: e.target.value })} />
          <button className={`${btn} ${BLUE}`}>Add deadline</button>
          <button type="button" className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={() => setAdding(null)}>Cancel</button>
          <p className="w-full text-xs text-slate-600">Plan it with AI from the Deadlines tab.</p>
        </form>
      )}
      {undated.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-1 text-lg font-semibold">Not scheduled</h2>
          <div className="flex flex-wrap gap-1">{undated.map((t) => <div key={t.id} className="w-40">{chip(t)}</div>)}</div>
        </section>
      )}
      {selected && <Detail t={selected} goals={goals} deadlines={deadlines} update={update} remove={(id) => setTasks(tasks.filter((x) => x.id !== id))} close={() => setSel(null)} onStart={onStart} />}
    </>
  )
}

const DATE = /^\d{4}-\d\d-\d\d$/
// Merge the coach's plan into the workspace.
function applyPlan(d, o) {
  const ups = new Map((o.updates || []).map((u) => [u.id, u]))
  const tasks = d.tasks.map((t) => {
    const u = ups.get(t.id)
    if (!u) return t
    const p = {}
    if (Number.isFinite(u.readiness)) p.readiness = Math.min(100, Math.max(0, u.readiness))
    if (Number.isFinite(u.hours)) p.hours = u.hours
    if (DATE.test(u.when)) p.when = u.when
    if (/^\d\d:\d\d$/.test(u.start)) p.start = u.start
    return { ...t, ...p }
  })
  const fun = Array.isArray(o.fun)
    ? o.fun.filter((f) => f.title && DATE.test(f.when)).map((f, i) => ({ id: Date.now() + i, title: f.title, when: f.when, start: /^\d\d:\d\d$/.test(f.start) ? f.start : undefined, hours: Number(f.hours) || undefined, fun: true, done: false, happy: 100 }))
    : null
  return { ...d, tasks: fun ? [...tasks.filter((t) => !t.fun || t.done), ...fun] : tasks, freeHours: Number.isFinite(o.freeHours) ? o.freeHours : d.freeHours, freeToday: Number.isFinite(o.freeToday) ? { date: todayStr(), hours: o.freeToday } : d.freeToday, mood: typeof o.mood === 'string' && o.mood ? o.mood.slice(0, 80) : d.mood }
}

const freeTodayOf = (d) => (d.freeToday?.date === todayStr() ? d.freeToday.hours : undefined)
const QUICK = ['Help me plan my day', 'Replan my week', 'Weekly review', 'Help me set my goals', "I'm feeling stressed", "I'm low on energy"]

function Chat({ data, setData, onClose, onReplan, reviewReq }) {
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
        tasks: data.tasks.filter((t) => !t.done).map(({ id, title, due, readiness, hours, when, start, fun, deadlineId }) => ({ id, title, due, readiness, hours, when, start, fun, deadlineId })),
        pattern: patternOf(data), ratio: ratioOf(data.tasks),
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
        <img src="/favicon.svg" alt="Desker coach" className="h-9 w-9" />
        {onClose && <button className="flex min-h-11 items-center rounded-lg px-3 text-accent" onClick={onClose}>Close</button>}
      </header>
      <div role="log" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3">
        <div className={`${bubble} mr-auto rounded-lg bg-slate-100 text-slate-900`}>
          Hi! I can help you plan around your tasks, deadlines and free time. How are you feeling today?
        </div>
        {msgs.map((m, i) => (
          <div key={i} className={`${bubble} ${m.role === 'user' ? 'ml-auto rounded-lg bg-primary text-ink' : 'mr-auto rounded-lg bg-slate-100 text-slate-900'}`}>
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
          <div className="mr-auto flex gap-1 rounded-lg bg-slate-100 px-4 py-3" aria-label="Coach is typing">
            <span className="dot" /><span className="dot" style={{ animationDelay: '150ms' }} /><span className="dot" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        {error && <p className="text-center text-xs text-danger">{error}</p>}
        <div ref={end} />
      </div>
      {!msgs.length && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {QUICK.map((q) => (
            <button key={q} className="rounded-md border border-control bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-slate-200 disabled:opacity-50" disabled={busy} onClick={() => chipClick(q)}>{q}</button>
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
        <label className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-slate-200 text-slate-700 transition hover:bg-slate-300 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <span className="sr-only">Attach a photo, PDF or text file</span>
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
          <input type="file" className="sr-only" accept="image/*,application/pdf,.txt,.md,.csv,.json,.ics" disabled={busy}
            onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) attachFile(f) }} />
        </label>
        <div className="relative flex-1">
          <input className="w-full rounded-lg border border-control bg-white py-2 pl-3 pr-11 placeholder:text-slate-500" aria-label="Message" placeholder="Message or paste a link" value={text} onChange={(e) => setText(e.target.value)} />
          <button className={`absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-primary text-ink transition ${text.trim() && !busy ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0'}`} aria-label="Send" tabIndex={text.trim() && !busy ? 0 : -1}>
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /></svg>
          </button>
        </div>
      </form>
    </div>
  )
}

// One URL per section; the labels are the nav labels.
const PATHS = { Goals: '/goals', Deadlines: '/deadlines', Tasks: '/tasks', 'Do now': '/do-now', Calendar: '/calendar' }
const tabOf = () => Object.keys(PATHS).find((t) => PATHS[t] === location.pathname) || 'Tasks'

export default function App() {
  const [tab, setTabState] = useState(tabOf)
  const setTab = (t) => { if (t !== tab) history.pushState(null, '', PATHS[t]); setTabState(t) }
  useEffect(() => { const f = () => setTabState(tabOf()); addEventListener('popstate', f); return () => removeEventListener('popstate', f) }, [])
  useEffect(() => {
    document.title = `${tab} · Desker`
    if (location.pathname !== PATHS[tab]) history.replaceState(null, '', PATHS[tab]) // "/" and unknown paths land on Tasks
  }, [tab])
  const [coachOpen, setCoachOpen] = useState(false)
  const [replanOpen, setReplanOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [reviewReq, setReviewReq] = useState(0)
  const [, tick] = useState(0) // re-render each minute so "missed" flags stay current
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(id) }, [])
  const [cheer, setCheer] = useState(0) // bumps when Do First is cleared, to animate the logo
  const [toast, setToast] = useState(null) // { text, undo } after finishing a task
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(id)
  }, [toast])
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState(false)
  useEffect(() => {
    fetch(stateUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load your data')))).then((d) => setData(migrate(d))).catch((e) => setLoadError(e.message))
  }, [])
  // keep an imported calendar fresh (at most hourly)
  const stale = data?.sync?.url && Date.now() - data.sync.at > 36e5 ? data.sync.url : null
  useEffect(() => {
    if (stale) importCalendar({ url: stale }).then((busy) => setData((d) => ({ ...d, busy, sync: { ...d.sync, at: Date.now() } }))).catch(() => {})
  }, [stale])
  useEffect(() => {
    if (!data) return
    const id = setTimeout(() => {
      fetch(stateUrl, { method: 'PUT', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
        .then((r) => setSaveError(!r.ok)).catch(() => setSaveError(true))
    }, 500)
    return () => clearTimeout(id)
  }, [data])
  if (!data) return <p className="p-4">{loadError || 'Loading…'}</p>
  const { goals, tasks } = data
  // drop a focus whose task was deleted or finished elsewhere
  const focus = data.focus && (!data.focus.taskId || tasks.some((t) => t.id === data.focus.taskId && !t.done)) ? data.focus : null
  const pick = data.pick && (!data.pick.taskId || tasks.some((t) => t.id === data.pick.taskId && !t.done)) ? data.pick : null
  const hobbies = data.hobbies || []
  const deadlines = data.deadlines || []
  const setDeadlines = (deadlines) => setData((d) => ({ ...d, deadlines }))
  const setFocus = (focus) => { setData((d) => ({ ...d, focus, pick: null })); setFocusOpen(!!focus) } // starting something opens the timer
  const addSpent = (id, hours) => hours > 0 && setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, spent: Math.round(((t.spent || 0) + hours) * 1000) / 1000 } : t)) }))
  const startTask = (t) => setFocus({ taskId: t.id, title: t.title, method: 'Your choice', why: 'You started it yourself.', minutes: t.hours ? Math.round(t.hours * 60) : undefined, at: Date.now() })
  const focusTask = focus && tasks.find((t) => t.id === focus.taskId)
  const missed = tasks.filter((t) => isMissed(t))
  const openReplan = () => { setCoachOpen(false); setReplanOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const setPick = (pick) => setData((d) => ({ ...d, pick }))
  const setHobbies = (hobbies) => setData((d) => ({ ...d, hobbies }))
  const setGoals = (goals) => setData((d) => ({ ...d, goals }))
  // Every task change goes through settle(): it stamps doneAt, adds the next copy of finished repeating tasks, and feeds Undo.
  const setTasks = (next) => {
    const r = settle(tasks, next)
    const doFirst = (list) => list.some((t) => !t.done && !t.fun && quadrant(t) === 0)
    const cleared = r.finished.length > 0 && doFirst(tasks) && !doFirst(r.tasks)
    if (cleared) setCheer((n) => n + 1)
    setData((d) => ({ ...d, tasks: r.tasks }))
    if (r.finished.length) {
      const names = r.tasks.filter((t) => r.finished.includes(t.id)).map((t) => t.title)
      setToast({ text: `Done: ${names.length > 1 ? `${names.length} tasks` : names[0]}${r.spawned.length ? ' (next one added)' : ''}${cleared ? '. Do First is clear.' : ''}`,
        undo: () => { setData((d) => ({ ...d, tasks: settle(d.tasks, d.tasks.filter((t) => !r.spawned.includes(t.id)).map((t) => (r.finished.includes(t.id) ? { ...t, done: false } : t))).tasks })); setToast(null) } })
    }
  }
  const deleteTask = (t) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) }))
    setToast({ text: `Deleted: ${t.title}`, undo: () => { setData((d) => ({ ...d, tasks: [...d.tasks, t] })); setToast(null) } })
  }
  const TABS = ['Goals', 'Deadlines', 'Tasks', 'Do now', 'Calendar']
  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-white p-3 md:flex" aria-label="Desker">
        <button className="mb-4 flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-100" onClick={() => setTab('Tasks')} aria-label="Desker home">
          <img key={cheer} src="/favicon.svg" alt="" className={`h-11 w-11 ${cheer ? 'cheer' : ''}`} />
          <span><span className="block text-lg font-semibold leading-tight">Desker</span><span className="block text-xs text-slate-500">Eisenhower planner</span></span>
        </button>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t} className={`flex min-h-9 items-center gap-3 rounded-lg px-3 text-sm ${tab === t ? 'bg-pale font-medium text-ink' : 'text-slate-600 hover:bg-slate-50 hover:text-ink'}`}
              aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>
              <Icon name={t} />{t}
            </button>
          ))}
        </nav>
        <button className={`mb-1 flex min-h-9 items-center gap-3 rounded-lg px-3 text-sm ${coachOpen ? 'bg-pale font-medium text-ink' : 'text-slate-600 hover:bg-slate-50 hover:text-ink'}`} aria-expanded={coachOpen} onClick={() => setCoachOpen(!coachOpen)}>
          <Icon name="Coach" />Coach
        </button>
        <Settings data={data} setData={setData} row />
      </aside>
      <div className="mx-auto flex min-w-0 max-w-5xl flex-1 flex-col gap-6 p-4 pb-28 md:p-8">
      <main className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img key={cheer} src="/favicon.svg" alt="" className={`h-10 w-10 md:hidden ${cheer ? 'cheer' : ''}`} />
            <h1 className="text-2xl font-semibold leading-tight">{tab}</h1>
          </div>
          <div className="md:hidden"><Settings data={data} setData={setData} /></div>
        </div>
        {saveError && <p role="alert" className="mb-3 rounded bg-danger/15 p-2 text-sm text-danger">Your latest changes could not be saved. Check your connection; they will retry on the next change.</p>}
        {(tab === 'Tasks' ? (focus || pick || fromCalendar(tasks)) : tab === 'Do now' && (focus || pick)) && <Hero tasks={tasks} setTasks={setTasks} focus={focus} pick={pick} setFocus={setFocus} go={() => setTab('Do now')} openTimer={() => setFocusOpen(true)} />}
        {missed.length > 0 && !replanOpen && (
          <div role="status" className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-danger/10 p-3 text-sm">
            <span><b>{missed.length} planned task{missed.length === 1 ? '' : 's'}</b> slipped past {missed.length === 1 ? 'its' : 'their'} time: {missed.slice(0, 3).map((t) => t.title).join(', ')}{missed.length > 3 ? '…' : ''}</span>
            <button className={`${btn} ${BLUE}`} onClick={openReplan}>Replan my week</button>
          </div>
        )}
        {replanOpen && <Replan data={data} busy={busyForAI(data.busy)} energy={patternOf(data)} ratio={ratioOf(tasks)} onClose={() => setReplanOpen(false)} onApply={(plan) => { setTasks(applyReplan(tasks, plan)); setReplanOpen(false) }} />}
        <div key={tab} className="enter">
        {tab === 'Goals' && <Goals goals={goals} setGoals={setGoals} hobbies={hobbies} setHobbies={setHobbies} tasks={tasks} onReview={() => { setCoachOpen(true); setReviewReq((n) => n + 1) }} />}
        {tab === 'Deadlines' && <Deadlines goals={goals} deadlines={deadlines} setDeadlines={setDeadlines} tasks={tasks} setTasks={setTasks} />}
        {tab === 'Do now' && <DoNow data={data} tasks={tasks} setFocus={setFocus} setPick={setPick} setData={setData} />}
        {tab === 'Tasks' && <Tasks goals={goals} tasks={tasks} setTasks={setTasks} goTab={setTab} setFocus={setFocus} deleteTask={deleteTask} />}
        {tab === 'Calendar' && <Calendar goals={goals} tasks={tasks} setTasks={setTasks} freeHours={data.freeHours} freeToday={freeTodayOf(data)} deadlines={deadlines} setDeadlines={setDeadlines} data={data} setData={setData} onStart={startTask} onReplan={openReplan} />}
        </div>
      </main>
      <aside className={`${coachOpen ? 'fixed inset-y-0 right-0 z-30 flex w-full flex-col bg-white sm:w-[26rem] sm:border-l sm:border-line' : 'hidden'}`} onKeyDown={(e) => e.key === 'Escape' && setCoachOpen(false)}>
        <Chat data={data} setData={setData} onClose={() => setCoachOpen(false)} onReplan={openReplan} reviewReq={reviewReq} />
      </aside>
      </div>
      {focus && focusOpen && (
        <Focus key={focus.at} title={focus.title} estimate={focusTask?.hours} spent={focusTask?.spent} logged={!!focusTask}
          onLog={(h) => focusTask && addSpent(focusTask.id, h)}
          onDone={(h) => { if (focusTask) setTasks(tasks.map((t) => (t.id === focusTask.id ? { ...t, done: true, spent: Math.round(((t.spent || 0) + h) * 1000) / 1000 } : t))); setFocus(null) }}
          onStop={(h) => { if (focusTask) addSpent(focusTask.id, h); setFocus(null) }} />
      )}
      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-lg border border-control bg-ink px-4 py-2 text-sm text-white md:bottom-4">
          <span className="min-w-0 break-words">{toast.text}</span>
          <button className="shrink-0 rounded-md px-3 py-1 font-semibold text-slate-200" onClick={toast.undo}>Undo</button>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Sections">
        {[...TABS, 'Coach'].map((t) => {
          const on = t === 'Coach' ? coachOpen : tab === t
          return (
            <button key={t} className={`relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-xs ${on ? 'bg-pale font-medium text-ink' : 'text-slate-500'}`}
              aria-current={on ? 'page' : undefined} onClick={() => (t === 'Coach' ? setCoachOpen(true) : setTab(t))}>
              <Icon name={t} />{t}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
