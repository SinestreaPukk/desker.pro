import { useRef, useState } from 'react'
import { BLUE, btn, input, chip } from '../ui.js'
import { addHour, meetingTimes } from '../events.js'
import { rankedGoals } from '../goals.js'
import Sheet, { Field } from './Sheet.jsx'

function Switch({ label, options, value, onPick }) {
  return (
    <div role="group" aria-label={label} className="flex w-fit gap-1 rounded-full bg-panel p-1">
      {options.map((k) => <button key={k} type="button" aria-pressed={value === k} className={`${btn} !py-1 ${value === k ? 'bg-primary font-medium text-ink' : 'text-slate-600'}`} onClick={() => onPick(k)}>{k}</button>)}
    </div>
  )
}
export const KindSwitch = ({ kind, onPick }) => <Switch label="Kind" options={['Meeting', 'Reminder']} value={kind} onPick={onPick} />
export const TypeSwitch = ({ type, onPick }) => <Switch label="Task or project" options={['Task', 'Project']} value={type} onPick={onPick} />

const NOTES = {
  'Task Meeting': 'Just happens at this time, like a class or the dentist. Nothing to do, so it stays in Coming up.',
  'Task Reminder': "Something to tick off, like homework, or anything you just want reminding about. It's ranked on Now.",
  'Project Meeting': "Happens at this time and has work to prepare, like a test. It gets tasks and sessions, and it's ranked on Now.",
  'Project Reminder': "Bigger work, like launching a product. It gets tasks and sessions, and it's ranked on Now.",
}

const openPicker = (e) => { try { e.target.showPicker() } catch { /* typing still works */ } }

// The one form for adding, from a calendar slot or from + Add on Now. Choose what it is, type the title and set the time. Enter saves.
// allowNoDate is for + Add: it can have no deadline, and Meeting or Reminder and the time only appear once there is a date.
// A meeting or task can become a project here. onReminder and note are for a task being changed: Task + Reminder is what it already is, so choosing that goes back to it, and note says what it will lose.
export default function MeetingSheet({ meeting, goals = [], startType = 'Task', startKind = 'Meeting', allowNoDate, onSave, onDelete, onReminder, note, onClose }) {
  const [m, setM] = useState(meeting)
  const [kind, setKind] = useState(startKind)
  const [type, setType] = useState(startType)
  const title = useRef(null)
  const isMeeting = kind === 'Meeting', isTask = type === 'Task'
  const ranked = rankedGoals(goals)
  const set = (p) => setM({ ...m, ...p })
  const noDeadline = () => { set({ date: '', start: '', end: '', weekly: false }); setKind('Reminder') }
  const save = (e) => {
    e.preventDefault()
    if (!m.title?.trim()) return
    const times = isMeeting ? meetingTimes(m.start, m.end) : { time: m.start, end: m.end }
    onSave({ ...m, title: m.title.trim(), start: times.time, end: times.end }, kind, type)
  }
  const choose = (t, k) => {
    if (onReminder && t === 'Task' && k === 'Reminder') return onReminder()
    setType(t); setKind(k)
    if (k === 'Meeting') { const { time, end } = meetingTimes(m.start, m.end); set({ start: time, end }) } // a meeting always shows its times
    title.current?.focus()
  }
  const setStart = (v) => { if (v || !isMeeting) set({ start: v, end: v ? addHour(v) : '' }) } // a reminder can go back to whole-day
  return (
    <Sheet label={meeting.title || `New ${type.toLowerCase()}${m.date ? ` ${kind.toLowerCase()}` : ''}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={save}>
        <div className="flex flex-wrap gap-2">
          <TypeSwitch type={type} onPick={(t) => choose(t, kind)} />
          {m.date && <KindSwitch kind={kind} onPick={(k) => choose(type, k)} />}
        </div>
        <input ref={title} autoFocus className={`${input} w-full text-lg font-medium`} aria-label={`${type} title`} placeholder={isTask ? (isMeeting ? 'Statics class' : 'Homework 3') : (isMeeting ? 'Statics test' : 'Launch Desker')} value={m.title || ''} onChange={(e) => set({ title: e.target.value })} />
        <div className="flex flex-wrap items-end gap-3">
          {allowNoDate && <button type="button" className={chip(!m.date)} aria-pressed={!m.date} onClick={noDeadline}>No deadline</button>}
          <label className="flex flex-col gap-1 text-sm">Day<input type="date" required={!allowNoDate} className={`${input} min-h-11`} value={m.date} onClick={openPicker} onChange={(e) => { if (e.target.value) set({ date: e.target.value }); else if (allowNoDate) noDeadline() }} /></label>
          {m.date && <label className="flex flex-col gap-1 text-sm">{isMeeting ? 'Starts' : 'Time'}<input type="time" required={isMeeting} className={`${input} min-h-11`} value={m.start} onClick={openPicker} onChange={(e) => setStart(e.target.value)} /></label>}
          {m.date && isMeeting && <label className="flex flex-col gap-1 text-sm">Ends<input type="time" className={`${input} min-h-11`} value={m.end} onClick={openPicker} onChange={(e) => set({ end: e.target.value })} /></label>}
        </div>
        {isTask && m.date && <button type="button" className={chip(!!m.weekly)} aria-pressed={!!m.weekly} onClick={() => set({ weekly: !m.weekly })}>Every week</button>}
        {ranked.length > 0 && (
          <Field label="Works towards?">
            {ranked.map((g, i) => <button key={g.id} type="button" className={chip(m.goalId === g.id)} aria-pressed={m.goalId === g.id} onClick={() => set({ goalId: m.goalId === g.id ? undefined : g.id })}>{i + 1} {g.title}</button>)}
          </Field>
        )}
        <p className="text-sm text-slate-600">{NOTES[`${type} ${kind}`]}{note && ` ${note}`}</p>
        <div className="flex flex-wrap gap-2">
          <button className={`${btn} ${BLUE}`} disabled={!m.title?.trim()}>Save</button>
          {meeting.id && <button type="button" className={`${btn} text-danger hover:bg-slate-100`} onClick={() => onDelete(meeting.id)}>Delete</button>}
        </div>
      </form>
    </Sheet>
  )
}
