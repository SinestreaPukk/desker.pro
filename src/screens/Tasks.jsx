import { useState, useRef } from 'react'
import { addTasks, doneStats } from '../tasks.js'
import { BLUE, btn, ghost, input, panel, Q, LEVELS } from '../ui.js'
import { quadrant, prioritise, REPEATS, Happy, todayStr, fmtDate, ratioOf } from '../shared.jsx'
import { parseQuick, inList, groupByDate } from '../lists.js'
import Row from '../components/Row.jsx'
import Syllabus from '../Syllabus.jsx'
import { DeadlineCard } from './Deadlines.jsx'
import { post } from '../api.js'

// Tasks, TickTick-style: quick add that understands "tomorrow 3pm #project", smart lists, date groups and a detail panel.
// The Eisenhower matrix and AI sorting are one switch away.
function Detail({ t, projects, deadlines, update, onDelete, onClose, bd, analyse, split, dismiss }) {
  const field = 'flex flex-col gap-1 text-sm text-slate-600'
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-white p-5 md:inset-y-0 md:left-auto md:w-[26rem] md:border-l md:border-line" role="dialog" aria-label="Task details" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!t.done} onChange={() => update(t.id, { done: !t.done })} />{t.done ? 'Done' : 'Mark done'}</label>
        <button className={`${btn} ${ghost}`} onClick={onClose}>Close</button>
      </div>
      <input className={`${input} w-full !text-lg font-medium`} aria-label="Title" value={t.title} onChange={(e) => update(t.id, { title: e.target.value })} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className={field}>Plan for<input type="date" className={input} value={t.when || ''} onChange={(e) => update(t.id, { when: e.target.value || undefined, start: e.target.value ? t.start : undefined })} /></label>
        <label className={field}>Start time<input type="time" className={input} value={t.start || ''} onChange={(e) => update(t.id, { start: e.target.value || undefined, when: t.when || (e.target.value ? t.due || todayStr() : undefined) })} /></label>
        <label className={field}>Due date<input type="date" className={input} value={t.due || ''} onChange={(e) => update(t.id, { due: e.target.value || undefined })} /></label>
        <label className={field}>Hours<input type="number" min="0" step="0.5" className={input} placeholder="Not sure" value={t.hours ?? ''} onChange={(e) => update(t.id, { hours: e.target.value === '' ? undefined : +e.target.value })} /></label>
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
            {deadlines.map((d) => <option key={d.id} value={d.id}>{d.title} · {fmtDate(d.date)}</option>)}
          </select>
        </label>
        <label className={field}>Repeat
          <select className={input} value={t.repeat || ''} onChange={(e) => update(t.id, { repeat: e.target.value || undefined })}>
            {REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4"><Happy value={t.happy} onChange={(happy) => update(t.id, { happy })} /></div>
      <div className="mt-4 rounded-2xl bg-panel p-3 text-sm">
        <p className="font-medium">Big job?</p>
        <p className="text-slate-600">The AI works out if it is one task or several. If several, you choose whether to split the work.</p>
        {!bd?.out && <button className={`${btn} mt-2 ${ghost}`} disabled={bd?.busy} onClick={() => analyse(t)}>{bd?.busy ? 'Thinking…' : 'Check with AI'}</button>}
        {bd?.error && <p className="mt-2 text-danger">{bd.error}</p>}
        {bd?.note && <p className="mt-2 text-slate-700">{bd.note}</p>}
        {bd?.out && (
          <div className="mt-2">
            <p>{bd.out.summary} This needs {bd.out.options.length} tasks. Split the work?</p>
            <ul className="mt-2 space-y-1">{bd.out.options.map((o, i) => <li key={i} className="rounded-xl bg-white px-3 py-2"><b className="font-medium">{o.title}</b> <span className="text-slate-600">{o.hours}h · by {fmtDate(o.due)}</span></li>)}</ul>
            <div className="mt-2 flex gap-2">
              <button className={`${btn} ${BLUE}`} onClick={() => split(t, bd.out)}>Yes, split</button>
              <button className={`${btn} ${ghost}`} onClick={() => dismiss(t, bd.out)}>No, keep as one</button>
            </div>
          </div>
        )}
      </div>
      <button className={`${btn} mt-6 text-danger hover:bg-slate-100`} onClick={onDelete}>Delete task</button>
    </div>
  )
}

export default function Tasks({ goals, tasks, setTasks, goTab, setFocus, deleteTask, projects = [], deadlines = [], setDeadlines }) {
  const startTask = (t) => setFocus({ taskId: t.id, title: t.title, method: 'Your choice', why: 'You started it from your task list.', minutes: t.hours ? Math.round(t.hours * 60) : undefined, at: Date.now() })
  const [text, setText] = useState('')
  const [list, setList] = useState('today')
  const [sel, setSel] = useState(null) // task id open in the detail panel
  const quickRef = useRef(null)
  const [bd, setBd] = useState(null) // AI check of the open task: { id, busy | error | note | out }
  const OK = (d, max) => /^\d{4}-\d\d-\d\d$/.test(d) && d <= max
  const [view, setView] = useState('List')
  const [over, setOver] = useState(null) // quadrant under a dragged task
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dump, setDump] = useState('')
  const [added, setAdded] = useState(0) // how many tasks the dump box just added, to offer sorting them

  const today = todayStr()
  const parsed = text.trim() ? parseQuick(text, projects) : null
  const submit = (e) => {
    e.preventDefault()
    if (!parsed) return
    // a new task lands where you are looking: in the open project, or dated today on the Today list
    const base = list.startsWith('p:') ? { projectId: Number(list.slice(2)) } : list === 'today' ? { due: today } : {}
    setTasks(addTasks(tasks, [{ ...base, ...parsed }]))
    setText('')
  }
  const update = (id, patch) => setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  // Placing a task yourself sticks: the AI skips it unless you ask to re-rank everything.
  const move = (id, qi) => update(id, qi === ''
    ? { important: undefined, urgent: undefined, goalId: undefined, reason: undefined, manual: false }
    : { important: qi < 2, urgent: qi % 2 === 0, manual: true, reason: 'You placed this here yourself.' })
  const [dl, setDl] = useState({ title: '', date: '', projectId: '' })
  const addDeadline = (e) => {
    e.preventDefault()
    if (!dl.title.trim() || !dl.date) return
    setDeadlines([...deadlines, { id: Date.now(), title: dl.title.trim(), date: dl.date, projectId: dl.projectId === '' ? undefined : +dl.projectId }])
    setDl({ title: '', date: '', projectId: '' })
  }
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
    if (!date) return setBd({ id: t.id, error: 'Set a due date first, so the plan can fit before it.' })
    setBd({ id: t.id, busy: true })
    try {
      const out = await post('/api/deadline', {
        goals: goals.map(({ id, title, level, happiness }) => ({ id, level: LEVELS[level].name, kind: happiness ? 'happiness' : 'work', title })),
        deadline: { title: t.title, date, hours: t.hours ?? null, context: '' }, asked: 2, ratio: ratioOf(tasks), // asked: 2 = no follow-up questions here
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
    setDeadlines([...deadlines, { id, title: t.title, date, hours: Number.isFinite(out.hours) ? out.hours : null, context: '', projectId: t.projectId }])
    setTasks(addTasks(tasks.filter((x) => x.id !== t.id), out.options.map((o) => ({ title: o.title, due: OK(o.due, date) ? o.due : date, hours: Number(o.hours) || undefined, deadlineId: id, projectId: t.projectId }))))
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
  const lists = [['today', 'Today'], ['week', 'Next 7 days'], ['inbox', 'Inbox'], ['all', 'All'],
    ...projects.map((p) => [`p:${p.id}`, p.title]), ['done', 'Completed']]
  const inCurrent = tasks.filter((t) => inList(t, list, today))
  const groups = list === 'done'
    ? [{ name: 'Completed', tasks: [...inCurrent].sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)) }]
    : groupByDate(inCurrent, today)
  const shownDeadlines = [...deadlines].filter((dl) => inList({ due: dl.date }, list, today)).sort((a, b) => a.date.localeCompare(b.date))
  const listView = (
    <div className="md:grid md:grid-cols-[13rem_1fr] md:items-start md:gap-6">
      <nav aria-label="Lists" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:mb-0 md:flex-col md:gap-1 md:overflow-visible md:px-0">
        {lists.map(([id, name]) => {
          const n = tasks.filter((t) => inList(t, id, today)).length
          return (
            <button key={id} aria-current={list === id ? 'page' : undefined} onClick={() => setList(id)}
              className={`${btn} flex shrink-0 items-center justify-between gap-3 !rounded-xl text-left ${list === id ? 'bg-pale font-medium text-ink' : 'text-slate-700 hover:bg-panel'}`}>
              <span className="truncate">{name}</span>{id !== 'done' && n > 0 && <span className="text-xs text-slate-500">{n}</span>}
            </button>
          )
        })}
      </nav>
      <div className="min-w-0">
        {shownDeadlines.length > 0 && (
          <details open className="mb-4">
            <summary className="cursor-pointer text-sm font-semibold">Deadlines with several tasks <span className="font-normal text-slate-500">{shownDeadlines.length}</span></summary>
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
            <summary className="cursor-pointer text-sm font-semibold">{g.name} <span className="font-normal text-slate-500">{g.tasks.length}</span></summary>
            <ul className="mt-2 space-y-2">{g.tasks.map((t) => row(t))}</ul>
          </details>
        ))}
        {!groups.length && !shownDeadlines.length && <p className="rounded-2xl bg-panel p-6 text-center text-sm text-slate-600">
          {list === 'done' ? 'Nothing completed yet.' : list === 'today' ? 'Nothing for today. Add a task above, or check Next 7 days.' : 'No tasks here. Type one above and press Add.'}
        </p>}
      </div>
    </div>
  )
  const selected = tasks.find((t) => t.id === sel)
  const canSort = !busy && open.some((t) => !t.manual)

  return (
    <>
      <form className={`${panel} mb-4`} onSubmit={submit}>
        <div className="flex gap-2">
          <input ref={quickRef} className={`${input} min-w-0 flex-1`} placeholder='Add a task, e.g. "Call dentist tomorrow 3pm #taxes"' aria-label="Add a task" value={text} onChange={(e) => setText(e.target.value)} />
          <button className={`${btn} ${BLUE}`} disabled={!parsed}>Add</button>
        </div>
        {parsed && (parsed.due || parsed.start || parsed.hours || parsed.projectId) && (
          <p className="mt-2 text-sm text-slate-600" aria-live="polite">
            {[parsed.due && fmtDate(parsed.due), parsed.start, parsed.hours && `${parsed.hours}h`, parsed.projectId && projects.find((p) => p.id === parsed.projectId)?.title].filter(Boolean).join(' · ')}
          </p>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-accent">Add a deadline</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <input className={`${input} min-w-48 flex-1`} aria-label="Deadline name" placeholder="Deadline, e.g. Statics midterm" value={dl.title} onChange={(e) => setDl({ ...dl, title: e.target.value })} />
            <input type="date" className={input} aria-label="Deadline date" value={dl.date} onChange={(e) => setDl({ ...dl, date: e.target.value })} />
            {projects.length > 0 && (
              <select className={input} aria-label="Project" value={dl.projectId} onChange={(e) => setDl({ ...dl, projectId: e.target.value })}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            )}
            <button type="button" className={`${btn} ${BLUE}`} disabled={!dl.title.trim() || !dl.date} onClick={addDeadline}>Add deadline</button>
          </div>
        </details>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-accent">Add many at once</summary>
          <div className="mt-3">
            <label className="mb-1 block text-sm text-slate-600" htmlFor="dump">What's on your mind? One task per line.</label>
            <textarea id="dump" className={`${input} w-full`} rows={4} placeholder={'Study for statics quiz\nCall the dentist\nBuy a birthday gift'} value={dump} onChange={(e) => setDump(e.target.value)} />
            <button type="button" className={`${btn} mt-2 ${BLUE}`} disabled={!lines.length} onClick={addDump}>{lines.length > 1 ? `Add ${lines.length} tasks` : 'Add task'}</button>
          </div>
        </details>
      </form>

      <Syllabus deadlines={deadlines} setDeadlines={setDeadlines} tasks={tasks} setTasks={setTasks} ratio={ratioOf(tasks)} />

      {added > 0 && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-pale p-4 text-sm">
          <span>Added {added} task{added === 1 ? '' : 's'}. Sort them into the matrix?</span>
          <button className={`${btn} ${BLUE}`} disabled={busy} onClick={() => run()}>{busy ? 'Sorting…' : 'Sort with AI'}</button>
          <button className={`${btn} hover:bg-white`} onClick={() => setAdded(0)}>Later</button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="View" className="flex gap-1 rounded-full bg-panel p-1">
          {['List', 'Matrix'].map((v) => (
            <button key={v} aria-pressed={view === v} className={`${btn} !py-1 ${view === v ? 'bg-white font-medium text-ink' : 'text-slate-600'}`} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>
        {view === 'Matrix' && <>
        <button className={`${btn} ${BLUE}`} disabled={!canSort} onClick={() => run()}>{busy ? 'Prioritising…' : 'Prioritise with AI'}</button>
        {open.some((t) => t.manual) && <button className={`${btn} ${ghost}`} disabled={busy} onClick={() => run(true)}>Re-rank everything</button>}
        {!busy && !canSort && <span className="text-sm text-slate-600">{all.length ? 'Everything is already placed.' : 'Add a task first.'}</span>}
        {!goals.length && <button className="text-sm text-accent underline" onClick={() => goTab('Goals')}>Link goals for better ranking.</button>}
        </>}
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
      {stats.week > 0 && <p className="mb-3 text-sm text-slate-600">{stats.week} task{stats.week === 1 ? '' : 's'} done this week{stats.streak > 1 ? ` · ${stats.streak}-day streak` : ''}</p>}

      {view === 'Matrix' ? (
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Q.map((q, i) => {
            const rows = open.filter((t) => t.q === i)
            return (
              <section key={q.name} className={`${q.cls} rounded-2xl p-3 ${over === i ? 'outline outline-2 outline-accent' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setOver(i) }} onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setOver(null)}
                onDrop={(e) => { e.preventDefault(); setOver(null); const id = +e.dataTransfer.getData('text/plain'); if (tasks.some((t) => t.id === id)) move(id, i) }}>
                <h2 className="flex items-center gap-2 px-1 text-sm font-semibold"><span className={`h-2.5 w-2.5 rounded-full ${q.dot}`} aria-hidden="true" />{q.name}<span className="ml-auto rounded-full bg-white px-2 text-xs font-normal">{rows.length}</span></h2>
                <p className="mt-1 px-1 text-xs text-slate-600">{q.hint}</p>
                <ul className="mt-3 space-y-2">{rows.map((t) => row(t, true))}{!rows.length && <li className="text-sm text-slate-600">Nothing here</li>}</ul>
              </section>
            )
          })}
        </div>
      ) : listView}
      {unranked.length > 0 && view === 'Matrix' && <p className="mt-4 text-sm text-slate-600">{unranked.length} task{unranked.length === 1 ? '' : 's'} waiting for AI prioritisation: {unranked.slice(0, 3).map((t) => t.title).join(', ')}{unranked.length > 3 ? '…' : ''}</p>}

      {view === 'Matrix' && doneList.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold">Done ({doneList.length})</summary>
          <ul className="mt-2 space-y-2">{doneList.map(row)}</ul>
        </details>
      )}
      {selected && <Detail t={selected} projects={projects} deadlines={deadlines} update={update} bd={bd?.id === selected.id ? bd : null} analyse={analyse} split={split} dismiss={dismiss} onClose={() => setSel(null)} onDelete={() => { deleteTask(selected); setSel(null) }} />}
      <button className={`${BLUE} fixed bottom-24 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full text-3xl shadow-lg md:hidden`} aria-label="Add a task"
        onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); quickRef.current?.focus() }}>+</button>
    </>
  )
}
