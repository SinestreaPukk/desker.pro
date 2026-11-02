import { useState } from 'react'
import { btn, ghost, TYPES } from '../ui.js'
import TimeGrid from '../TimeGrid.jsx'
import Sheet from '../components/Sheet.jsx'
import MeetingSheet from '../components/MeetingSheet.jsx'
import { addHour, clock, dueOn, hmFromMinutes, meetingsOn, movedDue, movedMeeting, typeOf } from '../events.js'
import { todayStr } from '../shared.jsx'

const VIEWS = ['Day', 'Week', 'Month']
const iso = (d) => d.toLocaleDateString('sv')
const pad = (n) => String(n).padStart(2, '0')

const ON_LEGEND = ['taskReminder', 'taskMeeting', 'projectReminder', 'projectMeeting']
function Legend({ imported }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="What the colours mean">
      {[...ON_LEGEND, ...(imported ? ['imported'] : [])].map((k) => <li key={k} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 shrink-0 ${TYPES[k].mark}`} aria-hidden="true" />{TYPES[k].name}</li>)}
    </ul>
  )
}

// Classes and meetings as solid blocks, plus anything with a due date, whether it shows as a reminder or a meeting. Sessions have no date, so they stay off it.
export default function Calendar({ goals, events, setEvents, busy, tasks, projects, onOpenTask, onOpenProject, onDoneTask, onFinishProject, patchTask, patchProject, onAdd, onMeetingToProject, onConnect }) {
  const [view, setView] = useState('Month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [editing, setEditing] = useState(null)
  const [foreign, setForeign] = useState(null) // an imported event, which can only be changed in its own calendar
  const today = todayStr()
  const y = anchor.getFullYear(), m = anchor.getMonth()
  const shift = (n) => setAnchor(view === 'Month' ? new Date(y, m + n, 1) : new Date(y, m, anchor.getDate() + n * (view === 'Week' ? 7 : 1)))
  const openDay = (key) => { setAnchor(new Date(`${key}T12:00`)); setView('Day') }
  const ofDay = (key) => meetingsOn(key, events, busy)
  const select = (x) => (x.imported ? setForeign(x) : setEditing(x.source))
  const blockOf = (x) => ({ id: x.id, label: x.title, cls: TYPES[typeOf(x)].cls, title: x.allDay ? x.title : `${clock(x.s)} ${x.title}`, onClick: () => select(x), s: x.s, e: x.e, ...(x.source && { drag: `m${x.source.id}` }) })
  const finished = (x) => (x.project?.progress ?? 0) >= 5
  const dueBlockOf = (x) => ({ id: x.id, ...(!x.future && { drag: x.id }), future: x.future, ring: TYPES[typeOf(x)].ring, label: x.title, cls: TYPES[typeOf(x)].cls, title: x.future ? `Repeats: ${x.title}` : x.project?.end ? `${clock(x.s)} to ${clock(x.e)}: ${x.title}` : `Due: ${x.title}`, s: x.s, e: x.e,
    onClick: () => (x.project ? onOpenProject(x.project) : onOpenTask(x.task)),
    ...(!finished(x) && !x.future && { onTick: () => (x.project ? onFinishProject(x.project.id, 5) : onDoneTask(x.task)) }) })
  // Moving something changes its day and time. Imported events have no drag id, as they belong to their own calendar.
  const drop = (id, date, minute) => {
    const hm = minute === null ? '' : hmFromMinutes(minute)
    const key = +id.slice(1)
    if (id[0] === 't') { const task = tasks.find((t) => t.id === key); if (task) patchTask(key, movedDue({ task }, date, hm)) }
    if (id[0] === 'p') { const project = projects.find((p) => p.id === key); if (project && (hm || !project.end)) patchProject(key, movedDue({ project }, date, hm)) } // a meeting always has a time
    if (id[0] === 'm' && hm) setEvents(events.map((e) => (e.id === key ? movedMeeting(e, date, hm) : e))) // a meeting always has a time
  }
  const dueThat = (key) => dueOn(key, tasks, projects, today)

  const column = (date) => {
    const key = iso(date), list = ofDay(key), due = dueThat(key)
    return { key, today: key === today, head: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
      allDay: [...list.filter((x) => x.allDay).map(blockOf), ...due.filter((x) => x.allDay).map(dueBlockOf)],
      blocks: [...list.filter((x) => !x.allDay).map(blockOf), ...due.filter((x) => !x.allDay).map(dueBlockOf)] }
  }
  const sunday = new Date(y, m, anchor.getDate() - anchor.getDay())
  const days = view === 'Week' ? Array.from({ length: 7 }, (_, i) => new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i)) : [anchor]
  const short = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const title = view === 'Month' ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : view === 'Week' ? `${short(days[0])} – ${short(days[6])}` : anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const blanks = Array(new Date(y, m, 1).getDay()).fill(null)
  const monthDays = Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => `${y}-${pad(m + 1)}-${pad(i + 1)}`)
  const empty = !events.length && !busy.length && !tasks.some((t) => t.due && !t.done) && !projects.some((p) => p.date)
  const save = (x, kind, type) => {
    if (!x.id) onAdd(x, kind, type)
    else if (type === 'Project') onMeetingToProject(x, kind)
    else if (kind === 'Reminder') { setEvents(events.filter((e) => e.id !== x.id)); onAdd(x, kind, type) }
    else setEvents(events.map((e) => (e.id === x.id ? x : e)))
    setEditing(null)
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full border border-line bg-white p-1" role="group" aria-label="Calendar view">
          {VIEWS.map((v) => <button key={v} className={`${btn} !px-3 !py-1 !transition-none ${view === v ? 'bg-pale font-medium text-ink' : 'text-slate-600'}`} aria-pressed={view === v} onClick={() => setView(v)}>{v}</button>)}
        </div>
        <div className="flex items-center gap-1">
          <button aria-label={`Previous ${view.toLowerCase()}`} className={`${btn} ${ghost}`} onClick={() => shift(-1)}>←</button>
          <button className={`${btn} ${ghost}`} onClick={() => setAnchor(new Date())}>Today</button>
          <button aria-label={`Next ${view.toLowerCase()}`} className={`${btn} ${ghost}`} onClick={() => shift(1)}>→</button>
        </div>
      </div>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {view !== 'Month' && <TimeGrid cols={days.map(column)} onHead={openDay} onDrop={drop} onSlot={(date, h) => setEditing({ date, start: `${pad(h)}:00`, end: addHour(`${pad(h)}:00`) })} />}
      {view === 'Month' && (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {blanks.map((_, i) => <div key={`b${i}`} />)}
            {monthDays.map((key) => {
              const list = [...dueThat(key).map((x) => ({ ...x, label: x.project?.end ? x.title : `○ ${x.title}`, cls: TYPES[typeOf(x)].cls })), ...ofDay(key).map((x) => ({ ...x, label: x.title, cls: TYPES[typeOf(x)].cls }))]
              return (
                <button key={key} className={`chip min-h-16 min-w-0 rounded border border-line bg-white p-1 text-left hover:bg-panel ${key === today ? 'ring-2 ring-accent' : ''}`} aria-label={`${key}, ${list.length} item${list.length === 1 ? '' : 's'}`} onClick={() => openDay(key)}>
                  <span className="block text-xs text-slate-500">{+key.slice(8)}</span>
                  {list.slice(0, 2).map((x) => <span key={x.id} className={`mt-0.5 block truncate rounded border px-1 text-xs ${x.future ? 'border-dashed' : ''} ${x.cls}`}>{x.label}</span>)}
                  {list.length > 2 && <span className="block px-1 text-xs text-slate-600">+{list.length - 2} more</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
      <Legend imported={busy.length > 0} />
      {empty && <p className="mt-3 text-sm text-slate-600">Tap a day, then a time, to add a task or project. Or <button className="min-h-11 text-accent underline" onClick={onConnect}>connect your calendar</button> in Settings.</p>}
      {editing && <MeetingSheet meeting={editing} goals={goals} onSave={save} onDelete={(id) => { setEvents(events.filter((e) => e.id !== id)); setEditing(null) }} onClose={() => setEditing(null)} />}
      {foreign && (
        <Sheet label={foreign.title} onClose={() => setForeign(null)}>
          <h2 className="text-lg font-medium">{foreign.title}</h2>
          {!foreign.allDay && <p className="text-sm text-slate-700">{clock(foreign.s)} to {clock(foreign.e)}</p>}
          <p className="text-sm text-slate-600">This comes from your connected calendar, so change it there.</p>
        </Sheet>
      )}
    </>
  )
}
