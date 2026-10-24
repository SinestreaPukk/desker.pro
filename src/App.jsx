import { useState, useEffect, useRef } from 'react'
import { post, uid, stateUrl } from './api.js'
import { addTasks } from './tasks.js'
import { migrate } from './storage.js'
import { METHODS } from './methods.js'
import { Icon } from './icons.jsx'

const Q = [
  { name: 'Do First', hint: 'Urgent + Important', cls: 'bg-[#ff3b30]/15' },
  { name: 'Schedule', hint: 'Not Urgent + Important', cls: 'bg-[#007aff]/15' },
  { name: 'Batch / minimize', hint: 'Urgent but not important: do quickly in one batch, or hand off', cls: 'bg-[#ff9500]/20' },
  { name: 'Eliminate', hint: 'Not Urgent + Not Important', cls: 'bg-[#8e8e93]/15' },
]
// Goals pyramid, narrowest (top) to widest (base)
const LEVELS = [
  { name: 'Vision', hint: 'Life purpose / who you want to be', w: 'w-1/3', cls: 'bg-[#af52de]/20' },
  { name: 'Long-term', hint: '5+ years', w: 'w-1/2', cls: 'bg-[#5856d6]/20' },
  { name: 'Mid-term', hint: '1-3 years', w: 'w-3/4', cls: 'bg-[#007aff]/20' },
  { name: 'Short-term', hint: 'This quarter', w: 'w-full', cls: 'bg-[#5ac8fa]/25' },
]
// undefined until the AI has ranked the task
const quadrant = (t) => t.important === undefined ? undefined : (t.important ? 0 : 2) + (t.urgent ? 0 : 1)

async function prioritise(goals, tasks) {
  const out = await post('/api/prioritise', { goals: goals.map(({ id, title, level, happiness }) => ({ id, level: LEVELS[level].name, kind: happiness ? 'happiness' : 'work', title })), tasks: tasks.map(({ id, title, due }) => ({ id, title, due })) })
  if (!Array.isArray(out)) throw new Error('The AI gave an unreadable answer. Please try again.')
  return out
}

// Photos, PDFs, text files and web pages -> plain notes the planner can use.
const TEXT_FILE = /\.(txt|md|markdown|csv|json|ics)$/i
async function readSource({ file, url }) {
  let body
  if (url) body = { url }
  else if (file.type.startsWith('text/') || TEXT_FILE.test(file.name)) return (await file.text()).slice(0, 6000)
  else if (file.type.startsWith('image/')) {
    const bmp = await createImageBitmap(file).catch(() => { throw new Error('This photo format is not supported. Try JPEG or PNG.') })
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) })
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    body = { name: file.name, mediaType: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.85).split(',')[1] }
  } else if (file.type === 'application/pdf') {
    if (file.size > 3e6) throw new Error('That PDF is over 3 MB')
    const data = await new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(f.result.split(',')[1]); f.onerror = no; f.readAsDataURL(file) })
    body = { name: file.name, mediaType: 'application/pdf', data }
  } else throw new Error('Supported: photos, PDFs, text files')
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
        <span aria-hidden="true">😞</span>
        <input type="range" aria-label="How do you feel about this task? Left is dreading it, right is looking forward to it" min="0" max="100" className="w-24" value={value} onChange={(e) => onChange(+e.target.value)} />
        <span aria-hidden="true">😊</span>
      </span>
    </label>
  )
}

const BLUE = 'bg-[#007aff] text-white hover:bg-[#0a84ff]'
const btn = 'rounded-full px-4 py-2 text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
const input = 'rounded-xl bg-slate-100 px-3 py-2 placeholder:text-slate-600'

function Row({ t, onToggle, onHappy, onEdit, onDelete }) {
  return (
    <li className="rounded bg-white/70 px-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-w-0 items-center gap-2">
          <input type="checkbox" checked={t.done} onChange={onToggle} />
          <span className={`break-words ${t.done ? 'text-slate-500 line-through' : ''}`}>
            {t.title}
            {t.due && <span className="ml-2 text-xs text-slate-500">due {t.due}</span>}
            {t.when && <span className="ml-2 text-xs text-slate-500">planned {t.when}</span>}
            {t.hours > 0 && <span className="ml-2 text-xs text-slate-500">{t.hours}h</span>}
          </span>
        </label>
        <span className="flex shrink-0 gap-1">
          <button className={`${btn} hover:bg-white`} onClick={onEdit} aria-label={`Edit ${t.title}`}>Edit</button>
          <button className={`${btn} text-[#d70015] hover:bg-white`} onClick={onDelete} aria-label={`Delete ${t.title}`}>Delete</button>
        </span>
      </div>
      <div className="pl-6"><Happy value={t.happy} onChange={onHappy} label="Feeling about it" /></div>
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
      <h2 className="mb-1 font-semibold">Things I want to do for fun</h2>
      <p className="mb-2 text-sm text-slate-600">Hobbies and things that make you happy. The coach schedules them between your tasks.</p>
      <form className="mb-2 flex gap-2" onSubmit={add}>
        <input className={`${input} min-w-48 flex-1`} placeholder="e.g. Play guitar" value={v} onChange={(e) => setV(e.target.value)} />
        <button className={`${btn} bg-[#007aff] text-white hover:bg-[#0a84ff]`}>Add</button>
      </form>
      <ul className="flex flex-wrap gap-2">
        {hobbies.map((h) => (
          <li key={h.id} className="flex items-center gap-1 rounded-full bg-[#34c759]/20 py-0.5 pl-3 pr-1 text-sm">
            {h.title}
            <button className="rounded-full px-2 text-slate-600 hover:bg-white" aria-label={`Remove ${h.title}`}
              onClick={() => setHobbies(hobbies.filter((x) => x.id !== h.id))}>×</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Goals({ goals, setGoals, hobbies, setHobbies }) {
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
      <p className="mb-2 text-sm text-slate-600">Build your goals pyramid. The AI links each task to a goal and uses its level to judge importance.</p>
      <form className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5" onSubmit={submit}>
        <input className={`${input} min-w-48 flex-1`} placeholder="Goal" value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })} />
        <select className={input} value={d.level} onChange={(e) => setD({ ...d, level: +e.target.value })}>
          {LEVELS.map((l, i) => <option key={l.name} value={i}>{l.name} ({l.hint})</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={!!d.happiness} onChange={(e) => setD({ ...d, happiness: e.target.checked })} /> Happiness goal
        </label>
        <button className={`${btn} bg-[#007aff] text-white hover:bg-[#0a84ff]`}>{d.id ? 'Save' : 'Add'}</button>
        {d.id && <button type="button" className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={() => setD(blank)}>Cancel</button>}
      </form>
      <div className="flex flex-col items-center gap-1">
        {LEVELS.map((l, i) => (
          <section key={l.name} className={`${l.w} ${l.cls} rounded-2xl p-3`}>
            <h2 className="text-center font-semibold">{l.name} <span className="text-xs font-normal text-slate-600">{l.hint}</span></h2>
            <ul className="mt-2 space-y-1">
              {!goals.some((g) => g.level === i) && <li className="text-center text-sm text-slate-600">No goals yet</li>}
              {goals.filter((g) => g.level === i).map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 rounded bg-white/70 px-2 py-1">
                  <span className="min-w-0 break-words">{g.title}{g.happiness && <span className="ml-2 rounded bg-[#34c759]/20 px-1.5 text-xs">happiness</span>}</span>
                  <span className="flex shrink-0 gap-1">
                    <button className={`${btn} hover:bg-white`} onClick={() => setD(g)}>Edit</button>
                    <button className={`${btn} text-[#d70015] hover:bg-white`} onClick={() => setGoals(goals.filter((x) => x.id !== g.id))}>Delete</button>
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

function DeadlineCard({ dl, goals, tasks, setTasks, patch, remove }) {
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
        deadline: { title: dl.title, date: dl.date, hours: dl.hours ?? null, context }, asked,
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
    <li className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words font-semibold">{dl.title}</h3>
          <p className="text-sm text-slate-600">
            {dl.date} · {days < 0 ? 'passed' : days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} left`}
            {dl.hours != null && ` · ${dl.hours}h needed`}{linked > 0 && ` · ${linked} task${linked === 1 ? '' : 's'} added`}
          </p>
        </div>
        <span className="flex gap-1">
          <button className={`${btn} bg-[#007aff] text-white hover:bg-[#0a84ff]`} disabled={busy} onClick={() => plan()}>
            {busy ? 'Thinking…' : res?.options ? 'Re-plan' : 'Plan with AI'}
          </button>
          <button className={`${btn} text-[#d70015] hover:bg-slate-50`} aria-label={`Delete ${dl.title}`} onClick={remove}>Delete</button>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">Hours I need
          <input type="number" min="0" step="0.5" className={`${input} w-20`} placeholder="Not sure" value={dl.hours ?? ''}
            onChange={(e) => patch({ hours: e.target.value === '' ? null : +e.target.value })} />
        </label>
        <label className="flex items-center gap-1">Date
          <input type="date" className={input} value={dl.date} onChange={(e) => e.target.value && patch({ date: e.target.value })} />
        </label>
        <button className="text-[#0066d6] underline" onClick={() => setOpen(!open)}>{open ? 'Hide context' : dl.context ? 'Edit context' : 'Add context'}</button>
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

      {error && <p className="mt-2 text-sm text-[#d70015]">{error}</p>}
      {res?.question && (
        <form className="mt-3 rounded-2xl bg-slate-100 p-3 text-sm" onSubmit={reply}>
          <p className="mb-2 font-medium">{res.question}</p>
          <div className="flex gap-2">
            <input className={`${input} min-w-0 flex-1`} aria-label="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
            <button className={`${btn} bg-[#007aff] text-white hover:bg-[#0a84ff]`} disabled={busy}>Answer</button>
          </div>
        </form>
      )}
      {res?.options && (
        <div className="mt-3">
          <p className="mb-2 text-sm text-slate-600">{res.summary} Pick the tasks to add.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {res.options.map((o, i) => (
              <li key={i}>
                <label className={`flex cursor-pointer gap-2 rounded-2xl border p-2 text-sm ${picked.includes(i) ? 'border-[#007aff] bg-[#007aff]/10' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={picked.includes(i)} onChange={() => toggle(i)} />
                  <span><b className="font-medium">{o.title}</b><br /><span className="text-slate-600">{o.hours}h · by {o.due}</span></span>
                </label>
              </li>
            ))}
          </ul>
          <button className={`${btn} mt-3 bg-[#007aff] text-white hover:bg-[#0a84ff]`} disabled={!picked.length} onClick={add}>
            Add {picked.length} task{picked.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </li>
  )
}

function Deadlines({ goals, deadlines, setDeadlines, tasks, setTasks }) {
  const blank = { title: '', date: '', hours: '', context: '' }
  const [d, setD] = useState(blank)
  const submit = (e) => {
    e.preventDefault()
    if (!d.title.trim() || !d.date) return
    setDeadlines([...deadlines, { id: Date.now(), title: d.title.trim(), date: d.date, hours: d.hours === '' ? null : +d.hours, context: d.context }])
    setD(blank)
  }
  const patch = (id) => (p) => setDeadlines(deadlines.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <>
      <p className="mb-2 text-sm text-slate-600">Add anything with a due date: an exam, a project, a trip. The AI works out the hours and suggests tasks to pick from.</p>
      <form className="mb-4 flex flex-wrap items-start gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5" onSubmit={submit}>
        <input className={`${input} min-w-48 flex-1`} placeholder="Deadline, e.g. Statics quiz" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        <input type="date" aria-label="Date" className={input} value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        <input type="number" min="0" step="0.5" aria-label="Hours needed" className={`${input} w-36`} placeholder="Hours (opt.)" value={d.hours} onChange={(e) => setD({ ...d, hours: e.target.value })} />
        <textarea className={`${input} w-full`} rows={2} aria-label="Context" placeholder="Not sure about the hours? Add syllabus, topics, or how ready you feel (optional)"
          value={d.context} onChange={(e) => setD({ ...d, context: e.target.value })} />
        <button className={`${btn} bg-[#007aff] text-white hover:bg-[#0a84ff]`}>Add deadline</button>
      </form>
      {!deadlines.length && <p className="text-sm text-slate-600">No deadlines yet.</p>}
      <ul className="space-y-3">
        {[...deadlines].sort((a, b) => a.date.localeCompare(b.date)).map((dl) => (
          <DeadlineCard key={dl.id} dl={dl} goals={goals} tasks={tasks} setTasks={setTasks} patch={patch(dl.id)}
            remove={() => setDeadlines(deadlines.filter((x) => x.id !== dl.id))} />
        ))}
      </ul>
    </>
  )
}

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

function Hero({ tasks, setTasks, focus, pick, setFocus, go }) {
  const cur = focus || pick || fromCalendar(tasks)
  const finish = () => {
    if (cur.taskId) setTasks(tasks.map((t) => (t.id === cur.taskId ? { ...t, done: true } : t)))
    setFocus(null)
  }
  return (
    <section className="mb-4 rounded-3xl bg-[#1c1c1e] p-5 text-white shadow-lg shadow-slate-900/10" aria-label="What to do now">
      <p className="text-sm text-slate-300">{focus ? 'You are doing' : 'Right now, try'}</p>
      {cur ? (
        <>
          <p className="mt-1 break-words text-2xl font-semibold leading-tight tracking-tight">{cur.title}</p>
          <p className="mt-1 text-sm text-slate-300">{pick && !focus ? `You picked: ${cur.method}` : cur.method}{cur.minutes ? ` · ${cur.minutes} min` : ''} · {cur.why}</p>
        </>
      ) : (
        <p className="mt-1 text-2xl font-semibold leading-tight tracking-tight">Nothing pending. Add a task or enjoy a hobby.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {cur && <button className={`${btn} bg-white text-slate-900 hover:bg-slate-100`} onClick={focus ? finish : () => setFocus({ ...cur, at: Date.now() })}>{focus ? 'Done' : 'Start'}</button>}
        {focus && <button className={`${btn} border border-slate-500 hover:bg-slate-700`} onClick={() => setFocus(null)}>Stop</button>}
        <button className={`${btn} border border-slate-500 hover:bg-slate-700`} onClick={go}>Compare other ways</button>
      </div>
    </section>
  )
}

function DoNow({ data, tasks, setFocus, setPick }) {
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
        minutes, energy, mood: data.mood, freeToday: freeTodayOf(data), busy: busyForAI(data.busy), now: new Date().toLocaleString(),
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
  const card = 'flex flex-col justify-between rounded-2xl bg-white p-3 ring-1 ring-black/5'
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5">
        <label className="flex flex-col gap-1 text-sm">Minutes free right now
          <input type="number" min="5" step="5" className={`${input} w-28`} value={minutes} onChange={(e) => setMinutes(+e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">Your energy
          <select className={input} value={energy} onChange={(e) => setEnergy(e.target.value)}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </label>
      </div>
      <h2 className="mb-1 font-semibold">Compare ways to choose</h2>
      <p className="mb-2 text-sm text-slate-600">Each method picks a different task from your list. Pick the one that feels right and it becomes your "Right now, try" at the top.</p>
      <ul className="mb-6 grid gap-3 sm:grid-cols-2">
        {picks.map(({ m, r }) => (
          <li key={m.name} className={card}>
            <div>
              <p className="text-xs font-medium text-[#0066d6]">{m.name} <span className="font-normal text-slate-600">· {m.how}</span></p>
              {r ? <>
                <p className="mt-1 break-words font-semibold">{r.t.title}</p>
                <p className="mt-1 text-sm text-slate-600">{r.t.hours ? `${r.t.hours}h · ` : ''}{r.why}</p>
              </> : <p className="mt-1 text-sm text-slate-600">{tasks.some((t) => !t.done && !t.fun) ? 'Nothing fits your minutes. Try more time.' : 'No open tasks yet. Add some in Tasks.'}</p>}
            </div>
            {r && <button className={`${btn} mt-3 self-start ${BLUE}`} onClick={() => choose(m, r.t, r.why)}>Pick this</button>}
          </li>
        ))}
      </ul>
      <h2 className="mb-1 font-semibold">Or ask the AI</h2>
      <p className="mb-2 text-sm text-slate-600">It also considers your mood, calendar and hobbies. The calendar plan is what your schedule says to do now.</p>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button className={`${btn} ${BLUE}`} disabled={busy} onClick={ask}>{busy ? 'Thinking…' : opts ? 'Ask again' : 'What should I do now?'}</button>
        {error && <span role="alert" className="text-sm text-[#d70015]">{error}</span>}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((o, i) => (
          <li key={i} className={card}>
            <div>
              <p className="text-xs font-medium text-[#0066d6]">{o.method}</p>
              <p className="mt-1 break-words font-semibold">{o.title}</p>
              <p className="mt-1 text-sm text-slate-600">{o.minutes ? `${o.minutes} min · ` : ''}{o.why}</p>
            </div>
            <button className={`${btn} mt-3 self-start ${BLUE}`} onClick={() => start(o)}>Do this now</button>
          </li>
        ))}
      </ul>
    </>
  )
}

function Tasks({ goals, tasks, setTasks, goTab }) {
  const blank = { title: '', due: '', happy: 50, hours: '' }
  const [d, setD] = useState(blank)
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
          const { important, urgent, goalId, reason, ...keep } = t // keeps hours, planned date, readiness, deadline link
          return { ...keep, title: d.title, due: d.due, happy: d.happy ?? 50, hours: hours }
        })
      : addTasks(tasks, [{ ...d, hours }]))
    setD(blank)
  }
  const update = (id, patch) => setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const lines = dump.split('\n').map((l) => l.trim()).filter(Boolean)
  const addDump = (e) => {
    e.preventDefault()
    if (!lines.length) return
    setTasks(addTasks(tasks, lines.slice(0, 50).map((title) => ({ title }))))
    setAdded(lines.length); setDump('')
  }

  const run = async () => {
    setAdded(0); setBusy(true); setError('')
    try {
      const open = tasks.filter((t) => !t.done && !t.fun)
      const ranks = await prioritise(goals, open)
      setTasks(tasks.map((t) => {
        const r = ranks.find((r) => r.id === t.id)
        return r ? { ...t, goalId: r.goalId, important: !!r.important, urgent: !!r.urgent, reason: r.reason } : t
      }))
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  const all = tasks.filter((t) => !t.fun).map((t) => ({ ...t, q: quadrant(t) }))
  const sorted = [...all].sort(
    (a, b) => a.done - b.done || (a.q ?? 9) - (b.q ?? 9) || (a.due || '9').localeCompare(b.due || '9')
  )
  const row = (t) => (
    <Row key={t.id} t={t} onToggle={() => update(t.id, { done: !t.done })} onHappy={(happy) => update(t.id, { happy })} onEdit={() => setD(t)}
      onDelete={() => setTasks(tasks.filter((x) => x.id !== t.id))} />
  )
  const unranked = all.filter((t) => t.q === undefined)

  return (
    <>
      <p className="mb-2 text-sm text-slate-600">The Eisenhower Matrix sorts tasks by what is urgent and what is important.</p>
      {!all.length && (
        <form className="mb-3 rounded-2xl bg-white p-4 ring-1 ring-black/5" onSubmit={addDump}>
          <label className="mb-2 block font-semibold" htmlFor="dump">What's on your mind? Dump everything here</label>
          <textarea id="dump" className={`${input} w-full`} rows={5} placeholder={'One task per line, e.g.\nStudy for statics quiz\nCall the dentist\nBuy a birthday gift'} value={dump} onChange={(e) => setDump(e.target.value)} />
          <button className={`${btn} mt-2 ${BLUE}`} disabled={!lines.length}>{lines.length > 1 ? `Add ${lines.length} tasks` : 'Add task'}</button>
        </form>
      )}
      {added > 0 && (
        <div role="status" className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5">
          <span>Added {added} task{added === 1 ? '' : 's'}. Sort them into the matrix?</span>
          <button className={`${btn} ${BLUE}`} disabled={busy} onClick={run}>{busy ? 'Sorting…' : 'Sort with AI'}</button>
          <button className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={() => setAdded(0)}>Later</button>
        </div>
      )}
      <form className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5" onSubmit={submit}>
        <input className={`${input} min-w-48 flex-1`} placeholder="Task" aria-label="Task" value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })} />
        <input type="date" className={input} value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} />
        <input type="number" min="0" step="0.5" aria-label="Hours needed" className={`${input} w-36`} placeholder="Hours (opt.)" value={d.hours ?? ''} onChange={(e) => setD({ ...d, hours: e.target.value })} />
        <Happy value={d.happy} onChange={(happy) => setD({ ...d, happy })} />
        <button className={`${btn} bg-[#007aff] text-white hover:bg-[#0a84ff]`}>{d.id ? 'Save' : 'Add'}</button>
        {d.id && <button type="button" className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={() => setD(blank)}>Cancel</button>}
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button className={`${btn} bg-[#007aff] text-white hover:bg-[#0a84ff] disabled:opacity-50`}
          disabled={busy || !all.some((t) => !t.done)} onClick={run}>
          {busy ? 'Prioritising…' : 'Prioritise with AI'}
        </button>
        {!goals.length && <button className="text-sm text-[#0066d6] underline" onClick={() => goTab('Goals')}>Link goals for better ranking.</button>}
        {error && <span className="text-sm text-[#d70015]">{error}</span>}
      </div>

      <h2 className="mb-2 font-semibold">Priority List</h2>
      {!all.length && <p className="mb-6 text-sm text-slate-600">No tasks yet.</p>}
      <ol className="mb-6 space-y-1">
        {sorted.map((t) => (
          <li key={t.id} className={`${t.q === undefined ? 'bg-white' : Q[t.q].cls} rounded p-1`}>
            <ul>{row(t)}</ul>
            <span className="px-2 text-xs text-slate-600">{t.q === undefined ? 'Not prioritised yet' : Q[t.q].name}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        {Q.map((q, i) => (
          <section key={q.name} className={`${q.cls} rounded-2xl p-3`}>
            <h2 className="font-semibold">{q.name} <span className="text-xs font-normal text-slate-600">{q.hint}</span></h2>
            <ul className="mt-2 space-y-1">{all.filter((t) => t.q === i).map(row)}</ul>
          </section>
        ))}
      </div>
      {sorted.some((t) => t.reason) && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold">Why this placement?</h2>
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
const color = (t) => (t.fun ? 'bg-[#34c759]/20' : quadrant(t) === undefined ? 'bg-white border' : Q[quadrant(t)].cls)

function Detail({ t, goals, deadlines, update, remove, close }) {
  const goal = goals.find((g) => g.id === t.goalId)
  const dl = deadlines.find((x) => x.id === t.deadlineId)
  const lbl = 'flex flex-col gap-1 text-sm'
  return (
    <section className={`mt-4 rounded-2xl p-3 ring-1 ring-black/5 ${color(t)} ${t.fun || quadrant(t) !== undefined ? '' : 'border-slate-200'}`} aria-label="Task details">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t.fun ? 'Fun session' : 'Task details'}</h2>
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
        <label className={lbl}>Hours needed
          <input type="number" min="0" step="0.5" className={input} value={t.hours ?? ''} onChange={(e) => update(t.id, { hours: e.target.value === '' ? undefined : +e.target.value })} />
        </label>
        {!t.fun && <label className={lbl}>Readiness: {t.readiness ?? '?'}{t.readiness != null && '%'}
          <input type="range" min="0" max="100" value={t.readiness ?? 50} onChange={(e) => update(t.id, { readiness: +e.target.value })} />
        </label>}
        <div className={lbl}><Happy value={t.happy} onChange={(happy) => update(t.id, { happy })} /></div>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={t.done} onChange={() => update(t.id, { done: !t.done })} /> Done
        </label>
      </div>
      {dl && <p className="mt-3 text-sm">For deadline: <b>{dl.title}</b> ({dl.date})</p>}
      {!t.fun && t.reason && (
        <p className="mt-3 text-sm"><b>{Q[quadrant(t)].name}</b>
          <span className="text-slate-600"> · {goal ? `${LEVELS[goal.level].name} goal: ${goal.title}` : 'No matching goal'}</span><br />{t.reason}</p>
      )}
      <button className={`${btn} mt-3 text-[#d70015] hover:bg-white`} onClick={() => { remove(t.id); close() }}>Delete</button>
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
    <details className="mb-4 rounded-2xl bg-white p-3 ring-1 ring-black/5">
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
            {data.sync && <button className={`${link} text-[#d70015]`} onClick={() => { setData((d) => ({ ...d, busy: [], sync: undefined })); setUrl(''); setMsg('Disconnected. Imported events removed.') }}>Disconnect</button>}
          </div>
          <p className="mt-2 text-xs text-slate-600">Your link is saved so we can refresh it. Imported events are only used to plan around.</p>
        </section>
      </div>
      {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
    </details>
  )
}

function Calendar({ goals, tasks, setTasks, freeHours, freeToday, deadlines, setDeadlines, data, setData }) {
  const [adding, setAdding] = useState(null) // date being given a deadline
  const [dl, setDl] = useState({ title: '', hours: '' })
  const [month, setMonth] = useState(() => new Date(new Date().setDate(1)))
  const [sel, setSel] = useState(null)
  const y = month.getFullYear(), m = month.getMonth()
  const shift = (n) => setMonth(new Date(y, m + n, 1))
  const key = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const today = new Date().toLocaleDateString('sv') // yyyy-mm-dd, local time
  const cells = [...Array(month.getDay()).fill(null), ...Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => i + 1)]
  const update = (id, patch) => setTasks(tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const chip = (t) => (
    <button key={t.id} title={t.title} onClick={() => setSel(t.id)}
      className={`chip block w-full truncate rounded px-1 text-left text-xs ${color(t)} ${t.done ? 'text-slate-500 line-through' : ''} ${sel === t.id ? 'ring-2 ring-slate-800' : ''}`}>
      {t.title}
    </button>
  )
  const undated = tasks.filter((t) => !dateKey(t))
  const selected = tasks.find((t) => t.id === sel)
  return (
    <>
      <CalendarSync data={data} setData={setData} />
      <div className="mb-3 flex items-center justify-between">
        <button aria-label="Previous month" className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={() => shift(-1)}>←</button>
        <h2 className="font-semibold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <button aria-label="Next month" className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={() => shift(1)}>→</button>
      </div>
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
            <div key={i} className={`min-h-16 rounded p-1 ${d ? 'bg-white' : ''} ${d && key(d) === today ? 'ring-2 ring-[#007aff]' : ''}`}>
              {d && (
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <button className="-m-1 rounded px-1 py-0.5 hover:bg-slate-100" aria-label={`Add deadline on ${key(d)}`} onClick={() => setAdding(key(d))}>{d}</button>
                  {hrs > 0 && <span className={limit && hrs > limit ? 'font-medium text-[#d70015]' : ''}>{hrs}h</span>}
                </div>
              )}
              <div className="space-y-0.5">
                {deadlines.filter((x) => x.date === key(d)).map((x) => <div key={x.id} title={`Deadline: ${x.title}`} className="truncate rounded bg-[#ff3b30] px-1 text-xs font-medium text-white">Due: {x.title}</div>)}
                {day.map(chip)}
                {events.slice(0, 2).map((x, j) => <div key={j} title={`${x.s ? `${hhmm(x.s)}-${hhmm(x.e)} ` : ''}${x.t}`} className="truncate rounded bg-[#8e8e93]/20 px-1 text-xs text-slate-700">{x.s ? `${hhmm(x.s)} ` : ''}{x.t}</div>)}
                {events.length > 2 && <div className="px-1 text-xs text-slate-600" title={events.slice(2).map((x) => x.t).join(', ')}>+{events.length - 2} more</div>}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">Tasks show on their planned date, or their due date if not planned. Green is fun, red is a deadline, grey is from your connected calendar. Click a task for details, or a date to add a deadline.</p>
      {adding && (
        <form className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5" aria-label="Add deadline"
          onSubmit={(e) => {
            e.preventDefault()
            if (!dl.title.trim()) return
            setDeadlines([...deadlines, { id: Date.now(), title: dl.title.trim(), date: adding, hours: dl.hours === '' ? null : +dl.hours, context: '' }])
            setDl({ title: '', hours: '' }); setAdding(null)
          }}>
          <h2 className="w-full font-semibold">Add deadline on {adding}</h2>
          <input className={`${input} min-w-48 flex-1`} autoFocus aria-label="Deadline title" placeholder="e.g. Statics quiz" value={dl.title} onChange={(e) => setDl({ ...dl, title: e.target.value })} />
          <input type="number" min="0" step="0.5" aria-label="Hours needed" className={`${input} w-36`} placeholder="Hours (opt.)" value={dl.hours} onChange={(e) => setDl({ ...dl, hours: e.target.value })} />
          <button className={`${btn} bg-[#007aff] text-white hover:bg-[#0a84ff]`}>Add deadline</button>
          <button type="button" className={`${btn} bg-slate-100 hover:bg-slate-200`} onClick={() => setAdding(null)}>Cancel</button>
          <p className="w-full text-xs text-slate-600">Plan it with AI from the Deadlines tab.</p>
        </form>
      )}
      {undated.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-1 font-semibold">Not scheduled</h2>
          <div className="flex flex-wrap gap-1">{undated.map((t) => <div key={t.id} className="w-40">{chip(t)}</div>)}</div>
        </section>
      )}
      {selected && <Detail t={selected} goals={goals} deadlines={deadlines} update={update} remove={(id) => setTasks(tasks.filter((x) => x.id !== id))} close={() => setSel(null)} />}
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
    return { ...t, ...p }
  })
  const fun = Array.isArray(o.fun)
    ? o.fun.filter((f) => f.title && DATE.test(f.when)).map((f, i) => ({ id: Date.now() + i, title: f.title, when: f.when, hours: Number(f.hours) || undefined, fun: true, done: false, happy: 100 }))
    : null
  return { ...d, tasks: fun ? [...tasks.filter((t) => !t.fun || t.done), ...fun] : tasks, freeHours: Number.isFinite(o.freeHours) ? o.freeHours : d.freeHours, freeToday: Number.isFinite(o.freeToday) ? { date: todayStr(), hours: o.freeToday } : d.freeToday, mood: typeof o.mood === 'string' && o.mood ? o.mood.slice(0, 80) : d.mood }
}

const freeTodayOf = (d) => (d.freeToday?.date === todayStr() ? d.freeToday.hours : undefined)
const QUICK = ['Help me plan my day', 'Help me set my goals', "I'm feeling stressed", "I'm low on energy"]

function Chat({ data, setData, onClose }) {
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
        tasks: data.tasks.filter((t) => !t.done).map(({ id, title, due, readiness, hours, when, fun, deadlineId }) => ({ id, title, due, readiness, hours, when, fun, deadlineId })),
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
  const addGoals = (mi, ks) => {
    const picked = ks.map((k) => msgs[mi].goals[k])
    setData((d) => ({ ...d, goals: [...d.goals, ...picked.map((g, n) => ({ id: Date.now() + n, title: g.title, level: g.level, happiness: g.happiness }))] }))
    setMsgs(msgs.map((m, i) => (i === mi ? { ...m, goals: m.goals.map((g, k) => (ks.includes(k) ? { ...g, added: true } : g)) } : m)))
  }
  const bubble = 'max-w-[80%] break-words px-3.5 py-2 text-[0.9375rem] leading-snug'
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-none">
      <header className="relative border-b border-black/5 py-2 text-center">
        {onClose && <button className="absolute right-2 top-2 flex min-h-11 items-center rounded-full px-3 text-[#007aff] md:hidden" onClick={onClose}>Done</button>}
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-[#a5a5ad] to-[#85858d] text-sm font-semibold text-white" aria-hidden="true">C</div>
        <h2 className="mt-0.5 text-xs font-medium">Coach</h2>
      </header>
      <div role="log" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3 md:h-80 md:flex-none">
        <div className={`${bubble} mr-auto rounded-[1.25rem] rounded-bl-md bg-[#e9e9eb] text-black`}>
          Hi! I can help you plan around your tasks, deadlines and free time. How are you feeling today?
        </div>
        {msgs.map((m, i) => (
          <div key={i} className={`${bubble} ${m.role === 'user' ? 'ml-auto rounded-[1.25rem] rounded-br-md bg-[#007aff] text-white' : 'mr-auto rounded-[1.25rem] rounded-bl-md bg-[#e9e9eb] text-black'}`}>
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
          <div className="mr-auto flex gap-1 rounded-[1.25rem] rounded-bl-md bg-[#e9e9eb] px-4 py-3" aria-label="Coach is typing">
            <span className="dot" /><span className="dot" style={{ animationDelay: '150ms' }} /><span className="dot" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        {error && <p className="text-center text-xs text-[#d70015]">{error}</p>}
        <div ref={end} />
      </div>
      {!msgs.length && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {QUICK.map((q) => (
            <button key={q} className="rounded-full bg-white px-3 py-1.5 text-sm text-[#007aff] ring-1 ring-[#007aff]/40 transition hover:bg-[#007aff]/10 disabled:opacity-50" disabled={busy} onClick={() => send(q)}>{q}</button>
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
        <label className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-slate-300 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <span className="sr-only">Attach a photo, PDF or text file</span>
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
          <input type="file" className="sr-only" accept="image/*,application/pdf,.txt,.md,.csv,.json,.ics" disabled={busy}
            onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) attachFile(f) }} />
        </label>
        <div className="relative flex-1">
          <input className="w-full rounded-full bg-white py-2 pl-4 pr-11 ring-1 ring-black/15 placeholder:text-slate-500" aria-label="Message" placeholder="Message or paste a link" value={text} onChange={(e) => setText(e.target.value)} />
          <button className={`absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-[#007aff] text-white transition ${text.trim() && !busy ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0'}`} aria-label="Send" tabIndex={text.trim() && !busy ? 0 : -1}>
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /></svg>
          </button>
        </div>
      </form>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('Tasks')
  const [coachOpen, setCoachOpen] = useState(false)
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
  const setFocus = (focus) => setData((d) => ({ ...d, focus, pick: null }))
  const setPick = (pick) => setData((d) => ({ ...d, pick }))
  const setHobbies = (hobbies) => setData((d) => ({ ...d, hobbies }))
  const setGoals = (goals) => setData((d) => ({ ...d, goals }))
  const setTasks = (tasks) => setData((d) => ({ ...d, tasks }))
  const TABS = ['Goals', 'Deadlines', 'Tasks', 'Do now', 'Calendar']
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 pb-28 md:pb-4 lg:flex-row">
      <main className="min-w-0 flex-1">
        <h1 className="mb-4 text-3xl font-semibold leading-tight tracking-tight">Desker <span className="text-lg font-normal text-slate-600">Eisenhower Matrix</span></h1>
        {saveError && <p role="alert" className="mb-3 rounded bg-[#ff3b30]/15 p-2 text-sm text-[#d70015]">Your latest changes could not be saved. Check your connection; they will retry on the next change.</p>}
        <Hero tasks={tasks} setTasks={setTasks} focus={focus} pick={pick} setFocus={setFocus} go={() => setTab('Do now')} />
        <nav className="glass sticky top-3 z-10 mb-4 hidden gap-1 rounded-2xl bg-slate-200/70 p-1 ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150 md:flex">
          {TABS.map((t) => (
            <button key={t} className={`${btn} !transition-none ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        <div key={tab} className="enter">
        {tab === 'Goals' && <Goals goals={goals} setGoals={setGoals} hobbies={hobbies} setHobbies={setHobbies} />}
        {tab === 'Deadlines' && <Deadlines goals={goals} deadlines={deadlines} setDeadlines={setDeadlines} tasks={tasks} setTasks={setTasks} />}
        {tab === 'Do now' && <DoNow data={data} tasks={tasks} setFocus={setFocus} setPick={setPick} />}
        {tab === 'Tasks' && <Tasks goals={goals} tasks={tasks} setTasks={setTasks} goTab={setTab} />}
        {tab === 'Calendar' && <Calendar goals={goals} tasks={tasks} setTasks={setTasks} freeHours={data.freeHours} freeToday={freeTodayOf(data)} deadlines={deadlines} setDeadlines={setDeadlines} data={data} setData={setData} />}
        </div>
      </main>
      <aside className={`${coachOpen ? 'fixed inset-x-0 top-0 z-30 flex h-dvh flex-col bg-[#f9f9fb]' : 'hidden'} w-full overflow-hidden ring-black/5 md:static md:z-auto md:block md:h-auto md:rounded-3xl md:ring-1 lg:sticky lg:top-4 lg:w-80 lg:self-start`}>
        <Chat data={data} setData={setData} onClose={() => setCoachOpen(false)} />
      </aside>
      <nav className="glass fixed inset-x-0 bottom-0 z-20 flex border-t border-black/10 bg-[#f9f9fb]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Sections">
        {[...TABS, 'Coach'].map((t) => {
          const on = t === 'Coach' ? coachOpen : tab === t
          return (
            <button key={t} className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[0.6875rem] font-medium ${on ? 'text-[#007aff]' : 'text-slate-600'}`}
              aria-current={on ? 'page' : undefined} onClick={() => (t === 'Coach' ? setCoachOpen(true) : setTab(t))}>
              <Icon name={t} />{t}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
