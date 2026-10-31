import { useState } from 'react'
import { track } from '../analytics.js'
import { btn, BLUE, ghost, panel } from '../ui.js'
import { logEnergy } from '../energy.js'
import { getTaskTime, fmtMin } from '../taskTime.js'
import { nameOf, finishRitual } from '../kodama.js'
import { record, addOutcome, outcomeFor, rhythmOf, timeProfile, mayAsk } from '../rhythm.js'
import { plannerArgs, applyPlanChecked, todayStr } from '../shared.jsx'
import BoxHead from './BoxHead.jsx'
import { Icon } from '../icons.jsx'

const hhmm = (t) => (t.start ? `${t.start} ` : '')
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('sv') }
const FEEL = ['Good', 'Okay', 'Tough']

// The two daily check-ins with the kodama. Both are optional and a day without them costs nothing.
// Morning: look at today's plan, say how your energy is. Evening: say what got done and how long it took, move the rest.
// Everything said here is data for the rhythm engine (timings, energy), so the planner gets better at fitting your days.
export default function Ritual({ kind, due, data, setData, onReplan }) {
  const today = todayStr(), name = nameOf(data)
  const tasks = data.tasks.filter((t) => !t.fun)
  const planned = tasks.filter((t) => t.when === today && !t.done).sort((a, b) => (a.start || '99').localeCompare(b.start || '99'))
  const [hidden, setHidden] = useState(() => { try { return localStorage.ritualHidden === '1' } catch { return false } }) // retracted to one slim line; remembered on this device
  const retract = (v) => { setHidden(v); try { localStorage.ritualHidden = v ? '1' : '0' } catch { /* storage blocked: it opens again next visit */ } }
  const [rows, setRows] = useState([]) // the tasks planned for today, as they were when the wrap-up started: they stay listed after you answer
  const [ans, setAns] = useState({}) // task id -> what you said about it
  const [was, setWas] = useState({}) // task id -> the task as it was before you answered, for the undo icon
  const [partly, setPartly] = useState(null) // task id waiting for 'how much is left?'
  const [started, setStarted] = useState(false) // collapsed to one line and a Start button until the student chooses to begin
  const [asked, setAsked] = useState({}) // task id -> minutes chosen in the wrap-up
  const [feel, setFeel] = useState('')
  const [energy, setEnergy] = useState('')
  const rh = rhythmOf(data)
  const finishedToday = tasks.filter((t) => t.done && t.doneAt && new Date(t.doneAt).toLocaleDateString('sv') === today)
  const untimed = finishedToday.filter((t) => !(t.spent > 0) && !rh.outcomes.some((o) => o.task === t.id))
  const set = (fn) => setData(fn)
  const tapEnergy = (l) => { track('energy_logged', { prompted: true }); setEnergy(l); set((d) => ({ ...d, energyLog: logEnergy(d.energyLog, l) })) }
  const done = () => { if (kind === 'evening') track('wrapup_completed'); setStarted(false); setRows([]); setAns({}); setWas({}); finish() }
  const finish = () => set((d) => finishRitual(feel ? { ...d, kodama: { ...d.kodama, feel: Object.fromEntries(Object.entries({ ...d.kodama?.feel, [today]: feel }).slice(-60)) } } : d, kind))

  const markDone = (t) => set((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, done: true, doneAt: Date.now() } : x)) }))
  const said = (t, text) => { setWas((w) => ({ ...w, [t.id]: t })); setAns((a) => ({ ...a, [t.id]: text })) }
  const undo = (id) => { set((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === id ? was[id] : x)) })); setAns(({ [id]: _, ...a }) => a) }
  const toTomorrow = (t, extra = {}) => set((d) => applyPlanChecked(d, { updates: [{ id: t.id, when: tomorrow(), ...extra }] }).data)
  const finished = (t) => { markDone(t); said(t, 'Done') }
  const notDone = (t) => { toTomorrow(t); said(t, 'Not done. Moved to tomorrow.') }
  const later = (t) => { set((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, when: undefined, start: undefined, block: undefined, blockOf: undefined } : x)) })); said(t, 'Taken off the plan.') }
  const someLeft = (t, frac) => { const h = Math.max(0.25, Math.round((t.hours > 0 ? t.hours : 1) * frac * 4) / 4); toTomorrow(t, { hours: h }); said(t, `Partly. About ${h} h left, moved to tomorrow.`); setPartly(null) }
  const answer = (t, minutes) => { track('duration_logged', { source: 'chip' }); setAsked((a) => ({ ...a, [t.id]: minutes })); set((d) => record(d, (r) => addOutcome(r, outcomeFor(t, d, minutes / 60, 'tap')))) }

  const tp = timeProfile(data)
  const mins = planned.reduce((n, t) => n + getTaskTime(t, tp).plannedMinutes, 0)
  const morning = kind === 'morning'
  const title = morning ? 'Morning plan' : 'Evening wrap-up'
  const skip = <button className={btn} onClick={() => retract(true)}>Hide</button>
  const wrapped = (data.kodama?.rituals?.[kind] || []).includes(today)
  const line = morning
    ? (planned.length ? `Look over today with ${name}: ${planned.length} thing${planned.length === 1 ? '' : 's'}, about ${fmtMin(Math.round(mins / 15) * 15)}.` : 'Nothing is planned for today yet.')
    : wrapped && !due ? 'Wrapped up for today. Open it again to add more.' : `Tell ${name} what got done today and what can wait.`
  if (hidden) {
    return (
      <section className={`${panel} mb-6 !py-2`} aria-label={title}>
        <BoxHead tab={title}><button className={`${btn} ${ghost}`} aria-expanded="false" onClick={() => retract(false)}>Show</button></BoxHead>
      </section>
    )
  }
  if (!started) {
    return (
      <section className={`${panel} mb-6`} aria-label={title}>
        <BoxHead tab={title} line={line}>
          <button className={`${btn} ${BLUE}`} onClick={() => { if (morning) track('morning_plan_opened'); setRows(planned.map((t) => t.id)); setStarted(true) }}>Start</button>
          {skip}
        </BoxHead>
      </section>
    )
  }
  if (morning) {
    return (
      <section className={`${panel} mb-6`} aria-label={title}>
        <BoxHead tab={title} line={line}>
          <button className={`${btn} ${BLUE}`} onClick={done}>{planned.length ? 'Looks good' : 'Okay'}</button>
          {planned.length === 0 && <button className={`${btn} ${ghost}`} onClick={onReplan}>Plan my week</button>}
          {skip}
        </BoxHead>
        {planned.length > 0 && <ul className="mt-3 text-base text-slate-700">{planned.slice(0, 6).map((t) => <li key={t.id} className="break-words">{hhmm(t)}{t.title}</li>)}</ul>}
        {mayAsk(data) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span>How is your energy?</span>
            <div className="px-seg">{['low', 'medium', 'high'].map((l) => <button key={l} aria-pressed={energy === l} className="px-btn capitalize" onClick={() => tapEnergy(l)}>{l}</button>)}</div>
          </div>
        )}
      </section>
    )
  }
  return (
    <section className={`${panel} mb-6`} aria-label={title}>
      <BoxHead tab={title} line={line}>
        <button className={`${btn} ${BLUE}`} onClick={done}>That is a wrap</button>
        {skip}
      </BoxHead>
      {rows.length > 0 && (
        <>
          <p className="mt-3">How did each planned task go?</p>
          <ul className="mt-2 space-y-1">{rows.map((id) => {
            const t = data.tasks.find((x) => x.id === id)
            if (!t) return null
            return (
              <li key={id} className="flex flex-wrap items-center gap-2 border-t border-line py-1">
                <span className="min-w-0 flex-1 basis-40 break-words">{hhmm(t)}{t.title}</span>
                {ans[id] ? <span className="ml-auto flex items-center gap-2 text-slate-700">{ans[id]}{!asked[id] && <button className={`${btn} ${ghost} !px-2`} aria-label={`Undo: ${t.title}`} title="Undo" onClick={() => undo(id)}><Icon name="Undo" small /></button>}</span>
                  : partly === id ? (
                    <span className="ml-auto flex flex-wrap items-center justify-end gap-2"><span className="text-slate-700">How much is left?</span>
                      {[['A little', 0.25], ['About half', 0.5], ['Most of it', 0.75]].map(([l, f]) => <button key={l} className={`${btn} ${ghost}`} onClick={() => someLeft(t, f)}>{l}</button>)}
                      <button className={btn} onClick={() => setPartly(null)}>Back</button></span>
                  ) : (
                    <span className="ml-auto flex flex-wrap justify-end gap-2" role="group" aria-label={`How did ${t.title} go?`}>
                      <button className={`${btn} ${ghost}`} onClick={() => finished(t)}>Done</button>
                      <button className={`${btn} ${ghost}`} onClick={() => setPartly(id)}>Partly</button>
                      <button className={`${btn} ${ghost}`} onClick={() => notDone(t)}>Not done</button>
                      <button className={`${btn} ${ghost}`} onClick={() => later(t)}>Later</button>
                    </span>
                  )}
              </li>
            )
          })}</ul>
        </>
      )}
      {untimed.length > 0 && (
        <>
          <p className="mt-3">How long did these take?</p>
          <ul className="mt-2 space-y-1">{untimed.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 border-t border-line py-1"><span className="min-w-0 flex-1 break-words">{t.title}</span>
              {asked[t.id] ? <span className="ml-auto text-slate-700">{fmtMin(asked[t.id])}</span>
                : <span className="ml-auto flex flex-wrap gap-2">{[15, 30, 60, 120].map((m) => <button key={m} className={`${btn} ${ghost}`} onClick={() => answer(t, m)}>{fmtMin(m)}</button>)}</span>}</li>
          ))}</ul>
        </>
      )}
      {!rows.length && !untimed.length && <p className="mt-3 text-slate-700">{finishedToday.length ? `${finishedToday.length} thing${finishedToday.length === 1 ? '' : 's'} done today.` : 'A quiet day. That is fine.'}</p>}
      {mayAsk(data) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span>How is your energy now?</span>
          <div className="px-seg">{['low', 'medium', 'high'].map((l) => <button key={l} aria-pressed={energy === l} className="px-btn capitalize" onClick={() => tapEnergy(l)}>{l}</button>)}</div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span>How did today feel?</span>
        <div className="px-seg">{FEEL.map((f) => <button key={f} aria-pressed={feel === f} className="px-btn" onClick={() => setFeel(f)}>{f}</button>)}</div>
      </div>
    </section>
  )
}
