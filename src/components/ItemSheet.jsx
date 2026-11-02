import { useState } from 'react'
import { BLUE, btn, ghost, input, chip, Q } from '../ui.js'
import { REPEATS, fmtDate } from '../shared.jsx'
import { quickDate } from '../lists.js'
import { rankedGoals } from '../goals.js'
import { pace, restingProjects, sessionTitle } from '../sessions.js'
import { addHour, canBeMeeting, movedEnd, projectAsMeeting, taskTime } from '../events.js'
import Sheet, { Field } from './Sheet.jsx'
import { ProgressChips } from './Progress.jsx'
import { KindSwitch, TypeSwitch } from './MeetingSheet.jsx'

const TitleInput = ({ value, label, onSave }) => (
  <input key={value} className={`${input} w-full text-lg font-medium`} aria-label={label} defaultValue={value}
    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== value) onSave(v); else e.target.value = value }}
    onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
)

function DateChips({ value, onPick, noDate = 'No date' }) {
  return (
    <>
      {[['Today', 'today'], ['Tomorrow', 'tomorrow'], ['This week', 'thisWeek'], ['Next week', 'nextWeek']].map(([name, k]) => {
        const d = quickDate(k)
        return <button key={k} type="button" className={chip(value === d)} aria-pressed={value === d} onClick={() => onPick(d)}>{name}</button>
      })}
      <input type="date" aria-label="Pick a date" className={`${chip(false)} !py-1`} value={value || ''} onChange={(e) => onPick(e.target.value || undefined)} />
      {value && <button type="button" className={chip(false)} onClick={() => onPick(undefined)}>{noDate}</button>}
    </>
  )
}

function Matrix({ box, noted, onMove, onClear }) {
  return (
    <Field label="Place it yourself">
      {Q.map((q, i) => <button key={q.name} type="button" className={chip(noted && box === i)} aria-pressed={noted && box === i} onClick={() => onMove(i)}>{q.name}</button>)}
      {noted && <button type="button" className={`${btn} ${ghost} min-h-11`} onClick={onClear}>Let the app decide</button>}
    </Field>
  )
}

function TaskSheet({ t, row, goals, projects, patch, onStart, onDone, onDelete, onMove, onClear, onMakeMeeting, onClose }) {
  const ranked = rankedGoals(goals)
  const live = projects.filter((p) => (p.progress ?? 0) < 5 || p.id === t.projectId)
  const setDue = (due) => patch(t.id, { due, ...(t.when === t.due && t.start ? { when: due } : {}) })
  return (
    <Sheet label={t.title} onClose={onClose}>
      {canBeMeeting(t) && !t.done && (
        <div className="flex flex-wrap gap-2">
          <TypeSwitch type="Task" onPick={(k) => k === 'Project' && onMakeMeeting(t, 'Project', 'Reminder')} />
          <KindSwitch kind="Reminder" onPick={(k) => k === 'Meeting' && onMakeMeeting(t, 'Task', 'Meeting')} />
        </div>
      )}
      <TitleInput value={t.title} label="Task title" onSave={(title) => patch(t.id, { title })} />
      {!t.done && row && <p className="text-sm text-slate-700">{row.why}</p>}
      <div className="flex gap-2">
        {t.done
          ? <button className={`${btn} ${BLUE}`} onClick={() => patch(t.id, { done: false })}>Reopen</button>
          : <>
            <button className={`${btn} ${BLUE}`} onClick={() => { onStart(t); onClose() }}>Start</button>
            <button className={`${btn} ${ghost}`} onClick={() => { onDone(t); onClose() }}>Done</button>
          </>}
      </div>
      <Field label="What's this for?">
        {live.map((p) => <button key={`p${p.id}`} type="button" className={chip(t.projectId === p.id)} aria-pressed={t.projectId === p.id} onClick={() => patch(t.id, { projectId: p.id, goalId: undefined })}>{p.title}</button>)}
        {ranked.map((g, i) => <button key={g.id} type="button" className={chip(!t.projectId && t.goalId === g.id)} aria-pressed={!t.projectId && t.goalId === g.id} onClick={() => patch(t.id, { goalId: g.id, projectId: undefined })}>{i + 1} {g.title}</button>)}
        <button type="button" className={chip(!t.projectId && !t.goalId)} onClick={() => patch(t.id, { goalId: undefined, projectId: undefined })}>Nothing</button>
      </Field>
      <Field label="When?"><DateChips value={t.due} onPick={setDue} /></Field>
      {t.due && (
        <label className="flex items-center gap-3 text-sm font-medium">Time
          <input type="time" className={input} value={t.time || (t.when === t.due && t.start) || ''} onChange={(e) => patch(t.id, taskTime(t.due, e.target.value))} />
          {(t.time || (t.when === t.due && t.start)) && <button type="button" className={`${btn} font-normal text-accent hover:bg-pale`} onClick={() => patch(t.id, taskTime(t.due, ''))}>All day</button>}
        </label>
      )}
      <label className="flex items-center gap-3 text-sm font-medium">Repeat
        <select className={input} value={t.repeat || ''} onChange={(e) => patch(t.id, { repeat: e.target.value || undefined })}>
          {REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      {!t.done && row && <Matrix box={row.box} noted={t.important !== undefined || t.urgent !== undefined} onMove={(i) => onMove(t.id, i)} onClear={() => onClear(t.id)} />}
      <button className={`${btn} text-danger hover:bg-slate-100`} onClick={() => { onDelete(t); onClose() }}>Delete</button>
    </Sheet>
  )
}

function ProjectSheet({ p, row, goals, tasks, patch, setProgress, onAddTask, onDoneTask, onOpenTask, onMove, onClearProject, onDelete, onAnother, onClose }) {
  const ranked = rankedGoals(goals)
  const [title, setTitle] = useState('')
  const mine = tasks.filter((t) => t.projectId === p.id && !t.session && !t.fun)
  const open = mine.filter((t) => !t.done)
  const label = pace(p)?.label
  const addTask = (e) => {
    e.preventDefault()
    if (title.trim()) onAddTask(p.id, title.trim())
    setTitle('')
  }
  return (
    <Sheet label={p.title} onClose={onClose}>
      {p.date && <KindSwitch kind={p.end ? 'Meeting' : 'Reminder'} onPick={(k) => { if (k === 'Reminder') patch(p.id, { end: undefined }); else if (!p.end) patch(p.id, projectAsMeeting(p)) }} />}
      <TitleInput value={p.title} label="Project title" onSave={(v) => patch(p.id, { title: v, sessionTitle: undefined })} />
      {row && <p className="text-sm text-slate-700">{row.why}</p>}
      {label && <p className="text-sm font-medium text-accent-dark">{label}</p>}
      {restingProjects(tasks, [p]).length > 0 && <button className={`${btn} ${BLUE} self-start`} onClick={() => onAnother(p)}>Another session</button>}
      <Field label="Progress"><ProgressChips value={p.progress ?? 0} onPick={(n) => setProgress(p.id, n)} /></Field>
      <p className="-mt-3 text-xs text-slate-600">0 = not started, 5 = finished</p>
      <Field label="Works towards?">
        {ranked.map((g, i) => <button key={g.id} type="button" className={chip(p.goalId === g.id)} aria-pressed={p.goalId === g.id} onClick={() => patch(p.id, { goalId: g.id })}>{i + 1} {g.title}</button>)}
        <button type="button" className={chip(!ranked.some((g) => g.id === p.goalId))} onClick={() => patch(p.id, { goalId: undefined })}>Not in my goals</button>
      </Field>
      <Field label={p.date ? `Due ${fmtDate(p.date)}` : 'Due?'}><DateChips value={p.date} onPick={(date) => patch(p.id, { date })} /></Field>
      {p.date && p.end && (
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">Starts
            <input type="time" className={input} value={p.time || ''} onChange={(e) => e.target.value && patch(p.id, { time: e.target.value, end: movedEnd(p.time, p.end, e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">Ends
            <input type="time" className={input} value={p.end} onChange={(e) => e.target.value && patch(p.id, { end: e.target.value })} onBlur={() => p.end <= p.time && patch(p.id, { end: addHour(p.time) })} />
          </label>
        </div>
      )}
      {p.date && !p.end && (
        <label className="flex items-center gap-3 text-sm font-medium">Time
          <input type="time" className={input} value={p.time || ''} onChange={(e) => patch(p.id, { time: e.target.value || undefined })} />
          {p.time && <button type="button" className={`${btn} font-normal text-accent hover:bg-pale`} onClick={() => patch(p.id, { time: undefined })}>All day</button>}
        </label>
      )}
      <section aria-label="Its tasks">
        <p className="mb-2 text-sm font-medium">Its tasks</p>
        {!open.length && (p.progress ?? 0) < 5 && <p className="mb-2 text-sm text-slate-600">None, so you'll see "{sessionTitle(p)}" on Now.</p>}
        <ul className="mb-2 space-y-1">
          {open.map((t) => (
            <li key={t.id} className="flex items-center gap-1">
              <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"><input type="checkbox" className="tick" checked={false} onChange={() => onDoneTask(t)} aria-label={`Mark ${t.title} done`} /></label>
              <button className="min-h-11 min-w-0 flex-1 break-words text-left text-sm" onClick={() => onOpenTask(t)}>{t.title}</button>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={addTask}>
          <input className={`${input} min-w-0 flex-1`} aria-label="New task in this project" placeholder="Add a task" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className={`${btn} ${ghost}`} disabled={!title.trim()}>Add</button>
        </form>
      </section>
      {row && <Matrix box={row.box} noted={p.important !== undefined || p.urgent !== undefined} onMove={(i) => onMove(row.task.id, i)} onClear={() => onClearProject(p.id)} />}
      <button className={`${btn} text-danger hover:bg-slate-100`} onClick={() => { onDelete(p); onClose() }}>Delete project (keeps its tasks)</button>
    </Sheet>
  )
}

// Everything about one task or project that doesn't belong on the row.
export default function ItemSheet({ item, rows, goals, tasks, projects, ...on }) {
  if (item.kind === 'project') {
    const p = projects.find((x) => x.id === item.id)
    if (!p) return null
    const row = rows.find((r) => r.task.session && r.task.projectId === p.id)
    return <ProjectSheet p={p} row={row} goals={goals} tasks={tasks} patch={on.patchProject} setProgress={on.setProgress} onAddTask={on.onAddTask} onDoneTask={on.onDone} onOpenTask={on.onOpenTask}
      onMove={on.onMove} onClearProject={on.onClearProject} onDelete={on.onDeleteProject} onAnother={on.onAnother} onClose={on.onClose} />
  }
  const t = tasks.find((x) => x.id === item.id)
  if (!t) return null
  return <TaskSheet t={t} row={rows.find((r) => r.task.id === t.id)} goals={goals} projects={projects} patch={on.patchTask} onStart={on.onStart} onDone={on.onDone} onDelete={on.onDelete} onMove={on.onMove} onClear={on.onClear} onMakeMeeting={on.onMakeMeeting} onClose={on.onClose} />
}
