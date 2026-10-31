import { useState, useRef } from 'react'
import { addTasks, doneStats } from '../tasks.js'
import { BLUE, btn, ghost, input, panel, Q, LEVELS } from '../ui.js'
import { quadrant, prioritise, REPEATS, Happy, todayStr, fmtDate, ratioOf } from '../shared.jsx'
import { inList, groupSoon } from '../lists.js'
import AddBox from '../components/AddBox.jsx'
import Row from '../components/Row.jsx'
import Syllabus from '../Syllabus.jsx'
import { DeadlineCard } from './Deadlines.jsx'
import { post } from '../api.js'

// Tasks, TickTick-style: quick add that understands "tomorrow 3pm #project", smart lists, date groups and a detail panel.
// The Eisenhower matrix and AI sorting are one switch away.
function Detail({ t, projects, deadlines, update, onDelete, onClose, bd, analyse, split, dismiss }) {
  const field = 'flex flex-col gap-1 text-base text-slate-600'
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-white p-5 md:inset-y-0 md:left-auto md:w-[26rem] md:border-l md:border-line" role="dialog" aria-label="Task details" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-base"><input type="checkbox" checked={!!t.done} onChange={() => update(t.id, { done: !t.done })} />{t.done ? 'Done' : 'Mark done'}</label>
        <button className={`${btn} ${ghost}`} onClick={onClose}>Close</button>
      </div>
      <input className={`${input} w-full !text-base font-medium`} aria-label="Title" value={t.title} onChange={(e) => update(t.id, { title: e.target.value })} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className={field}>Due date<input type="date" className={input} value={t.due || ''} onChange={(e) => update(t.id, { due: e.target.value || undefined })} /></label>
        <label className={field}>Repeat
          <select className={input} value={t.repeat || ''} onChange={(e) => update(t.id, { repeat: e.target.value || undefined })}>
            {REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <div className={`${field} col-span-2`}>Hours I need
          <div className="flex gap-2">
            <input type="number" min="0" step="0.5" className={`${input} w-28`} aria-label="Hours I need" placeholder="Not sure" value={t.hours ?? ''} onChange={(e) => update(t.id, { hours: e.target.value === '' ? undefined : +e.target.value })} />
            <button type="button" className={`${btn} ${ghost}`} disabled={bd?.busy} onClick={() => analyse(t)}>{bd?.busy ? 'Thinking…' : 'Estimate'}</button>
          </div>
        </div>
      </div>
      {bd?.error && <p className="mt-2 text-base text-danger">{bd.error}</p>}
      {bd?.note && <p className="mt-2 text-base text-slate-700">{bd.note}</p>}
      {bd?.out && (
        <div className="mt-2 bg-panel p-3 text-base">
          <p>{bd.out.summary} This needs {bd.out.options.length} tasks. Split the work?</p>
          <ul className="mt-2 space-y-1">{bd.out.options.map((o, i) => <li key={i} className=" bg-white px-3 py-2"><b className="font-medium">{o.title}</b> <span className="text-slate-600">{o.hours}h{o.due ? `, by ${fmtDate(o.due)}` : ''}</span></li>)}</ul>
          <div className="mt-2 flex gap-2">
            <button className={`${btn} ${BLUE}`} onClick={() => split(t, bd.out)}>Yes, split</button>
            <button className={`${btn} ${ghost}`} onClick={() => dismiss(t, bd.out)}>No, keep as one</button>
          </div>
        </div>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-base text-accent">More options</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={field}>Starts (for ongoing work)<input type="date" className={input} max={t.due || undefined} value={t.from || ''} onChange={(e) => update(t.id, { from: e.target.value || undefined })} /></label>
          <label className={field}>Do it on<input type="date" className={input} value={t.when || ''} onChange={(e) => update(t.id, { when: e.target.value || undefined, start: e.target.value ? t.start : undefined })} /></label>
          <label className={field}>Start time<input type="time" className={input} value={t.start || ''} onChange={(e) => update(t.id, { start: e.target.value || undefined, when: t.when || (e.target.value ? t.due || todayStr() : undefined) })} /></label>
          <label className={field}>Project
            <select className={input} value={t.projectId ?? ''} onChange={(e) => update(t.id, { projectId: e.target.value === '' ? undefined : +e.target.value })}>
              <option value="">None (Inbox)</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <label className={field}>Deadline
            <select className={input} value={t.deadlineId ?? ''} onChange={(e) => {
              const dl = deadlines.find((d) => d.id === +e.target.value)
              update(t.id, dl ? { deadlineId: dl.id, due: t.due || dl.date, projectId: dl.projectId ?? t.projectId } : { deadlineId: undefined })
            }}>
              <option value="">None</option>
              {deadlines.map((d) => <option key={d.id} value={d.id}>{d.title}, {fmtDate(d.date)}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4"><Happy value={t.happy} onChange={(happy) => update(t.id, { happy })} /></div>
      </details>
      <button className={`${btn} mt-6 text-danger hover:bg-white`} onClick={onDelete}>Delete task</button>
      <button className={`${btn} ${ghost} sticky bottom-0 mt-4 w-full md:hidden`} onClick={onClose}>Close</button>
    </div>
  )
}

export default function Tasks({ goals, tasks, setTasks, goTab, setFocus, deleteTask, projects = [], deadlines = [], setDeadlines }) {
  const startTask = (t) => setFocus({ taskId: t.id, title: t.title, method: 'Your choice', why: 'You started it from your task list.', minutes: t.hours ? Math.round(t.hours * 60) : undefined, at: Date.now() })
  const [list, setList] = useState('plan')
  const [sel, setSel] = useState(null) // task id open in the detail panel
  const quickRef = useRef(null)
  const [bd, setBd] = useState(null) // AI check of the open task: { id, busy | error | note | out }
  const OK = (d, max) => /^\d{4}-\d\d-\d\d$/.test(d) && (!max || d <= max)
  const [view, setView] = useState('List')
  const [over, setOver] = useState(null) // quadrant under a dragged task
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dump, setDump] = useState('')
  const [added, setAdded] = useState(0) // how many tasks the dump box just added, to offer sorting them

  const today = todayStr()
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
  const unranked = open.filter((t) => t.q === undefined)
  const analyse = async (t) => {
    const date = t.due || t.when
    setBd({ id: t.id, busy: true })
    try {
      const out = await post('/api/deadline', {
        goals: goals.map(({ id, title, level, happiness }) => ({ id, level: LEVELS[level].name, kind: happiness ? 'happiness' : 'work', title })),
        deadline: { title: t.title, date: date || null, hours: t.hours ?? null, context: '' }, asked: 2, ratio: ratioOf(tasks), // asked: 2 = no follow-up questions here
      })
      if (!Array.isArray(out.options) || !out.options.length) throw new Error('Unexpected answer from AI')
      if (out.options.length === 1) {
        const h = Number(out.options[0].hours) || out.hours
        if (h) update(t.id, { hours: h })
        setBd({ id: t.id, note: `One task is enough${h ? ` (about ${h}h)` : ''}. It stays a single task.` })
      } else setBd({ id: t.id, out })
    } catch (err) { setBd({ id: t.id, error: err.message }) }
  }
  // Splitting turns the task into a deadline that owns the new tasks.
  const split = (t, out) => {
    const date = t.due || t.when, id = Date.now()
    if (date) setDeadlines([...deadlines, { id, title: t.title, date, hours: Number.isFinite(out.hours) ? out.hours : null, context: '', projectId: t.projectId }])
    setTasks(addTasks(tasks.filter((x) => x.id !== t.id), out.options.map((o) => ({ title: o.title, ...(OK(o.due, date) ? { due: o.due } : date ? { due: date } : {}), hours: Number(o.hours) || undefined, ...(date && { deadlineId: id }), projectId: t.projectId }))))
    setSel(null); setBd(null)
  }
  const dismiss = (t, out) => {
    if (Number.isFinite(out.hours)) update(t.id, { hours: out.hours })
    setBd({ id: t.id, note: 'Kept as one task.' })
  }
  const deadlineOf = (t) => deadlines.find((d) => d.id === t.deadlineId)
  const projectName = (t) => projects.find((p) => p.id === t.projectId)?.title
  const row = (t, cover) => (
    <Row key={t.id} t={t} cover={cover} project={projectName(t) || (deadlineOf(t) && `For ${deadlineOf(t).title}`)} update={update} move={move} onStart={startTask} onEdit={() => setSel(t.id)} onDelete={() => deleteTask(t)} />
  )
  const lists = [['plan', 'Tasks'], ['inbox', 'Inbox'],
    ...projects.map((p) => [`p:${p.id}`, p.title]), ['done', 'Completed']]
  const shownDeadlines = [...deadlines].filter((dl) => (list === 'done' ? dl.done : !dl.done && inList({ due: dl.date }, list, today))).sort((a, b) => a.date.localeCompare(b.date))
  const inDeadline = new Set(list === 'plan' ? shownDeadlines.map((d) => d.id) : []) // those tasks are listed inside their deadline, not twice
  const inCurrent = tasks.filter((t) => inList(t, list, today) && !inDeadline.has(t.deadlineId))
  const groups = list === 'done'
    ? [{ name: 'Completed', tasks: [...inCurrent].sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)) }]
    : groupSoon(inCurrent, today)
  const listView = (
    <div className="md:grid md:grid-cols-[13rem_1fr] md:items-start md:gap-6">
      <nav aria-label="Lists" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:mb-0 md:flex-col md:gap-1 md:overflow-visible md:px-0">
        {lists.map(([id, name]) => {
          const n = tasks.filter((t) => inList(t, id, today)).length
          return (
            <button key={id} aria-current={list === id ? 'page' : undefined} onClick={() => setList(id)}
              className={`${btn} flex shrink-0 items-center justify-between gap-3 ! text-left ${list === id ? 'bg-pale font-medium text-ink' : 'text-slate-700 hover:bg-panel'}`}>
              <span className="truncate">{name}</span>{id !== 'done' && n > 0 && <span className="text-xs text-slate-500">{n}</span>}
            </button>
          )
        })}
      </nav>
      <div className="min-w-0">
        {shownDeadlines.length > 0 && (
          <details open className="mb-4">
            <summary className="cursor-pointer text-base font-semibold">Deadlines <span className="font-normal text-slate-500">{shownDeadlines.length}</span></summary>
            <ul className="mt-2 space-y-3">
              {shownDeadlines.map((dl) => (
                <DeadlineCard key={dl.id} dl={dl} goals={goals} projects={projects} tasks={tasks} setTasks={setTasks} ratio={ratioOf(tasks)}
                  patch={(p) => setDeadlines(deadlines.map((x) => (x.id === dl.id ? { ...x, ...p } : x)))}
                  remove={() => setDeadlines(deadlines.filter((x) => x.id !== dl.id))} />
              ))}
            </ul>
          </details>
        )}
        {groups.map((g) => (
          <details key={g.name} open className="mb-4">
            <summary className="cursor-pointer text-base font-semibold">{g.name} <span className="font-normal text-slate-500">{g.tasks.length}</span></summary>
            <ul className="mt-2 space-y-2">{g.tasks.map((t) => row(t))}</ul>
          </details>
        ))}
        {!groups.length && !shownDeadlines.length && <p className=" bg-panel p-6 text-center text-base text-slate-600">
          {list === 'done' ? 'Nothing completed yet.' : list === 'plan' ? 'Nothing planned. Add a task above; tasks without a date wait in Inbox.' : list === 'inbox' ? 'Inbox is empty. Tasks without a date or project land here.' : 'No tasks here. Type one above and press Add.'}
        </p>}
      </div>
    </div>
  )
  const selected = tasks.find((t) => t.id === sel)
  const canSort = !busy && open.some((t) => !t.manual)

  return (
    <>
      <AddBox inputRef={quickRef} tasks={tasks} setTasks={setTasks} deadlines={deadlines} setDeadlines={setDeadlines} projects={projects} goals={goals} ratio={ratioOf(tasks)} list={list} setList={setList}>
        <details className="mt-3">
          <summary className="cursor-pointer text-base text-accent">Add many at once</summary>
          <div className="mt-3">
            <label className="mb-1 block text-base text-slate-600" htmlFor="dump">What's on your mind? One task per line.</label>
            <textarea id="dump" className={`${input} w-full`} rows={4} placeholder={'Study for statics quiz\nCall the dentist\nBuy a birthday gift'} value={dump} onChange={(e) => setDump(e.target.value)} />
            <button type="button" className={`${btn} mt-2 ${BLUE}`} disabled={!lines.length} onClick={addDump}>{lines.length > 1 ? `Add ${lines.length} tasks` : 'Add task'}</button>
          </div>
        </details>
      </AddBox>

      <Syllabus deadlines={deadlines} setDeadlines={setDeadlines} tasks={tasks} setTasks={setTasks} ratio={ratioOf(tasks)} />

      {added > 0 && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 bg-pale p-4 text-base">
          <span>Added {added} task{added === 1 ? '' : 's'}. Sort them into the matrix?</span>
          <button className={`${btn} ${BLUE}`} disabled={busy} onClick={() => run()}>{busy ? 'Sorting…' : 'Sort with AI'}</button>
          <button className={`${btn} hover:bg-white`} onClick={() => setAdded(0)}>Later</button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="View" className="flex gap-1 bg-panel p-1">
          {['List', 'Matrix'].map((v) => (
            <button key={v} aria-pressed={view === v} className={`${btn} !py-1 ${view === v ? 'bg-white font-medium text-ink' : 'text-slate-600'}`} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>
        {view === 'Matrix' && <>
        <button className={`${btn} ${BLUE}`} disabled={!canSort} onClick={() => run()}>{busy ? 'Prioritising…' : 'Prioritise with AI'}</button>
        {open.some((t) => t.manual) && <button className={`${btn} ${ghost}`} disabled={busy} onClick={() => run(true)}>Re-rank everything</button>}
        {!busy && !canSort && <span className="text-base text-slate-600">{all.length ? 'Everything is already placed.' : 'Add a task first.'}</span>}
        {!goals.length && <button className="text-base text-accent underline" onClick={() => goTab('Goals')}>Link goals for better ranking.</button>}
        </>}
        {error && <span className="text-base text-danger">{error}</span>}
      </div>
      {stats.week > 0 && <p className="mb-3 text-base text-slate-600">{stats.week} task{stats.week === 1 ? '' : 's'} done this week{stats.streak > 1 ? `, ${stats.streak}-day streak` : ''}</p>}

      {view === 'Matrix' ? (
        <div className="grid items-start gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {Q.map((q, i) => {
            const rows = open.filter((t) => t.q === i)
            return (
              <section key={q.name} className={`px-panel p-3 ${over === i ? 'outline outline-2 outline-accent' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setOver(i) }} onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setOver(null)}
                onDrop={(e) => { e.preventDefault(); setOver(null); const id = +e.dataTransfer.getData('text/plain'); if (tasks.some((t) => t.id === id)) move(id, i) }}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-2 text-base font-semibold"><span className={`${q.tab} px-tab`}>{q.name}</span><span className="bg-yuki-1 px-2 text-xs font-normal text-ink">{rows.length}</span></h2>
                    <p className="mt-2 px-1 text-xs text-slate-700">{q.hint}</p>
                  </div>
                  <img src={['/pixel/i-flag.png', '/pixel/i-calendar.png', '/pixel/i-clock.png', '/pixel/spot-later.png'][i]} alt="" width="32" height="32" className="px-art shrink-0" style={{ width: 'calc(16 * var(--px))', height: 'calc(16 * var(--px))' }} />
                </div>
                <ul className="mt-3 space-y-2">{rows.map((t) => row(t, true))}{!rows.length && <li className="text-base text-slate-700">Nothing here</li>}</ul>
              </section>
            )
          })}
        </div>
      ) : listView}
      {unranked.length > 0 && view === 'Matrix' && <p className="mt-4 text-base text-slate-600">{unranked.length} task{unranked.length === 1 ? '' : 's'} waiting for AI prioritisation: {unranked.slice(0, 3).map((t) => t.title).join(', ')}{unranked.length > 3 ? '…' : ''}</p>}

      {view === 'Matrix' && doneList.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-base font-semibold">Done ({doneList.length})</summary>
          <ul className="mt-2 space-y-2">{doneList.map(row)}</ul>
        </details>
      )}
      {selected && <Detail t={selected} projects={projects} deadlines={deadlines} update={update} bd={bd?.id === selected.id ? bd : null} analyse={analyse} split={split} dismiss={dismiss} onClose={() => setSel(null)} onDelete={() => { deleteTask(selected); setSel(null) }} />}
      <button className={`${BLUE} fixed bottom-24 right-4 z-20 flex h-14 w-14 items-center justify-center text-2xl md:hidden`} aria-label="Add a task"
        onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); quickRef.current?.focus() }}>+</button>
    </>
  )
}
