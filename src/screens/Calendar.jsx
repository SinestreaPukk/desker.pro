import { useState, useEffect, useRef } from 'react'
import { post, uid } from '../api.js'
import { BLUE, btn, input, ghost, panel, Q } from '../ui.js'
import TimeGrid from '../TimeGrid.jsx'
import { addTasks } from '../tasks.js'
import { fmtDuration } from '../format.js'
import { quadrant, dateKey, color, evDay, hhmm, hm24, minutes, importCalendar, Happy, REPEATS, todayStr, busyForAI } from '../shared.jsx'
import { Button, PrivateWarning } from '../components/ui.jsx'

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
  const link = `${btn} inline-flex items-center ${ghost}`
  return (
    <details className="mb-4 rounded-2xl bg-panel p-4">
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
          {/* TODO(roadmap: read-only calendar link): a separate link that cannot open the workspace */}
          <PrivateWarning>This link contains your sync code, so anyone who has it can see your tasks and open your workspace.</PrivateWarning>
          <p className="mt-2 text-xs text-slate-600">Google refreshes subscribed calendars about once a day.</p>
        </section>
        <section>
          <h3 className="mb-1 text-sm font-semibold">Bring your calendar into Desker</h3>
          <p className="mb-2 text-sm text-slate-600">The AI agent plans around your meetings and classes. Paste your calendar's private iCal link (in Google: Settings, your calendar, Integrate calendar, "Secret address in iCal format"), or upload an .ics file.</p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) run({ url: url.trim() }) }}>
            <input className={`${input} min-w-0 flex-1`} aria-label="Calendar link" placeholder="https://… or webcal://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button variant="primary" disabled={loading || !url.trim()}>{loading ? 'Reading…' : 'Import'}</Button>
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

const Key = () => (
  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700" aria-label="Colour key">
    {[['bg-[#eef3fd]', 'Task (tint shows its box)'], ['bg-pale', 'For fun'], ['bg-[#f6d5cf]', 'Deadline'], ['bg-stone/20', 'Calendar event']].map(([c, l]) => (
      <li key={l} className="flex items-center gap-2"><span className={`h-3 w-3 rounded-sm border border-control ${c}`} aria-hidden="true" />{l}</li>
    ))}
  </ul>
)

const HM = /^(\d\d):(\d\d)$/
const VIEWS = ['month', 'week', 'day']

export default function Calendar({ goals, tasks, setTasks, freeHours, freeToday, deadlines, setDeadlines, data, setData, onStart, onReplan }) {
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
        <Button aria-label={`Previous ${view}`} variant="secondary" onClick={() => shift(-1)}>←</Button>
        <h2 className="text-center font-semibold">{title}</h2>
        <Button aria-label={`Next ${view}`} variant="secondary" onClick={() => shift(1)}>→</Button>
      </div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full border border-line bg-white p-1" role="group" aria-label="Calendar view">
          {VIEWS.map((v) => (
            <button key={v} className={`${btn} !px-3 !py-1 capitalize !transition-none ${view === v ? 'bg-pale font-medium text-ink' : 'text-slate-600'}`} aria-pressed={view === v} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>
        <span className="flex gap-2">
          <Button variant="secondary" onClick={onReplan}>Replan my week</Button>
          <Button variant="secondary" onClick={() => setAnchor(new Date())}>Today</Button>
        </span>
      </div>
      {view !== 'month' && (
        <>
          <TimeGrid cols={days.map(column)} onHead={(k) => { setAnchor(new Date(`${k}T12:00:00`)); setView('day') }} />
          <p className="mt-2 text-xs text-slate-500">Tasks with a start time (set it in the task's details) appear as blocks. Others sit in the Anytime row.</p>
          <Key />
          {view === 'day' && <button className={`${btn} mt-2 ${ghost}`} onClick={() => setAdding(anchor.toLocaleDateString('sv'))}>Add task on this day</button>}
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
                  <button className="chip -m-1 rounded px-1 py-0.5 hover:bg-slate-100" aria-label={`Add task due ${key(d)}`} onClick={() => setAdding(key(d))}>{d}</button>
                  {hrs > 0 && <span className={limit && hrs > limit ? 'font-medium text-danger' : ''}>{fmtDuration(hrs)}</span>}
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
      <p className="mt-2 text-xs text-slate-500">Tasks show on their planned date, or their due date if not planned. Click a task for details, or a date to add a task due then.</p>
      <Key />
        </>
      )}
      {adding && (
        <form className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-panel p-4" aria-label="Add task"
          onSubmit={(e) => {
            e.preventDefault()
            if (!dl.title.trim()) return
            setTasks(addTasks(tasks, [{ title: dl.title, due: adding, hours: dl.hours === '' ? undefined : +dl.hours }]))
            setDl({ title: '', hours: '' }); setAdding(null)
          }}>
          <h2 className="w-full font-semibold">Add a task due {adding}</h2>
          <input className={`${input} min-w-48 flex-1`} autoFocus aria-label="Task title" placeholder="e.g. Statics quiz" value={dl.title} onChange={(e) => setDl({ ...dl, title: e.target.value })} />
          <input type="number" min="0" step="0.5" aria-label="Hours needed" className={`${input} w-36`} placeholder="Hours (opt.)" value={dl.hours} onChange={(e) => setDl({ ...dl, hours: e.target.value })} />
          <Button variant="primary">Add task</Button>
          <Button type="button" variant="secondary" onClick={() => setAdding(null)}>Cancel</Button>
          <p className="w-full text-xs text-slate-600">Open it in Tasks to split big work into smaller tasks with AI.</p>
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
