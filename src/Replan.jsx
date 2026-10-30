import { useState, useEffect } from 'react'
import { post } from './api.js'
import { btn, ghost } from './ui.js'
import { isMissed } from './tasks.js'
import { validPlan, diff, applyPlan, risks } from './replan.js'
import { Button } from './components/ui.jsx'

const when = (w, s) => `${new Date(`${w}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${s ? ` ${s}` : ''}`

// "Replan my week": asks the AI for a new schedule, shows what moves, and only changes the tasks when you apply it.
export default function Replan({ data, busy, energy, ratio, onApply, onClose }) {
  const [state, setState] = useState({ loading: true })
  const run = async () => {
    setState({ loading: true })
    const open = data.tasks.filter((t) => !t.done && !t.fun)
    if (!open.length) return setState({ error: 'You have no open tasks to plan. Add some in Tasks first.' })
    try {
      const out = await post('/api/replan', {
        tasks: open.map(({ id, title, due, when, start, hours, readiness, important, urgent, deadlineId }) => ({ id, title, due, when, start, hours, readiness, important, urgent, deadlineId, missed: isMissed({ when, start, hours }) })),
        deadlines: (data.deadlines || []).map(({ id, title, date, time, hours }) => ({ id, title, date, time, hours })),
        freeHours: data.freeHours, freeToday: data.freeToday?.date === new Date().toLocaleDateString('sv') ? data.freeToday.hours : undefined,
        busy, energy, ratio, now: new Date().toLocaleString(),
      })
      const plan = validPlan(out.plan, data.tasks)
      if (!plan.length) throw new Error('The AI gave an unreadable answer. Please try again.')
      const d = diff(data.tasks, plan)
      setState({ plan, d, note: typeof out.note === 'string' ? out.note : '', risk: risks(applyPlan(data.tasks, plan), data.deadlines || [], data.freeHours) })
    } catch (err) { setState({ error: err.message }) }
  }
  useEffect(() => { run() }, [])
  const { loading, error, plan, d, note, risk } = state
  return (
    <section className="mb-4 rounded-2xl bg-panel p-4" aria-label="Replan my week" aria-busy={loading}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Replan my week</h2>
        <button className={`${btn} hover:bg-slate-100`} onClick={onClose}>Close</button>
      </div>
      {loading && <p className="text-sm text-slate-600">Looking at your deadlines, free time and calendar…</p>}
      {error && (
        <div role="alert" className="text-sm">
          <p className="text-danger">{error}</p>
          <p className="text-slate-600">Nothing was changed.</p>
          <button className={`${btn} mt-2 ${ghost}`} onClick={run}>Try again</button>
        </div>
      )}
      {plan && (
        <>
          {note && <p className="mb-3 text-sm text-slate-600">{note}</p>}
          {d.moved.length === 0 ? <p className="text-sm">Your schedule already looks right. Nothing needs to move.</p> : (
            <>
              <h3 className="text-sm font-semibold">Moves ({d.moved.length})</h3>
              <ul className="mb-3 space-y-1 text-sm">
                {d.moved.map((m) => (
                  <li key={m.t.id} className="rounded-xl bg-slate-50 px-3 py-1.5">
                    <b>{m.t.title}</b>{' '}
                    <span className="text-slate-600">{m.fresh ? 'new:' : `${when(m.t.when, m.t.start)} →`}</span> {when(m.to.when, m.to.start)}
                    {m.pushedBack && <span className="ml-2 rounded bg-amber/20 px-1.5 text-xs">pushed back</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {d.pushedBack.length > 0 && <p className="mb-3 text-sm text-slate-600">{d.pushedBack.length} task{d.pushedBack.length === 1 ? ' was' : 's were'} pushed to a later day to make room.</p>}
          {risk.length > 0 ? (
            <div className="mb-3 rounded-xl bg-danger/10 p-3 text-sm">
              <h3 className="font-semibold text-danger">At risk of missing a deadline</h3>
              <ul className="mt-1 list-disc pl-5">{risk.map((r, i) => <li key={i}><b>{r.title}</b>: {r.why}</li>)}</ul>
            </div>
          ) : <p className="mb-3 text-sm text-[#1e7d32]">No deadline looks at risk with this plan.</p>}
          <div className="flex flex-wrap gap-2">
            {d.moved.length > 0 && <Button variant="primary" onClick={() => onApply(plan)}>Apply plan</Button>}
            <Button variant="secondary" onClick={onClose}>{d.moved.length ? 'Keep my schedule' : 'Close'}</Button>
          </div>
        </>
      )}
    </section>
  )
}
