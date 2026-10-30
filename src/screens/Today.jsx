import { useState } from 'react'
import { post } from '../api.js'
import { addTasks, doneStats, isMissed } from '../tasks.js'
import { logEnergy, energyProfile, ranges } from '../energy.js'
import { METHODS } from '../methods.js'
import { fmtDuration, relDate, fmtDate } from '../format.js'
import { input, LEVELS } from '../ui.js'
import { Button, Card, EmptyState, ReasonLine, StatTile } from '../components/ui.jsx'
import Mirror from './Mirror.jsx'
import GetStarted, { stepsOf } from './GetStarted.jsx'
import { quadrant, patternOf, busyForAI, freeTodayOf, todayStr, fromCalendar } from '../shared.jsx'

const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

function Energy({ log, reset }) {
  const [sure, setSure] = useState(false)
  const p = energyProfile(log)
  return (
    <div className="text-sm">
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
            ? <p className="mt-2" role="alert">Delete all {log.length} check-ins? <Button variant="destructive" onClick={() => { reset(); setSure(false) }}>Delete</Button> <Button variant="secondary" onClick={() => setSure(false)}>Cancel</Button></p>
            : <Button variant="ghost" className="mt-2" onClick={() => setSure(true)}>Reset energy data</Button>}
        </>
      )}
    </div>
  )
}

// Free time today: a real number with a visible Edit control (blank = the daily default).
function FreeToday({ data, setData, planned }) {
  const [edit, setEdit] = useState(false)
  const set = freeTodayOf(data)
  const hours = set ?? data.freeHours ?? 4
  const save = (v) => setData((d) => ({ ...d, freeToday: v === '' ? undefined : { date: todayStr(), hours: +v } }))
  return (
    <StatTile label="Free time today"
      value={edit
        ? <input autoFocus type="number" min="0" max="24" step="0.5" aria-label="Free time today in hours" className={`${input} w-24 !py-1 text-base`} defaultValue={hours}
            onBlur={(e) => { save(e.target.value); setEdit(false) }} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        : fmtDuration(hours)}
      context={edit ? 'Hours. Press Enter to save' : planned > 0 ? `${fmtDuration(planned)} of it planned` : set === undefined ? 'Your usual day' : 'Set for today'}
      action={!edit && <Button variant="ghost" className="!px-3 !py-1" aria-label="Edit free time today" onClick={() => setEdit(true)}>Edit</Button>} />
  )
}

// Today: one question, "what should I do right now?", with the week around it.
export default function Today({ data, setData, tasks, goals, deadlines, focus, pick, setFocus, setPick, setTasks, goTab, openTimer, openAgent, onReplan, onReview, onGuide }) {
  const [minutes, setMinutes] = useState(60)
  const [energy, setEnergy] = useState('medium')
  const [opts, setOpts] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [quick, setQuick] = useState('')
  const [linking, setLinking] = useState(false)
  const [hidden, setHidden] = useState(() => { try { return !!localStorage.setupHidden } catch { return false } })

  const today = todayStr()
  const open = tasks.filter((t) => !t.done && !t.fun)
  const doFirst = open.filter((t) => quadrant(t) === 0)
  const overdue = open.filter((t) => isMissed(t) || (t.due && t.due < today))
  const stats = doneStats(tasks)
  const weekEnd = new Date(Date.now() + 7 * 864e5).toLocaleDateString('sv')
  const dated = [
    ...deadlines.filter((d) => !d.done).map((d) => ({ id: `d${d.id}`, title: d.title, date: d.date, kind: 'Deadline' })),
    ...open.map((t) => ({ id: `t${t.id}`, task: t, title: t.title, date: t.when || t.due, kind: 'Task' })),
  ]
  const thisWeek = dated.filter((x) => x.date >= today && x.date <= weekEnd).sort((a, b) => a.date.localeCompare(b.date))
  const plannedToday = tasks.filter((t) => !t.done && t.when === today).reduce((a, t) => a + (t.hours || 1), 0)

  const cal = fromCalendar(tasks)
  const picks = METHODS.map((m) => ({ m, r: m.pick(tasks, { minutes, energy }) }))
  const lead = picks.find((p) => p.r)
  const cur = focus || pick || cal || (lead && { taskId: lead.r.t.id, title: lead.r.t.title, method: lead.m.name, why: lead.r.why, minutes: lead.r.t.hours ? Math.round(lead.r.t.hours * 60) : undefined })
  const curTask = cur?.taskId && tasks.find((t) => t.id === cur.taskId)
  const coming = dated.filter((x) => !(cur?.taskId && x.task?.id === cur.taskId))
    .sort((a, b) => (a.date || '9').localeCompare(b.date || '9')).slice(0, 6)

  const update = (id, patch) => setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const finish = () => { if (cur.taskId) update(cur.taskId, { done: true }); setFocus(null) }
  const choose = (m, t, why) => setPick({ taskId: t.id, title: t.title, method: m.name, why, minutes: t.hours ? Math.round(t.hours * 60) : undefined })
  const startOpt = (o) => setFocus({ taskId: tasks.some((t) => t.id === o.taskId) ? o.taskId : null, title: o.title, method: o.method, why: o.why, minutes: o.minutes, at: Date.now() })
  const startTask = (t) => setFocus({ taskId: t.id, title: t.title, method: 'Your choice', why: 'You started it yourself.', minutes: t.hours ? Math.round(t.hours * 60) : undefined, at: Date.now() })
  const addQuick = (e) => { e.preventDefault(); if (quick.trim()) { setTasks(addTasks(tasks, [{ title: quick.trim() }])); setQuick('') } }
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

  // Something for you: one thing from the user's fun tasks, hobbies or happiness goals, rotating daily.
  // ponytail: day-of-year rotation, not a gap-fitting search; upgrade if people ignore it. Hidden when less than 30 min is left today.
  const gap = (freeTodayOf(data) ?? data.freeHours ?? 4) - plannedToday
  const funPool = [
    ...tasks.filter((t) => t.fun && !t.done && (!t.when || t.when >= today)).map((t) => ({ task: t, title: t.title })),
    ...(data.hobbies || []).map((h) => ({ title: h.title })),
    ...goals.filter((g) => g.happiness).map((g) => ({ title: g.title, goalId: g.id })),
  ]
  const fun = funPool.length && gap >= 0.5 ? funPool[Math.floor(Date.now() / 864e5) % funPool.length] : null

  const steps = stepsOf({ data, goals, tasks }, !!cur)
  const newUser = !goals.length && !tasks.length && !deadlines.length
  const setup = <GetStarted steps={steps} goals={goals} tasks={tasks} setTasks={setTasks} goTab={goTab} onGuide={onGuide} hero={newUser}
    onDismiss={() => { setHidden(true); try { localStorage.setupHidden = '1' } catch { /* blocked: shows again next visit */ } }} />

  const header = (
    <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 md:mb-6">
      <div>
        <h1 className="greeting text-xl">{greeting()}.</h1>
        <p className="text-sm text-slate-600">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>
      {/* TODO(roadmap: streaks): swap this derived streak for the stored one */}
      {stats.streak > 1 && <span className="rounded-full bg-pale px-3 py-1 text-sm font-medium text-accent-dark">{stats.streak}-day streak</span>}
    </header>
  )
  if (newUser) return <>{header}{setup}</>

  const card = 'rounded-xl border border-line bg-white p-4'
  return (
    <>
      {header}
      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-8">
          <section aria-labelledby="do-now" className="rounded-2xl bg-panel p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id="do-now" className="text-base font-semibold">Do now</h2>
              {(focus || pick) && <span className="rounded-full bg-white px-3 py-0.5 text-xs font-medium">{focus ? 'In progress' : 'You picked this'}</span>}
            </div>
            {cur ? (
              <div className="mt-3">
                <p className="break-words text-xl font-medium">{cur.title}</p>
                <div className="mt-2 space-y-1">
                  {curTask && <ReasonLine task={curTask} goals={goals} onLink={() => (goals.length ? setLinking(true) : goTab('Goals'))} />}
                  {linking && curTask && (
                    <label className="flex flex-wrap items-center gap-2 text-sm">Link to a goal
                      <select autoFocus className={input} defaultValue="" onChange={(e) => { if (e.target.value) { update(curTask.id, { goalId: +e.target.value }); setLinking(false) } }}>
                        <option value="">Choose…</option>
                        {goals.map((g) => <option key={g.id} value={g.id}>{LEVELS[g.level].name}: {g.title}</option>)}
                      </select>
                    </label>
                  )}
                  <p className="text-sm text-slate-600">{cur.minutes ? `${fmtDuration(cur.minutes / 60)} · ` : ''}{cur.why}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {/* TODO(roadmap: focus timer): the Phase 1 timer plugs in here. Today setFocus opens the existing simple timer. */}
                  <Button className="!px-8 !py-3 !text-base" onClick={focus ? finish : () => setFocus({ ...cur, at: Date.now() })}>{focus ? 'Done' : 'Start'}</Button>
                  {focus && <Button variant="secondary" onClick={openTimer}>Open timer</Button>}
                  {(focus || pick) && <Button variant="ghost" onClick={() => (focus ? setFocus(null) : setPick(null))}>{focus ? 'Stop' : 'Clear pick'}</Button>}
                  <Button variant="secondary" onClick={() => openAgent('Help me plan my day')}>Help me plan my day</Button>
                </div>
              </div>
            ) : (
              <div className="mt-3"><EmptyState title="Nothing to do right now" action={<Button variant="secondary" onClick={() => goTab('Tasks')}>Add a task</Button>}>Add a task and your next step shows up here.</EmptyState></div>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-accent">Adjust</summary>
              <div className="mt-3 flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1 text-sm">Minutes free right now
                  <input type="number" min="5" step="5" className={`${input} w-28`} value={minutes} onChange={(e) => setMinutes(+e.target.value)} />
                </label>
                <div className="flex flex-col gap-1 text-sm">
                  <span id="energy-label">Your energy right now</span>
                  <div role="group" aria-labelledby="energy-label" className="flex gap-1 rounded-full bg-white p-1">
                    {['low', 'medium', 'high'].map((l) => (
                      <Button key={l} variant="ghost" aria-pressed={energy === l} className={`!py-1 capitalize ${energy === l ? '!bg-pale font-medium !text-ink' : '!text-slate-600'}`}
                        onClick={() => { setEnergy(l); setData((d) => ({ ...d, energyLog: logEnergy(d.energyLog, l) })) }}>{l}</Button>
                    ))}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => { setEnergy('low'); openAgent("I'm feeling stressed") }}>I’m stressed / low energy</Button>
              </div>
            </details>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-accent">More ways to choose</summary>
              <div className="mt-3 space-y-4">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {picks.map(({ m, r }) => (
                    <li key={m.name} className={`${card} flex flex-col justify-between`}>
                      <div>
                        <p className="text-sm font-medium text-accent">{m.name} <span className="font-normal text-slate-700">· {m.how}</span></p>
                        {r ? <>
                          <p className="mt-1 break-words font-medium">{r.t.title}</p>
                          <p className="mt-1 text-sm text-slate-700">{r.t.hours ? `${fmtDuration(r.t.hours)} · ` : ''}{r.why}</p>
                        </> : <p className="mt-1 text-sm text-slate-600">{open.length ? 'Nothing fits your minutes.' : 'No open tasks yet.'}</p>}
                      </div>
                      {r && <Button className="mt-3 self-start" onClick={() => choose(m, r.t, r.why)}>Pick this</Button>}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" disabled={busy} onClick={ask}>{busy ? 'Thinking…' : opts ? 'Get another opinion' : 'Get a second opinion'}</Button>
                  <span className="text-sm text-slate-600">It also weighs your mood, calendar and hobbies.</span>
                  {error && <span role="alert" className="text-sm text-danger">{error}</span>}
                </div>
                {opts && (
                  <ul className="grid gap-3 sm:grid-cols-2" aria-live="polite">
                    {opts.map((o, i) => (
                      <li key={i} className={`${card} flex flex-col justify-between`}>
                        <div>
                          <p className="text-sm font-medium text-accent">{o.method}</p>
                          <p className="mt-1 break-words font-medium">{o.title}</p>
                          <p className="mt-1 text-sm text-slate-700">{o.minutes ? `${fmtDuration(o.minutes / 60)} · ` : ''}{o.why}</p>
                        </div>
                        <Button className="mt-3 self-start" onClick={() => startOpt(o)}>Do this now</Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div>
                  <p className="mb-1 text-sm font-medium">Your energy pattern</p>
                  <Energy log={data.energyLog || []} reset={() => setData((d) => ({ ...d, energyLog: [] }))} />
                </div>
              </div>
            </details>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Do First" value={doFirst.length}
              warn={overdue.length > 0} context={overdue.length ? `${overdue.length} overdue` : doFirst.length ? 'Due soon, high impact' : 'Nothing urgent'} />
            <StatTile label="Due this week" value={thisWeek.length}
              context={thisWeek[0] ? `Next: ${thisWeek[0].title}, ${relDate(thisWeek[0].date).toLowerCase()}` : 'Nothing due'} />
            <StatTile label="Done this week" value={stats.week}
              context={!stats.ever ? 'Tick one off to start your week' : stats.week > stats.last ? `${stats.week - stats.last} more than last week. Nice!` : stats.week === stats.last ? `Same as last week (${stats.last})` : `${stats.last - stats.week} fewer than last week (${stats.last})`} />
            <FreeToday data={data} setData={setData} planned={plannedToday} />
          </div>

          <Mirror tasks={tasks} goals={goals} overdue={overdue.length} onReview={onReview} onReplan={onReplan} onPlan={() => openAgent('Help me plan my day')} />
        </div>

        <div className="space-y-4 lg:col-span-4">
          <Card title="Coming up" action={<Button variant="ghost" className="!px-3 !py-1" onClick={() => goTab('Tasks')}>View all</Button>}>
            <form className="flex gap-2" onSubmit={addQuick}>
              <input className={`${input} min-w-0 flex-1`} placeholder="Add a task" aria-label="Add a task" value={quick} onChange={(e) => setQuick(e.target.value)} />
              <Button type="submit">Add</Button>
            </form>
            {coming.length ? (
              <ul className="mt-3 space-y-2">
                {coming.map((x) => {
                  const late = x.date && x.date < today
                  return (
                    <li key={x.id} className={`${card} flex items-start gap-3 !p-3`}>
                      {x.task ? <input type="checkbox" className="mt-0.5" aria-label={`Mark ${x.title} done`} onChange={() => update(x.task.id, { done: true })} /> : <span className="w-5 shrink-0" aria-hidden="true" />}
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm">{x.title}</p>
                        <p className={`text-xs ${late ? 'font-medium text-danger' : 'text-slate-600'}`}>{x.kind} · {x.date ? `${late ? 'Overdue: ' : ''}${relDate(x.date)}${late ? '' : ` · ${fmtDate(x.date)}`}` : 'No date'}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : <div className="mt-3"><EmptyState title="Nothing coming up">Type a task above, like “essay tomorrow”.</EmptyState></div>}
          </Card>

          {fun ? (
            <Card title="Something for you">
              <p className="break-words font-medium">{fun.title}</p>
              <p className="mt-1 text-sm text-slate-600">You have about {fmtDuration(gap)} free today. Rest counts too.</p>
              <div className="mt-3">
                {fun.task
                  ? <Button variant="secondary" onClick={() => startTask(fun.task)}>Start</Button>
                  : <Button variant="secondary" onClick={() => setTasks(addTasks(tasks, [{ title: fun.title, fun: true, when: today, hours: 0.5, goalId: fun.goalId }]))}>Add to today</Button>}
              </div>
            </Card>
          ) : !funPool.length && (
            <p className="px-1 text-sm text-slate-600">Nothing for fun yet. <button className="text-accent underline" onClick={() => goTab('Goals')}>Add things you enjoy on Goals</button>.</p>
          )}

          {!hidden && steps.some((s) => !s.done) && setup}
        </div>
      </div>
    </>
  )
}
