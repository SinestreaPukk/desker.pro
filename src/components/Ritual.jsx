import { useState } from 'react'
import { btn, BLUE, ghost, panel } from '../ui.js'
import { logEnergy } from '../energy.js'
import { fmtMin } from './TimeAsk.jsx'
import { nameOf, finishRitual, skipRitual } from '../kodama.js'
import { record, addOutcome, outcomeFor, rhythmOf } from '../rhythm.js'
import { plannerArgs, applyPlanChecked, todayStr } from '../shared.jsx'
import { lengthOf } from '../schedule.js'

const hhmm = (t) => (t.start ? `${t.start} ` : '')
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('sv') }
const FEEL = ['Good', 'Okay', 'Tough']

// The two daily check-ins with the kodama. Both are optional and a day without them costs nothing.
// Morning: look at today's plan, say how your energy is. Evening: say what got done and how long it took, move the rest.
// Everything said here is data for the rhythm engine (timings, energy), so the planner gets better at fitting your days.
export default function Ritual({ kind, data, setData, onReplan }) {
  const today = todayStr(), name = nameOf(data)
  const tasks = data.tasks.filter((t) => !t.fun)
  const planned = tasks.filter((t) => t.when === today && !t.done).sort((a, b) => (a.start || '99').localeCompare(b.start || '99'))
  const [asked, setAsked] = useState({}) // task id -> minutes chosen in the wrap-up
  const [feel, setFeel] = useState('')
  const [energy, setEnergy] = useState('')
  const rh = rhythmOf(data)
  const finishedToday = tasks.filter((t) => t.done && t.doneAt && new Date(t.doneAt).toLocaleDateString('sv') === today)
  const untimed = finishedToday.filter((t) => !(t.spent > 0) && !rh.outcomes.some((o) => o.task === t.id))
  const set = (fn) => setData(fn)
  const tapEnergy = (l) => { setEnergy(l); set((d) => ({ ...d, energyLog: logEnergy(d.energyLog, l) })) }
  const done = () => set((d) => finishRitual(feel ? { ...d, kodama: { ...d.kodama, feel: Object.fromEntries(Object.entries({ ...d.kodama?.feel, [today]: feel }).slice(-60)) } } : d, kind))

  const markDone = (t) => set((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, done: true, doneAt: Date.now() } : x)) }))
  const toTomorrow = (t) => set((d) => applyPlanChecked(d, { updates: [{ id: t.id, when: tomorrow() }] }).data)
  const answer = (t, minutes) => { setAsked((a) => ({ ...a, [t.id]: minutes })); set((d) => record(d, (r) => addOutcome(r, outcomeFor(t, d, minutes / 60, 'tap')))) }

  if (kind === 'morning') {
    const mins = planned.reduce((n, t) => n + lengthOf(t), 0)
    return (
      <section className={`${panel} mb-6`} aria-label="Morning plan">
        <h2 className="px-tab px-tab-ando mb-3 inline-block">Morning plan</h2>
        <p>{planned.length ? `Here is today with ${name}: ${planned.length} thing${planned.length === 1 ? '' : 's'}, about ${fmtMin(Math.round(mins / 15) * 15)}.` : 'Nothing is planned for today yet. Plan the week and I will find the times.'}</p>
        {planned.length > 0 && <ul className="mt-2 text-base text-slate-700">{planned.slice(0, 6).map((t) => <li key={t.id} className="break-words">{hhmm(t)}{t.title}</li>)}</ul>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span>How is your energy?</span>
          <div className="px-seg">{['low', 'medium', 'high'].map((l) => <button key={l} aria-pressed={energy === l} className="px-btn capitalize" onClick={() => tapEnergy(l)}>{l}</button>)}</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`${btn} ${BLUE}`} onClick={done}>{planned.length ? 'Looks good' : 'Okay'}</button>
          {planned.length === 0 && <button className={`${btn} ${ghost}`} onClick={onReplan}>Plan my week</button>}
          <button className={btn} onClick={() => set((d) => skipRitual(d, kind))}>Not now</button>
        </div>
      </section>
    )
  }
  return (
    <section className={`${panel} mb-6`} aria-label="Evening wrap-up">
      <h2 className="px-tab px-tab-ando mb-3 inline-block">Evening wrap-up</h2>
      {planned.length > 0 && (
        <>
          <p>Still open from today. Did you get to any of it?</p>
          <ul className="mt-2 space-y-1">{planned.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 border-t border-line py-1"><span className="min-w-0 flex-1 break-words">{hhmm(t)}{t.title}</span>
              <button className={`${btn} ${ghost}`} onClick={() => markDone(t)}>Done</button><button className={`${btn} ${ghost}`} onClick={() => toTomorrow(t)}>Tomorrow</button></li>
          ))}</ul>
        </>
      )}
      {untimed.length > 0 && (
        <>
          <p className="mt-3">How long did these take?</p>
          <ul className="mt-2 space-y-1">{untimed.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 border-t border-line py-1"><span className="min-w-0 flex-1 break-words">{t.title}</span>
              {asked[t.id] ? <span className="text-slate-700">{fmtMin(asked[t.id])}</span>
                : [15, 30, 60, 120].map((m) => <button key={m} className={`${btn} ${ghost}`} onClick={() => answer(t, m)}>{fmtMin(m).replace(' minutes', ' min')}</button>)}</li>
          ))}</ul>
        </>
      )}
      {!planned.length && !untimed.length && <p>{finishedToday.length ? `${finishedToday.length} thing${finishedToday.length === 1 ? '' : 's'} done today.` : 'A quiet day. That is fine.'}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span>How did today feel?</span>
        <div className="px-seg">{FEEL.map((f) => <button key={f} aria-pressed={feel === f} className="px-btn" onClick={() => setFeel(f)}>{f}</button>)}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={`${btn} ${BLUE}`} onClick={done}>That is a wrap</button>
        <button className={btn} onClick={() => set((d) => skipRitual(d, kind))}>Not now</button>
      </div>
    </section>
  )
}
