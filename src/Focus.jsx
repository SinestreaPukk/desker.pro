import { useState, useEffect, useRef } from 'react'
import { btn } from './ui.js'

const read = () => { try { return { work: 25, brk: 5, ...JSON.parse(localStorage.pomo || '{}') } } catch { return { work: 25, brk: 5 } } }
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

// Pomodoro timer for one task. Focus time is logged on the task (task.spent, hours) every minute and whenever you pause or leave.
export default function Focus({ title, estimate, spent = 0, logged, onLog, onDone, onStop }) { // onDone/onStop receive the last unlogged hours
  const [cfg, setCfg] = useState(read)
  const [phase, setPhase] = useState('work')
  const [left, setLeft] = useState(cfg.work * 6e4)
  const [running, setRunning] = useState(true)
  const [cycles, setCycles] = useState(0)
  const [session, setSession] = useState(0) // focused ms this session
  const acc = useRef(0), last = useRef(Date.now()), st = useRef({})
  st.current = { phase, left, running, cfg }
  const logRef = useRef(onLog); logRef.current = onLog

  const take = () => { const h = acc.current / 36e5; acc.current = 0; return h } // focused hours not yet logged
  const flush = () => { const h = take(); if (h > 1 / 3600) logRef.current(h) }
  useEffect(() => {
    last.current = Date.now()
    const id = setInterval(() => {
      const now = Date.now(), dt = now - last.current
      last.current = now
      const { phase: ph, left: l, running: run, cfg: c } = st.current
      if (!run) return
      const used = Math.min(dt, l)
      if (ph === 'work') { acc.current += used; setSession((x) => x + used); if (acc.current >= 6e4) flush() }
      if (l - dt > 0) return setLeft(l - dt)
      flush()
      const next = ph === 'work' ? 'break' : 'work'
      if (ph === 'work') setCycles((n) => n + 1)
      setPhase(next); setLeft((next === 'work' ? c.work : c.brk) * 6e4)
      try { if (localStorage.reminders === '1' && Notification.permission === 'granted') new Notification(next === 'break' ? 'Time for a break' : 'Back to focus', { body: title }) } catch { /* no notifications */ }
    }, 500)
    return () => { clearInterval(id); flush() }
  }, [])

  const set = (k, v) => {
    const c = { ...cfg, [k]: Math.min(120, Math.max(1, +v || 1)) }
    setCfg(c)
    try { localStorage.pomo = JSON.stringify(c) } catch { /* not saved */ }
    if ((k === 'work' && phase === 'work') || (k === 'brk' && phase === 'break')) setLeft(c[k] * 6e4)
  }
  const pause = () => { if (running) flush(); setRunning(!running) }
  const leave = (fn) => () => fn(take()) // the caller logs these last hours together with its own change
  const total = (phase === 'work' ? cfg.work : cfg.brk) * 6e4
  const field = 'w-16 rounded-xl bg-white/10 px-2 py-1 text-white'
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-[#1c1c1e] p-6 text-center text-white" role="dialog" aria-label="Focus timer">
      <p className="text-sm text-slate-300">{phase === 'work' ? 'Focus' : 'Break'}{cycles ? ` · ${cycles} done` : ''}</p>
      <h2 className="max-w-md break-words text-2xl font-semibold leading-tight tracking-tight">{title}</h2>
      <p className="text-7xl font-semibold tabular-nums tracking-tight" role="timer" aria-live="off">{mmss(left)}</p>
      <div className="h-1.5 w-64 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-[#0a84ff]" style={{ width: `${(1 - left / total) * 100}%` }} /></div>
      {logged && <p className="text-sm text-slate-300">Logged on this task: {Math.round((spent + session / 36e5) * 60)} min{estimate ? ` of ${Math.round(estimate * 60)} min estimated` : ''}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <button className={`${btn} bg-white text-slate-900 hover:bg-slate-100`} onClick={pause}>{running ? 'Pause' : 'Resume'}</button>
        <button className={`${btn} border border-slate-500 hover:bg-slate-700`} onClick={() => { flush(); setPhase(phase === 'work' ? 'break' : 'work'); setLeft((phase === 'work' ? cfg.brk : cfg.work) * 6e4) }}>{phase === 'work' ? 'Skip to break' : 'Skip break'}</button>
        <button className={`${btn} bg-[#34c759] text-slate-900 hover:bg-[#30d158]`} onClick={leave(onDone)}>Done</button>
        <button className={`${btn} border border-slate-500 hover:bg-slate-700`} onClick={leave(onStop)}>Stop</button>
      </div>
      <div className="flex gap-4 text-sm text-slate-300">
        <label className="flex items-center gap-2">Focus (min)<input type="number" min="1" max="120" className={field} value={cfg.work} onChange={(e) => set('work', e.target.value)} /></label>
        <label className="flex items-center gap-2">Break (min)<input type="number" min="1" max="120" className={field} value={cfg.brk} onChange={(e) => set('brk', e.target.value)} /></label>
      </div>
      {!logged && <p className="text-xs text-slate-400">This activity is not a task, so its time is not logged.</p>}
    </div>
  )
}
