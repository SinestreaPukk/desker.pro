import { useState } from 'react'
import { addTasks, doneStats } from '../tasks.js'
import { BLUE, btn, ghost, input, panel, Q } from '../ui.js'
import { quadrant, prioritise, REPEATS, Happy } from '../shared.jsx'
import Row from '../components/Row.jsx'

// The Eisenhower matrix. One add field, a Matrix/List switch, and AI sorting.
export default function Tasks({ goals, tasks, setTasks, goTab, setFocus, deleteTask }) {
  const startTask = (t) => setFocus({ taskId: t.id, title: t.title, method: 'Your choice', why: 'You started it from your task list.', minutes: t.hours ? Math.round(t.hours * 60) : undefined, at: Date.now() })
  const blank = { title: '', due: '', happy: 50, hours: '', repeat: '' }
  const [d, setD] = useState(blank)
  const [view, setView] = useState('Matrix')
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
  const unranked = open.filter((t) => t.q === undefined)
  const row = (t, cover) => (
    <Row key={t.id} t={t} cover={cover} update={update} move={move} onStart={startTask} onEdit={() => setD({ ...t, repeat: t.repeat || '' })} onDelete={() => deleteTask(t)} />
  )
  const canSort = !busy && open.some((t) => !t.manual)

  return (
    <>
      <form className={`${panel} mb-4`} onSubmit={submit}>
        <div className="flex gap-2">
          <input className={`${input} min-w-0 flex-1`} placeholder="Add a task" aria-label="Task" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          <button className={`${btn} ${BLUE}`}>{d.id ? 'Save' : 'Add'}</button>
          {d.id && <button type="button" className={`${btn} ${ghost}`} onClick={() => setD(blank)}>Cancel</button>}
        </div>
        <details className="mt-3" open={!!d.id || undefined}>
          <summary className="cursor-pointer text-sm text-accent">Date, hours, repeat, how you feel</summary>
          <div className="mt-3 flex flex-wrap items-center gap-3">
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
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-accent">Add many at once</summary>
          <div className="mt-3">
            <label className="mb-1 block text-sm text-slate-600" htmlFor="dump">What's on your mind? One task per line.</label>
            <textarea id="dump" className={`${input} w-full`} rows={4} placeholder={'Study for statics quiz\nCall the dentist\nBuy a birthday gift'} value={dump} onChange={(e) => setDump(e.target.value)} />
            <button type="button" className={`${btn} mt-2 ${BLUE}`} disabled={!lines.length} onClick={addDump}>{lines.length > 1 ? `Add ${lines.length} tasks` : 'Add task'}</button>
          </div>
        </details>
      </form>

      {added > 0 && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-pale p-4 text-sm">
          <span>Added {added} task{added === 1 ? '' : 's'}. Sort them into the matrix?</span>
          <button className={`${btn} ${BLUE}`} disabled={busy} onClick={() => run()}>{busy ? 'Sorting…' : 'Sort with AI'}</button>
          <button className={`${btn} hover:bg-white`} onClick={() => setAdded(0)}>Later</button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="View" className="flex gap-1 rounded-full bg-panel p-1">
          {['Matrix', 'List'].map((v) => (
            <button key={v} aria-pressed={view === v} className={`${btn} !py-1 ${view === v ? 'bg-white font-medium text-ink' : 'text-slate-600'}`} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>
        <button className={`${btn} ${BLUE}`} disabled={!canSort} onClick={() => run()}>{busy ? 'Prioritising…' : 'Prioritise with AI'}</button>
        {open.some((t) => t.manual) && <button className={`${btn} ${ghost}`} disabled={busy} onClick={() => run(true)}>Re-rank everything</button>}
        {!busy && !canSort && <span className="text-sm text-slate-600">{all.length ? 'Everything is already placed.' : 'Add a task first.'}</span>}
        {!goals.length && <button className="text-sm text-accent underline" onClick={() => goTab('Goals')}>Link goals for better ranking.</button>}
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
      ) : (
        <ol className="space-y-2">
          {sorted.map((t) => (
            <li key={t.id}>
              <p className="mb-1 flex items-center gap-2 text-xs text-slate-600">{t.q !== undefined && <span className={`h-2 w-2 rounded-full ${Q[t.q].dot}`} aria-hidden="true" />}{t.q === undefined ? 'Not prioritised yet' : Q[t.q].name}</p>
              <ul>{row(t)}</ul>
            </li>
          ))}
          {!sorted.length && <li className="text-sm text-slate-600">No tasks yet.</li>}
        </ol>
      )}
      {unranked.length > 0 && view === 'Matrix' && <p className="mt-4 text-sm text-slate-600">{unranked.length} task{unranked.length === 1 ? '' : 's'} waiting for AI prioritisation: {unranked.slice(0, 3).map((t) => t.title).join(', ')}{unranked.length > 3 ? '…' : ''}</p>}

      {doneList.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold">Done ({doneList.length})</summary>
          <ul className="mt-2 space-y-2">{doneList.map(row)}</ul>
        </details>
      )}
    </>
  )
}
