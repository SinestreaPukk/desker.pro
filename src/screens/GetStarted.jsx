import { useState } from 'react'
import { rankTasks } from '../shared.jsx'
import { Button, Card } from '../components/ui.jsx'

// First-run checklist: five steps, each one tap, progress always visible. Steps tick themselves from the data.
export const stepsOf = ({ data, goals, tasks }, hasNext) => [
  { key: 'goal', label: 'Add one goal or take the 10-minute guide', done: goals.length > 0 || !!data.guide?.done },
  { key: 'tasks', label: 'Add tasks or import a syllabus', done: tasks.length > 0 },
  { key: 'prioritise', label: 'Prioritise with AI', done: tasks.some((t) => t.important !== undefined) },
  { key: 'calendar', label: 'Connect your calendar', done: !!(data.sync?.url || data.busy?.length) },
  { key: 'next', label: 'Get your first next step', done: hasNext },
]

export default function GetStarted({ steps, goals, tasks, setTasks, goTab, onGuide, onDismiss, hero }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const left = steps.filter((s) => !s.done).length
  const prioritise = async () => {
    setBusy(true); setError('')
    try { setTasks(await rankTasks(goals, tasks)) } catch (e) { setError(e.message) }
    setBusy(false)
  }
  const act = {
    goal: <><Button onClick={onGuide}>Take the 10-minute guide</Button><Button variant="secondary" onClick={() => goTab('Goals')}>Add a goal</Button></>,
    tasks: <Button onClick={() => goTab('Tasks')}>Add tasks</Button>,
    prioritise: <Button disabled={busy || !tasks.length} onClick={prioritise}>{busy ? 'Thinking…' : 'Prioritise with AI'}</Button>,
    calendar: <Button onClick={() => goTab('Calendar')}>Connect calendar</Button>,
  }
  return (
    <Card title={hero ? 'Welcome to Desker. Let’s get your first step.' : 'Finish setting up'} action={<span className="text-sm text-slate-600">{steps.length - left} of {steps.length}</span>}>
      <div className="h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={steps.length - left}>
        <div className="h-full rounded-full bg-accent-dark" style={{ width: `${((steps.length - left) / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={s.key} className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${s.done ? 'bg-accent-dark text-white' : 'border border-control bg-white'}`}>{s.done ? '✓' : i + 1}</span>
            <span className={`min-w-0 flex-1 ${s.done ? 'text-slate-600 line-through' : 'font-medium'}`}>{s.label}<span className="sr-only">{s.done ? ' (done)' : ''}</span></span>
            {!s.done && act[s.key] && <span className="flex flex-wrap gap-2">{act[s.key]}</span>}
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {!hero && <div className="mt-4"><Button variant="ghost" onClick={onDismiss}>Hide this</Button></div>}
    </Card>
  )
}
