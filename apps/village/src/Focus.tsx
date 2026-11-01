// The village focus timer (SPEC Checkpoint 8): task picker, the HUD timer, and the "Done? / Still going" question.
// The timer is a normal Desker focus session: the API writes it into the account document when it ends (apps/village/api/village/_session.js).
import { useEffect, useState } from 'react'
import { ACTIVITIES, type Activity } from '@desker/shared'
import { todaysTasks, type PickTask } from './api.ts'

export interface Timer { sessionId: string; startedAt: number; endsAt: number; plannedMin: number; taskId?: string; title: string; courseCode?: string; activity: Activity }
export const LABEL: Record<Activity, string> = { reading: 'Reading', practising: 'Practising', writing: 'Writing', revising: 'Revising', lab_report: 'Lab report', group_work: 'Group work', admin: 'Admin', other: 'Other' }
export type Pick = { taskId?: string; title: string; courseCode?: string; activity: Activity; minutes: number }
/** A task called "DTIP 122 read chapter 3" already says its course: show the course once. */
export const plain = (title: string, code?: string) => (code && title.startsWith(code) ? title.slice(code.length).replace(/^[\s·:-]+/, '') || title : title)
const clampMin = (n: number) => Math.min(600, Math.max(1, Math.round(n) || 25))

export function TaskPicker({ slug, onPick, onClose }: { slug: string; onPick: (p: Pick) => void; onClose: () => void }) {
  const [tasks, setTasks] = useState<PickTask[] | null>(null), [err, setErr] = useState(false)
  const [sel, setSel] = useState<PickTask | 'other'>('other'), [min, setMin] = useState(25), [label, setLabel] = useState(''), [act, setAct] = useState<Activity>('reading')
  useEffect(() => { todaysTasks(slug).then((r) => { setTasks(r.tasks); if (r.tasks[0]) { setSel(r.tasks[0]); setMin(clampMin(r.tasks[0].hours * 60)) } }).catch(() => { setErr(true); setTasks([]) }) }, [slug])
  const choose = (t: PickTask | 'other') => { setSel(t); setMin(t === 'other' ? 25 : clampMin(t.hours * 60)) }
  const go = () => onPick(sel === 'other'
    ? { title: label.trim().slice(0, 60) || LABEL[act], activity: act, minutes: clampMin(min) }
    : { taskId: sel.id, title: sel.title, courseCode: sel.courseCode, activity: sel.activity as Activity, minutes: clampMin(min) })
  return (
    <div className="hud-modal" role="dialog" aria-label="Start a focus timer" onClick={onClose}>
      <div className="hud-panel picker" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <h2>What are you working on?</h2>
        {tasks === null && <p>Loading today's tasks…</p>}
        {err && <p role="alert">Couldn't load your Desker tasks. You can still pick something else.</p>}
        {tasks && tasks.length === 0 && !err && <p>No tasks planned for today in Desker.</p>}
        <ul role="radiogroup">
          {tasks?.map((t) => (
            <li key={t.id}><label><input type="radio" name="t" checked={sel !== 'other' && sel.id === t.id} onChange={() => choose(t)} /> <b>{t.title}</b> <small>{t.courseCode ? `${t.courseCode} · ` : ''}{Math.round(t.hours * 60)} min</small></label></li>
          ))}
          <li><label><input type="radio" name="t" checked={sel === 'other'} onChange={() => choose('other')} /> <b>Something else</b></label></li>
        </ul>
        {sel === 'other' && (
          <p className="row">
            <select value={act} onChange={(e) => setAct(e.target.value as Activity)} aria-label="Activity">{ACTIVITIES.map((a) => <option key={a} value={a}>{LABEL[a]}</option>)}</select>
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="A short label (optional)" aria-label="Label" />
          </p>
        )}
        <p className="row"><label>Minutes <input type="number" min={1} max={600} value={min} onChange={(e) => setMin(Number(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && go()} /></label>
          <button className="primary" onClick={go} autoFocus>Start</button> <button onClick={onClose}>Cancel (Esc)</button></p>
      </div>
    </div>
  )
}

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

/** The timer card, and (once it ends or time is up) the one question Desker asks: was the task finished? */
export function TimerHud({ timer, now, ask, onStop, onAnswer, onKeep }: { timer: Timer; now: number; ask: boolean; onStop: () => void; onAnswer: (done: boolean) => void; onKeep: () => void }) {
  const left = timer.endsAt - now, up = left <= 0
  return (
    <>
      <div className="timer" role="timer" aria-label="Focus timer">
        <span className="t-act">{timer.courseCode ? `${timer.courseCode} · ` : ''}{plain(timer.title, timer.courseCode)}</span>
        <b>{mmss(left)}</b>
        {!ask && <button onClick={onStop}>Stop<kbd>F</kbd></button>}
      </div>
      {ask && (
        <div className="hud-modal" role="dialog" aria-label={up ? "Time's up" : 'End the timer'}>
          <div className="hud-panel">
            <h2>{up ? "Time's up" : 'End this timer?'}</h2>
            {timer.taskId ? <p>Is "{timer.title}" done?</p> : <p>Nice work on "{timer.title}".</p>}
            <p className="row">
              {timer.taskId ? <><button className="primary" autoFocus onClick={() => onAnswer(true)}>Done</button><button onClick={() => onAnswer(false)}>Still going</button></> : <button className="primary" autoFocus onClick={() => onAnswer(true)}>Finish</button>}
              {!up && <button onClick={onKeep}>Keep timing</button>}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
