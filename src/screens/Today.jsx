import { useState } from 'react'
import { post } from '../api.js'
import { addTasks, doneStats, isMissed } from '../tasks.js'
import { logEnergy, energyProfile, ranges } from '../energy.js'
import { METHODS } from '../methods.js'
import { Scene } from '../px.jsx'
import Review from '../Review.jsx'
import Row from '../components/Row.jsx'
import { BLUE, btn, ghost, input, panel, LEVELS } from '../ui.js'
import { quadrant, patternOf, busyForAI, freeTodayOf, todayStr, fromCalendar, fmtDate } from '../shared.jsx'

const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

function Energy({ log, reset }) {
  const [sure, setSure] = useState(false)
  const p = energyProfile(log)
  return (
    <div className="text-base">
      {p.enough
        ? <p className="text-slate-700">Usually high energy: {ranges(p.high) || 'no clear hours yet'}. Usually low: {ranges(p.low) || 'no clear hours yet'}. The AI agent and Replan put demanding work in your high hours.</p>
        : <p className="text-slate-600">Tap your energy level a few times a day. After {8 - p.n > 0 ? `${8 - p.n} more` : 'a few more'} check-ins, Desker learns when you do your best work.</p>}
      {log.length > 0 && (
        <>
          <details className="mt-2">
            <summary className="cursor-pointer text-accent">View check-ins ({log.length})</summary>
            <ul className="mt-1 max-h-40 overflow-y-auto text-slate-700">
              {[...log].reverse().slice(0, 50).map((e) => <li key={e.at}>{new Date(e.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}: {e.level}</li>)}
            </ul>
          </details>
          {sure
            ? <p className="mt-2" role="alert">Delete all {log.length} check-ins? <button className={`${btn} text-danger hover:bg-white`} onClick={() => { reset(); setSure(false) }}>Delete</button><button className={`${btn} hover:bg-white`} onClick={() => setSure(false)}>Cancel</button></p>
            : <button className={`${btn} mt-2 ${ghost}`} onClick={() => setSure(true)}>Reset energy data</button>}
        </>
      )}
    </div>
  )
}

const Tile = ({ label, caption, children, keep }) => (
  <div className="px-rule pb-2 lg:col-span-3">
    <p className="text-slate-700">{label}</p>
    <div className="text-2xl">{children}</div>
    <p className={`text-xs text-slate-700 ${keep ? '' : 'hidden lg:block'}`}>{caption}</p>
  </div>
)

// Today: one question, "what should I do right now?", with the week around it.
export default function Today({ data, setData, tasks, goals, deadlines, focus, pick, setFocus, setPick, setTasks, goTab, openTimer, deleteTask, openAgent, onReplan, onReview }) {
  const [minutes, setMinutes] = useState(60)
  const [energy, setEnergy] = useState('medium')
  const [opts, setOpts] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [quick, setQuick] = useState('')
  const [guide, setGuide] = useState(() => { try { return !localStorage.guideSeen } catch { return true } }) // shown once, over the dashboard
  const closeGuide = () => { setGuide(false); try { localStorage.guideSeen = '1' } catch { /* storage blocked: it shows again next visit */ } }
  const go = (tab) => { closeGuide(); goTab(tab) }

  const today = todayStr()
  const open = tasks.filter((t) => !t.done && !t.fun)
  const doFirst = open.filter((t) => quadrant(t) === 0)
  const missed = tasks.filter((t) => isMissed(t))
  const stats = doneStats(tasks)
  const weekEnd = new Date(Date.now() + 7 * 864e5).toLocaleDateString('sv')
  const soon = [
    ...deadlines.map((d) => ({ id: `d${d.id}`, title: d.title, date: d.date, kind: 'Deadline' })),
    ...open.filter((t) => t.due).map((t) => ({ id: `t${t.id}`, title: t.title, date: t.due, kind: 'Task' })),
  ].filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const thisWeek = soon.filter((x) => x.date <= weekEnd)
  const finding = missed.length
    ? `${missed.length} planned task${missed.length === 1 ? '' : 's'} slipped past ${missed.length === 1 ? 'its' : 'their'} time.`
    : thisWeek.length ? `${thisWeek[0].title} is due ${thisWeek[0].date === today ? 'today' : fmtDate(thisWeek[0].date)}.`
    : doFirst.length ? `${doFirst.length} thing${doFirst.length === 1 ? '' : 's'} to do first.`
    : open.length ? `${open.length} open task${open.length === 1 ? '' : 's'}, none urgent.` : 'Nothing on your list yet. Add a task to begin.'

  const cal = fromCalendar(tasks)
  const picks = METHODS.map((m) => ({ m, r: m.pick(tasks, { minutes, energy }) }))
  const lead = picks.find((p) => p.r)
  const cur = focus || pick || cal || (lead && { taskId: lead.r.t.id, title: lead.r.t.title, method: lead.m.name, why: lead.r.why, minutes: lead.r.t.hours ? Math.round(lead.r.t.hours * 60) : undefined })
  const finish = () => {
    if (cur.taskId) setTasks(tasks.map((t) => (t.id === cur.taskId ? { ...t, done: true } : t)))
    setFocus(null)
  }
  const choose = (m, t, why) => setPick({ taskId: t.id, title: t.title, method: m.name, why, minutes: t.hours ? Math.round(t.hours * 60) : undefined })
  const ask = async () => {
    setBusy(true); setError('')
    try {
      const out = await post('/api/now', {
        goals: goals.map(({ id, title, level, happiness }) => ({ id, level: LEVELS[level].name, kind: happiness ? 'happiness' : 'work', title })),
        tasks: tasks.filter((t) => !t.done).map(({ id, title, due, when, hours, readiness, important, urgent, fun }) => ({ id, title, due, when, hours, readiness, important, urgent, fun })),
        hobbies: (data.hobbies || []).map((h) => h.title),
        deadlines: deadlines.map(({ title, date, hours }) => ({ title, date, hours })),
        minutes, energy, pattern: patternOf(data), mood: data.mood, freeToday: freeTodayOf(data), busy: busyForAI(data.busy), now: new Date().toLocaleString(),
      })
      if (!Array.isArray(out.options)) throw new Error('The AI gave an unreadable answer. Please try again.')
      setOpts(out.options)
    } catch (err) { setError(err.message) }
    setBusy(false)
  }
  const startOpt = (o) => setFocus({ taskId: tasks.some((t) => t.id === o.taskId) ? o.taskId : null, title: o.title, method: o.method, why: o.why, minutes: o.minutes, at: Date.now() })
  const startTask = (t) => setFocus({ taskId: t.id, title: t.title, method: 'Your choice', why: 'You started it from your task list.', minutes: t.hours ? Math.round(t.hours * 60) : undefined, at: Date.now() })
  const update = (id, patch) => setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const move = (id, qi) => update(id, qi === ''
    ? { important: undefined, urgent: undefined, goalId: undefined, reason: undefined, manual: false }
    : { important: qi < 2, urgent: qi % 2 === 0, manual: true, reason: 'You placed this here yourself.' })
  const addQuick = (e) => { e.preventDefault(); if (quick.trim()) { setTasks(addTasks(tasks, [{ title: quick.trim() }])); setQuick('') } }
  const todays = [...open].sort((a, b) => (quadrant(a) ?? 9) - (quadrant(b) ?? 9) || (a.due || '9').localeCompare(b.due || '9')).slice(0, 5)
  const card = 'px-sunk p-3'
  const link = 'min-h-11 underline hover:text-yoru-0'

  return (
    <>
      <header className="mb-4 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:gap-8">
        <div className="order-2 min-w-0 flex-1 lg:order-1 lg:pt-2">
          <h1 className="text-4xl leading-8 md:text-5xl md:leading-[56px]">{greeting()}.</h1>
          <p className="mt-2 text-slate-700">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}. {finding}</p>
          {missed.length > 0 && <button className={`${btn} ${BLUE} mt-3`} onClick={onReplan}>Replan my week</button>}
        </div>
        <div className="order-1 lg:order-2"><Scene avatar={data.avatar} /></div>
      </header>

      {guide && !goals.length && !tasks.length && !deadlines.length && (
        <div className="px-backdrop fixed inset-0 z-40 flex items-end justify-center sm:items-center" onClick={closeGuide} onKeyDown={(e) => e.key === 'Escape' && closeGuide()}>
          <section role="dialog" aria-modal="true" aria-label="Getting started" className="px-panel w-full max-w-md bg-yuki-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base">Start in three steps</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
              <li>Add one goal you care about. <button className={link} onClick={() => go('Goals')}>Goals</button></li>
              <li>Add a task with a date, or import a syllabus. <button className={link} onClick={() => go('Tasks')}>Tasks</button></li>
              <li>Ask the <button className={link} onClick={() => { closeGuide(); openAgent() }}>AI agent</button> to plan your week.</li>
            </ol>
            <button autoFocus className={`${btn} ${BLUE} mt-4 w-full`} onClick={closeGuide}>Got it</button>
          </section>
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 lg:mb-6 lg:grid-cols-12 lg:gap-x-6">
        <Tile label="Do first" caption={doFirst.length ? 'Due soon, high impact' : 'Nothing urgent'}><button className="min-h-11 hover:text-yoru-0" onClick={() => goTab('Tasks')} aria-label={`${doFirst.length} to do first. Open Tasks`}>{doFirst.length}</button></Tile>
        <Tile label="Due this week" caption={thisWeek[0] ? `Next: ${thisWeek[0].title}` : 'Nothing due'}><span>{thisWeek.length}</span></Tile>
        <Tile label="Done this week" caption={stats.streak > 1 ? `${stats.streak}-day streak` : stats.week ? 'Nice and steady' : 'Tick one off'}><span>{stats.week}</span></Tile>
        <Tile label="Free time today" caption={`hours. Blank uses your ${data.freeHours ?? 4} h a day`}>
          <input type="number" min="0" max="24" step="0.5" aria-label="Free time today in hours" className={`${input} w-24`} placeholder={String(data.freeHours ?? 4)} value={freeTodayOf(data) ?? ''}
            onChange={(e) => setData((d) => ({ ...d, freeToday: e.target.value === '' ? undefined : { date: todayStr(), hours: +e.target.value } }))} />
        </Tile>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-12">
        <section className={`${panel} !p-3 lg:col-span-9 lg:!p-4`} aria-label="Right now">
          <h2 className="px-tab px-tab-beni inline-block">Right now</h2>
          {cur ? (
            <div className={`${card} mt-3`}>
              <p className="text-slate-700">{focus ? 'You are doing' : pick ? 'You picked' : 'Try'}</p>
              <p className="mt-1 break-words text-2xl">{cur.title}</p>
              <p className="mt-1 text-slate-700">{cur.method}{cur.minutes ? `, ${cur.minutes} min` : ''}. {cur.why}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className={`${btn} ${BLUE}`} onClick={focus ? finish : () => setFocus({ ...cur, at: Date.now() })}>{focus ? 'Done' : 'Start'}</button>
                {focus && <button className={`${btn} ${ghost}`} onClick={openTimer}>Open timer</button>}
                {(focus || pick) && <button className={`${btn} ${ghost}`} onClick={() => (focus ? setFocus(null) : setPick(null))}>{focus ? 'Stop' : 'Clear pick'}</button>}
              </div>
            </div>
          ) : <p className="mt-3 text-slate-700">Nothing pending. Add a task below, or ask the AI agent to plan your day.</p>}

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1">Minutes free right now
              <input type="number" min="5" step="5" className={`${input} w-28`} value={minutes} onChange={(e) => setMinutes(+e.target.value)} />
            </label>
            <div className="flex flex-col gap-1">
              <span id="energy-label">Your energy right now</span>
              <div role="group" aria-labelledby="energy-label" className="px-seg">
                {['low', 'medium', 'high'].map((l) => (
                  <button key={l} aria-pressed={energy === l} className="px-btn capitalize"
                    onClick={() => { setEnergy(l); setData((d) => ({ ...d, energyLog: logEnergy(d.energyLog, l) })) }}>{l}</button>
                ))}
              </div>
            </div>
            <button className={`${btn} ${ghost}`} onClick={openAgent}>Ask the AI agent to plan my day</button>
          </div>

          <details className="mt-4">
            <summary className="underline">More ways to choose</summary>
            <div className="mt-3 space-y-4">
              <ul className="grid gap-3 sm:grid-cols-2">
                {picks.map(({ m, r }) => (
                  <li key={m.name} className={`${card} flex flex-col justify-between`}>
                    <div>
                      <p>{m.name}</p>
                      <p className="text-xs text-slate-700">{m.how}</p>
                      {r ? <>
                        <p className="mt-1 break-words">{r.t.title}</p>
                        <p className="mt-1 text-xs text-slate-700">{r.t.hours ? `${r.t.hours}h. ` : ''}{r.why}</p>
                      </> : <p className="mt-1 text-slate-700">{open.length ? 'Nothing fits your minutes.' : 'No open tasks yet.'}</p>}
                    </div>
                    {r && <button className={`${btn} ${BLUE} mt-3 self-start`} onClick={() => choose(m, r.t, r.why)}>Pick this</button>}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <button className={`${btn} ${ghost}`} disabled={busy} onClick={ask}>{busy ? 'Thinking…' : opts ? 'Ask the AI again' : 'Ask the AI for a second opinion'}</button>
                <span className="text-xs text-slate-700">It also weighs your mood, calendar and hobbies.</span>
                {error && <span role="alert" className="text-danger">{error}</span>}
              </div>
              {opts && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {opts.map((o, i) => (
                    <li key={i} className={`${card} flex flex-col justify-between`}>
                      <div>
                        <p>{o.method}</p>
                        <p className="mt-1 break-words">{o.title}</p>
                        <p className="mt-1 text-xs text-slate-700">{o.minutes ? `${o.minutes} min. ` : ''}{o.why}</p>
                      </div>
                      <button className={`${btn} ${BLUE} mt-3 self-start`} onClick={() => startOpt(o)}>Do this now</button>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <p className="mb-1">Your energy pattern</p>
                <Energy log={data.energyLog || []} reset={() => setData((d) => ({ ...d, energyLog: [] }))} />
              </div>
            </div>
          </details>
        </section>

        <section className="lg:col-span-3" aria-label="Coming up">
          <div className="flex items-center justify-between">
            <h2>Coming up <span className="text-xs text-slate-700">{soon.length}</span></h2>
            <button className={link} onClick={() => goTab('Tasks')}>View all</button>
          </div>
          <ul className="mt-3">
            {soon.slice(0, 5).map((x) => (
              <li key={x.id} className="px-rule py-2">
                <p className="break-words">{x.title}</p>
                <p className="text-xs text-slate-700">{x.kind}, {x.date === today ? 'today' : fmtDate(x.date)}</p>
              </li>
            ))}
            {!soon.length && <li className="text-slate-700">Nothing due soon. Add a task with a date, or ask the AI agent to plan tomorrow.</li>}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-6" aria-label="Your tasks">
          <div className="flex items-center justify-between">
            <h2>Your tasks <span className="text-xs text-slate-700">{open.length}</span></h2>
            <button className={link} onClick={() => goTab('Tasks')}>View all</button>
          </div>
          <form className="mt-3 flex gap-2" onSubmit={addQuick}>
            <input className={`${input} min-w-0 flex-1`} placeholder="Add a task" aria-label="Task" value={quick} onChange={(e) => setQuick(e.target.value)} />
            <button className={`${btn} ${BLUE}`}>Add task</button>
          </form>
          <ul className="mt-3">
            {todays.map((t) => <Row key={t.id} t={t} update={update} move={move} onStart={startTask} onEdit={() => goTab('Tasks')} onDelete={() => deleteTask(t)} />)}
            {!todays.length && <li className="text-slate-700">Nothing due today. Add a task or ask the AI agent to plan tomorrow.</li>}
          </ul>
        </section>
        <div className="lg:col-span-6"><Review tasks={tasks} goals={goals} onAgent={onReview} /></div>
      </div>
    </>
  )
}
