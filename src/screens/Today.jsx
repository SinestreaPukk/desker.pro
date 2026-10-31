import { useState, useRef, useEffect } from 'react'
import { post } from '../api.js'
import { addTasks, doneStats, isMissed } from '../tasks.js'
import { logEnergy } from '../energy.js'
import { profile, plannerOf, realityCheck, record, addSignal, rhythmOf, isOff } from '../rhythm.js'
import { METHODS } from '../methods.js'
import { Home, KodamaSettings } from '../components/KodamaHome.jsx'
import Ritual from '../components/Ritual.jsx'
import { track } from '../analytics.js'
import { nameOf, lineFor, ritualDue, sceneChoice } from '../kodama.js'
import BoxHead from '../components/BoxHead.jsx'
import RhythmCard from '../components/RhythmCard.jsx'
import Review from '../Review.jsx'
import { overlaps } from '../schedule.js'
import Row from '../components/Row.jsx'
import { BLUE, btn, ghost, input, panel, LEVELS } from '../ui.js'
import { quadrant, patternOf, busyForAI, freeTodayOf, todayStr, fromCalendar, fmtDate } from '../shared.jsx'

const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

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
  const rhythm = profile(data)
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const predicted = rhythm.off || !rhythm.energy.confident ? null : rhythm.energy.levelAt(todayStr(), nowMin) // from the user's own check-ins; only said once there are enough
  const [energy, setEnergy] = useState(predicted || 'medium')
  const signal = (k, task) => setData((d) => record(d, (r) => addSignal(r, { k, at: Date.now(), task })))
  // At most two unprompted "how is your energy?" questions a day, never at night, never twice within 3 hours of a tap.
  const [askEnergy, setAskEnergy] = useState(() => {
    const day = todayStr(), seen = data.rhythm?.ask, n = seen?.day === day ? seen.n : 0, h = new Date().getHours()
    return !isOff(data) && n < 2 && h >= 8 && h < 21 && Date.now() - ((data.energyLog || []).at(-1)?.at || 0) > 3 * 36e5 && tasks.some((t) => !t.done && !t.fun)
  })
  useEffect(() => {
    if (askEnergy) setData((d) => record(d, (r) => ({ ...r, ask: { day: todayStr(), n: (r.ask?.day === todayStr() ? r.ask.n : 0) + 1 } })))
  }, [])
  const tap = (l, prompted) => { track('energy_logged', { prompted: !!prompted }); setEnergy(l); setAskEnergy(false); setData((d) => ({ ...d, energyLog: logEnergy(d.energyLog, l) })) }
  const [opts, setOpts] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [quick, setQuick] = useState('')
  const quickRef = useRef(null)
  const [seen, setSeen] = useState(() => { try { return localStorage.hintsSeen || '' } catch { return '' } }) // next-step tips already dismissed
  const dismissHint = (k) => { const v = `${seen} ${k}`; setSeen(v); try { localStorage.hintsSeen = v } catch { /* storage blocked: it shows again next visit */ } }
  const [guide, setGuide] = useState(() => { try { return !localStorage.guideSeen } catch { return true } }) // shown once, over the dashboard
  const closeGuide = () => { setGuide(false); try { localStorage.guideSeen = '1' } catch { /* storage blocked: it shows again next visit */ } }
  const go = (tab) => { closeGuide(); goTab(tab) }
  const addFirst = () => { closeGuide(); setTimeout(() => quickRef.current?.focus(), 0) }

  const today = todayStr()
  const open = tasks.filter((t) => !t.done && !t.fun)
  const doFirst = open.filter((t) => quadrant(t) === 0)
  const missed = tasks.filter((t) => isMissed(t))
  const stats = doneStats(tasks)
  const clashes = overlaps(tasks, data.busy || []).length // planned times that overlap (older plans, or edits by hand)
  const weekEnd = new Date(Date.now() + 7 * 864e5).toLocaleDateString('sv')
  const soon = [
    ...deadlines.map((d) => ({ id: `d${d.id}`, title: d.title, date: d.date, kind: 'Deadline' })),
    ...open.filter((t) => t.due).map((t) => ({ id: `t${t.id}`, title: t.title, date: t.due, kind: 'Task' })),
  ].filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const thisWeek = soon.filter((x) => x.date <= weekEnd)
  const finding = clashes
    ? `${clashes === 1 ? 'Two things are' : 'Some things are'} planned at the same time. Replan to fix it.`
    : missed.length
    ? `${missed.length} planned task${missed.length === 1 ? '' : 's'} slipped past ${missed.length === 1 ? 'its' : 'their'} time.`
    : thisWeek.length ? `${thisWeek[0].title} is due ${thisWeek[0].date === today ? 'today' : fmtDate(thisWeek[0].date)}.`
    : doFirst.length ? `${doFirst.length} thing${doFirst.length === 1 ? '' : 's'} to do first.`
    : open.length ? `${open.length} open task${open.length === 1 ? '' : 's'}, none urgent.` : 'Nothing on your list yet. Add a task to begin.'

  const cal = fromCalendar(tasks)
  const picks = METHODS.map((m) => ({ m, r: m.pick(tasks, { minutes, energy }) }))
  const lead = picks.find((p) => p.r)
  const cur = focus || pick || cal || (lead && { taskId: lead.r.t.id, title: lead.r.t.title, method: lead.m.name, why: lead.r.why, minutes: lead.r.t.hours ? Math.round(lead.r.t.hours * 60) : undefined })
  const check = realityCheck(tasks, plannerOf(data), today, freeTodayOf(data) ?? data.freeHours ?? 4)
  const finish = () => {
    if (cur.taskId) setTasks(tasks.map((t) => (t.id === cur.taskId ? { ...t, done: true } : t)))
    setFocus(null)
  }
  const choose = (m, t, why) => { if (cur && !focus && !pick && cur.taskId !== t.id) signal('skip', cur.taskId); setPick({ taskId: t.id, title: t.title, method: m.name, why, minutes: t.hours ? Math.round(t.hours * 60) : undefined }) }
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
  const idle = !cur && !open.length // nothing to choose from: the pick controls would do nothing
  const hint = [
    ['goals', open.length >= 3 && !goals.length, 'Goals tell Desker what matters most, so it can rank your tasks.', 'Add a goal', () => goTab('Goals')],
    ['ai', open.length >= 3, 'Your kodama can plan your week around your deadlines and free time.', 'Talk to your kodama', openAgent],
    ['projects', deadlines.length >= 2 && !(data.projects || []).length, 'Juggling a course or group project with several deadlines? A project keeps them together.', 'Start a project', () => goTab('Projects')],
  ].find(([k, ok]) => ok && !seen.split(' ').includes(k))
  const card = 'px-rule pb-3'
  const ROW = 'flex flex-wrap items-start justify-between gap-x-4 gap-y-3' // text on the left, its buttons on the right
  const ACT = 'ml-auto flex shrink-0 flex-wrap justify-end gap-2'
  const link = 'min-h-11 underline hover:text-yoru-0'

  return (
    <>
      <header className="mb-4 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:gap-8">
        <div className="order-2 min-w-0 flex-1 lg:order-1 lg:pt-2">
          <h1 className="text-4xl leading-8 md:text-5xl md:leading-[56px]">{greeting()}.</h1>
          <p className="mt-2 text-slate-700">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}. {finding}</p>
          <p className="px-sunk mt-3 max-w-md break-words px-3 py-2" role="status"><span className="block text-xs text-slate-700">{nameOf(data)}</span>{lineFor(data, { focusing: !!focus })}</p>
          <KodamaSettings data={data} setData={setData} />
          {(missed.length > 0 || clashes > 0 || check?.over) && <button className={`${btn} ${BLUE} mt-3`} onClick={onReplan}>Replan my week</button>}
        </div>
        <div className="order-1 lg:order-2"><Home data={data} focusing={!!focus} heavy={!!check?.over} view={sceneChoice(data)} /></div>
      </header>

      {guide && !goals.length && !tasks.length && !deadlines.length && (
        <div className="px-backdrop fixed inset-0 z-40 flex items-end justify-center sm:items-center" onClick={closeGuide} onKeyDown={(e) => e.key === 'Escape' && closeGuide()}>
          <section role="dialog" aria-modal="true" aria-label="Getting started" className="px-panel w-full max-w-md bg-yuki-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base">Start with one thing to do</h2>
            <p className="mt-2 text-slate-700">Add a task, or a deadline if it has a date you cannot miss. Desker then suggests what to do next, right here.</p>
            <p className="mt-2 text-slate-700">Goals, projects and your kodama can wait until you have a few tasks.</p>
            <button autoFocus className={`${btn} ${BLUE} mt-4 w-full`} onClick={addFirst}>Add my first task</button>
            <div className="mt-2 flex flex-wrap justify-between gap-2">
              <button className={link} onClick={() => go('Tasks')}>Add a deadline instead</button>
              <button className={link} onClick={closeGuide}>Not now</button>
            </div>
          </section>
        </div>
      )}
      <details className="mb-4 lg:mb-6">
        <summary className="underline">This week at a glance</summary>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-12 lg:gap-x-6">
        <Tile label="Do first" caption={doFirst.length ? 'Due soon, high impact' : 'Nothing urgent'}><button className="min-h-11 hover:text-yoru-0" onClick={() => goTab('Tasks')} aria-label={`${doFirst.length} to do first. Open Tasks`}>{doFirst.length}</button></Tile>
        <Tile label="Due this week" caption={thisWeek[0] ? `Next: ${thisWeek[0].title}` : 'Nothing due'}><span>{thisWeek.length}</span></Tile>
        <Tile label="Done this week" caption={stats.streak > 1 ? `${stats.streak}-day streak` : stats.week ? 'Nice and steady' : 'Tick one off'}><span>{stats.week}</span></Tile>
        <Tile label="Free time today" caption={`hours. Blank uses your ${data.freeHours ?? 4} h a day`}>
          <input type="number" min="0" max="24" step="0.5" aria-label="Free time today in hours" className={`${input} w-24 text-base`} placeholder={String(data.freeHours ?? 4)} value={freeTodayOf(data) ?? ''}
            onChange={(e) => setData((d) => ({ ...d, freeToday: e.target.value === '' ? undefined : { date: todayStr(), hours: +e.target.value } }))} />
        </Tile>
        </div>
      </details>

      <div className="mb-6 grid gap-6 lg:grid-cols-12">
        <section className={`${panel} !p-3 lg:col-span-9 lg:!p-4`} aria-label="Right now">
          <h2 className="px-tab px-tab-ando inline-block">Right now</h2>
          {askEnergy && (
            <div role="group" aria-label="How is your energy" className="px-rule mt-3 flex flex-wrap items-center gap-2 pb-3">
              <span>How is your energy right now?</span>
              <div className="px-seg">{['low', 'medium', 'high'].map((l) => <button key={l} className="px-btn capitalize" onClick={() => tap(l, true)}>{l}</button>)}</div>
              <button className={`${btn} ml-auto`} onClick={() => setAskEnergy(false)}>Not now</button>
            </div>
          )}
          {cur ? (
            <div className={`${card} ${ROW} mt-3`}>
              <div className="min-w-0 flex-1 basis-60">
                <p className="text-slate-700">{focus ? 'You are doing' : pick ? 'You picked' : 'Do this next'}</p>
                <p className="mt-1 break-words text-2xl">{cur.title}</p>
                <p className="mt-1 text-slate-700">{cur.method}{cur.minutes ? `, ${cur.minutes} min` : ''}. {cur.why}</p>
              </div>
              <div className={ACT}>
                <button className={`${btn} ${BLUE}`} onClick={focus ? finish : () => { signal('accept', cur.taskId); track('right_now_started', { via: cur.method === 'Calendar plan' ? 'calendar' : pick ? 'pick' : 'auto' }); setFocus({ ...cur, at: Date.now() }) }}>{focus ? 'Done' : 'Start'}</button>
                {focus && <button className={`${btn} ${ghost}`} onClick={openTimer}>Open timer</button>}
                {(focus || pick) && <button className={`${btn} ${ghost}`} onClick={() => (focus ? setFocus(null) : setPick(null))}>{focus ? 'Stop' : 'Clear pick'}</button>}
              </div>
            </div>
          ) : !tasks.length && !deadlines.length ? (
            <div className={`${card} ${ROW} mt-3`}>
              <div className="min-w-0 flex-1 basis-60">
                <p className="text-2xl">Nothing to pick from yet</p>
                <p className="mt-1 text-slate-700">Add your first task or deadline. Desker will then suggest what to do next, right here.</p>
              </div>
              <div className={ACT}>
                <button className={`${btn} ${BLUE}`} onClick={addFirst}>Add a task</button>
                <button className={`${btn} ${ghost}`} onClick={() => goTab('Tasks')}>Add a deadline</button>
              </div>
            </div>
          ) : !tasks.length && deadlines.length ? (
            <div className={`${card} ${ROW} mt-3`}>
              <div className="min-w-0 flex-1 basis-60">
                <p className="text-2xl">{soon[0] ? `${soon[0].title} is next` : 'Your deadlines are set'}</p>
                <p className="mt-1 text-slate-700">Break it into tasks and Desker can tell you what to do first.</p>
              </div>
              <div className={ACT}><button className={`${btn} ${BLUE}`} onClick={() => goTab('Tasks')}>Break it into tasks</button><button className={`${btn} ${ghost}`} onClick={addFirst}>Add a task</button></div>
            </div>
          ) : <p className="mt-3 text-slate-700">Nothing pending. Add a task below, or ask your kodama to plan your day.</p>}

          {!idle && <><div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1">Minutes free right now
              <input type="number" min="5" step="5" className={`${input} w-28`} value={minutes} onChange={(e) => setMinutes(+e.target.value)} />
            </label>
            <div className="flex flex-col gap-1">
              <span id="energy-label">Your energy right now</span>
              <div role="group" aria-labelledby="energy-label" className="px-seg">
                {['low', 'medium', 'high'].map((l) => (
                  <button key={l} aria-pressed={energy === l} className="px-btn capitalize"
                    onClick={() => tap(l)}>{l}</button>
                ))}
              </div>
              {predicted && <span className="text-xs text-slate-700">Usually {predicted} around now. Tap to correct.</span>}
            </div>
          </div>

          <details className="mt-4">
            <summary className="underline">Other ways to choose</summary>
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
              <button className={link} onClick={() => goTab('Rhythm')}>See your energy pattern</button>
            </div>
          </details></>}
        </section>

        <section className={`${panel} !p-3 lg:col-span-3 lg:!p-4`} aria-label="Coming up">
          <BoxHead tab={`Coming up ${soon.length}`} tabClass="px-tab-matsu" line="Dates to keep in mind, soonest first.">
            <button className={link} onClick={() => goTab('Tasks')}>View all</button>
          </BoxHead>
          <ul className="mt-3">
            {soon.slice(0, 5).map((x) => (
              <li key={x.id} className="px-rule py-2">
                <p className="break-words">{x.title}</p>
                <p className="text-xs text-slate-700">{x.kind}, {x.date === today ? 'today' : fmtDate(x.date)}</p>
              </li>
            ))}
            {!soon.length && <li className="text-slate-700">Nothing due soon. Add a task with a date, or ask your kodama to plan tomorrow.</li>}
          </ul>
        </section>
      </div>

      {ritualDue(data) && <Ritual key={ritualDue(data)} kind={ritualDue(data)} data={data} setData={setData} onReplan={onReplan} />}

      <div className="grid gap-6 lg:grid-cols-12">
        <section className={`${panel} !p-3 lg:col-span-6 lg:!p-4`} aria-label="Your tasks">
          <BoxHead tab={`Your tasks ${open.length}`} tabClass="px-tab-matsu" line="Type what you need to do. Press Start on one to begin it.">
            <button className={link} onClick={() => goTab('Tasks')}>View all</button>
          </BoxHead>
          <form className="mt-3 flex gap-2" onSubmit={addQuick}>
            <input className={`${input} min-w-0 flex-1`} placeholder="Add a task (press N)" aria-label="Task" ref={quickRef} value={quick} onChange={(e) => setQuick(e.target.value)} />
            <button className={`${btn} ${BLUE}`}>Add task</button>
          </form>
          <ul className="mt-3">
            {todays.map((t) => <Row key={t.id} t={t} update={update} move={move} onStart={startTask} onEdit={() => goTab('Tasks')} onDelete={() => deleteTask(t)} />)}
            {!todays.length && <li className="text-slate-700">{tasks.length ? 'Nothing due today. Add a task or ask your kodama to plan tomorrow.' : 'No tasks yet. Type one above and press Add task.'}</li>}
          </ul>
          {hint && (
            <div role="note" className={`px-rule ${ROW} mt-3 pb-3`}>
              <p className="min-w-0 flex-1 basis-60 text-slate-700">{hint[2]}</p>
              <div className={ACT}>
                <button className={`${btn} ${ghost}`} onClick={() => { dismissHint(hint[0]); hint[4]() }}>{hint[3]}</button>
                <button className={btn} onClick={() => dismissHint(hint[0])}>Not now</button>
              </div>
            </div>
          )}
          <div className="mt-6"><RhythmCard data={data} onOpen={() => goTab('Rhythm')} /></div>
        </section>
        <div className="flex flex-col gap-6 lg:col-span-6">
          <Review tasks={tasks} goals={goals} onAgent={onReview} />
        </div>
      </div>
    </>
  )
}
