import { useState, useEffect } from 'react'
import { stateUrl } from './api.js'
import { settle } from './tasks.js'
import { applyPlan as applyReplan } from './replan.js'
import Replan from './Replan.jsx'
import Focus from './Focus.jsx'
import Settings from './Settings.jsx'
import { migrate } from './storage.js'
import { Icon } from './icons.jsx'
import { quadrant, patternOf, ratioOf, busyForAI, importCalendar, freeTodayOf } from './shared.jsx'
import { isMissed } from './tasks.js'
import Today from './screens/Today.jsx'
import Tasks from './screens/Tasks.jsx'
import Goals from './screens/Goals.jsx'
import Projects from './screens/Projects.jsx'
import { unlink } from './projects.js'
import Calendar from './screens/Calendar.jsx'
import Agent from './components/Agent.jsx'
import Guide from './guide/Guide.jsx'
import { addTasks } from './tasks.js'
import { BLUE, btn, ghost } from './ui.js'
import { Banner } from './art.jsx'

// One URL per section. The old /do-now lives on Today now.
const PATHS = { Today: '/today', Tasks: '/tasks', Goals: '/goals', Projects: '/projects', Calendar: '/calendar' }
const TABS = Object.keys(PATHS)
const tabOf = () => TABS.find((t) => PATHS[t] === location.pathname) || (location.pathname === '/deadlines' ? 'Tasks' : 'Today') // deadlines live in Tasks now

export default function App() {
  const [tab, setTabState] = useState(tabOf)
  const setTab = (t) => { if (t !== tab) history.pushState(null, '', PATHS[t]); setTabState(t); window.scrollTo({ top: 0 }) }
  useEffect(() => { const f = () => setTabState(tabOf()); addEventListener('popstate', f); return () => removeEventListener('popstate', f) }, [])
  useEffect(() => {
    document.title = `${tab} · Desker`
    if (location.pathname !== PATHS[tab]) history.replaceState(null, '', PATHS[tab]) // "/" and /do-now land on Today
  }, [tab])

  const [agentOpen, setAgentOpen] = useState(false)
  const [replanOpen, setReplanOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [fresh, setFresh] = useState(null) // goals just saved from the guide: { ids, offer }
  const [reviewReq, setReviewReq] = useState(0)
  const [, tick] = useState(0) // re-render each minute so "missed" flags stay current
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(id) }, [])
  const [cheer, setCheer] = useState(0) // bumps when Do First is cleared, to animate the logo
  const [toast, setToast] = useState(null) // { text, undo }
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(id)
  }, [toast])
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState(false)
  useEffect(() => {
    fetch(stateUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load your data')))).then((d) => setData(migrate(d))).catch((e) => setLoadError(e.message))
  }, [])
  // keep an imported calendar fresh (at most hourly)
  const stale = data?.sync?.url && Date.now() - data.sync.at > 36e5 ? data.sync.url : null
  useEffect(() => {
    if (stale) importCalendar({ url: stale }).then((busy) => setData((d) => ({ ...d, busy, sync: { ...d.sync, at: Date.now() } }))).catch(() => {})
  }, [stale])
  useEffect(() => {
    if (!data) return
    const id = setTimeout(() => {
      fetch(stateUrl, { method: 'PUT', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
        .then((r) => setSaveError(!r.ok)).catch(() => setSaveError(true))
    }, 500)
    return () => clearTimeout(id)
  }, [data])
  if (!data) return <p className="p-6 text-slate-600">{loadError || 'Loading…'}</p>

  const { goals, tasks } = data
  // drop a focus or pick whose task was deleted or finished elsewhere
  const live = (x) => x && (!x.taskId || tasks.some((t) => t.id === x.taskId && !t.done)) ? x : null
  const focus = live(data.focus)
  const pick = live(data.pick)
  const hobbies = data.hobbies || []
  const deadlines = data.deadlines || []
  const projects = data.projects || []
  const setProjects = (projects) => setData((d) => ({ ...d, projects }))
  const setDeadlines = (deadlines) => setData((d) => ({ ...d, deadlines }))
  const setFocus = (focus) => { setData((d) => ({ ...d, focus, pick: null })); setFocusOpen(!!focus) } // starting something opens the timer
  const addSpent = (id, hours) => hours > 0 && setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, spent: Math.round(((t.spent || 0) + hours) * 1000) / 1000 } : t)) }))
  const startTask = (t) => setFocus({ taskId: t.id, title: t.title, method: 'Your choice', why: 'You started it yourself.', minutes: t.hours ? Math.round(t.hours * 60) : undefined, at: Date.now() })
  const focusTask = focus && tasks.find((t) => t.id === focus.taskId)
  const missed = tasks.filter((t) => isMissed(t))
  const openReplan = () => { setAgentOpen(false); setTab('Calendar'); setReplanOpen(true) }
  const setPick = (pick) => setData((d) => ({ ...d, pick }))
  const setHobbies = (hobbies) => setData((d) => ({ ...d, hobbies }))
  const setGoals = (goals) => setData((d) => ({ ...d, goals }))
  // mode: 'resume' keeps the draft, 'fresh' wipes it; otherwise start (or retake with earlier answers kept)
  const openGuide = (mode) => {
    if (mode === 'skip') return setData((d) => ({ ...d, guide: { ...d.guide, skipped: true } }))
    setData((d) => ({ ...d, guide: mode === 'resume' ? d.guide : mode === 'fresh' ? undefined : { ...d.guide, step: 0, done: false, skipped: false, result: undefined } }))
    setAgentOpen(false); setTab('Goals'); setGuideOpen(true)
  }
  const saveGuide = (guide) => setData((d) => ({ ...d, guide: { ...guide, updatedAt: Date.now() } }))
  const finishGuide = (added) => {
    setData((d) => ({ ...d, goals: [...d.goals, ...added], guide: { ...d.guide, result: undefined, done: true } }))
    setGuideOpen(false); setFresh({ ids: added.map((g) => g.id), offer: added.some((g) => g.firstStep) })
    setTimeout(() => setFresh((f) => f && { ...f, ids: [] }), 5000)
  }
  const makeTasks = () => {
    setTasks(addTasks(tasks, goals.filter((g) => fresh.ids.includes(g.id) && g.firstStep).map((g) => ({ title: g.firstStep, goalId: g.id }))))
    setFresh(null)
  }
  const openReview = () => { setAgentOpen(true); setReviewReq((n) => n + 1) }
  // Every task change goes through settle(): it stamps doneAt, adds the next copy of finished repeating tasks, and feeds Undo.
  const setTasks = (next) => {
    const r = settle(tasks, next)
    const doFirst = (list) => list.some((t) => !t.done && !t.fun && quadrant(t) === 0)
    const cleared = r.finished.length > 0 && doFirst(tasks) && !doFirst(r.tasks)
    if (cleared) setCheer((n) => n + 1)
    setData((d) => ({ ...d, tasks: r.tasks }))
    if (r.finished.length) {
      const names = r.tasks.filter((t) => r.finished.includes(t.id)).map((t) => t.title)
      setToast({ text: `Done: ${names.length > 1 ? `${names.length} tasks` : names[0]}${r.spawned.length ? ' (next one added)' : ''}${cleared ? '. Do First is clear.' : ''}`,
        undo: () => { setData((d) => ({ ...d, tasks: settle(d.tasks, d.tasks.filter((t) => !r.spawned.includes(t.id)).map((t) => (r.finished.includes(t.id) ? { ...t, done: false } : t))).tasks })); setToast(null) } })
    }
  }
  const deleteTask = (t) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) }))
    setToast({ text: `Deleted: ${t.title}`, undo: () => { setData((d) => ({ ...d, tasks: [...d.tasks, t] })); setToast(null) } })
  }
  const logo = (cls) => <img key={cheer} src="/favicon.svg" alt="" className={`${cls} ${cheer ? 'cheer' : ''}`} />

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 hidden border-b border-line bg-white md:block">
        <div className="mx-auto max-w-[1400px] px-8 pt-3">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-3 rounded-xl py-1 pr-3 text-left" onClick={() => setTab('Today')} aria-label="Desker, go to Today">
            {logo('h-10 w-10')}
            <span><span className="block text-lg font-semibold leading-tight">Desker</span><span className="block text-xs text-slate-600">Student planner</span></span>
          </button>
          <div className="flex items-center gap-2">
            <button className={`${btn} ${ghost} flex items-center gap-2`} onClick={() => setAgentOpen(true)}><Icon name="Agent" />Ask the AI agent</button>
            <Settings data={data} setData={setData} />
          </div>
        </div>
        <nav className="-mb-px mt-2 flex gap-6" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t} className={`border-b-2 py-2 text-sm ${tab === t ? 'border-accent font-medium text-ink' : 'border-transparent text-slate-600 hover:text-ink'}`}
              aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        </div>
      </header>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-white px-4 md:hidden">
          <div className="flex items-center gap-2">{logo('h-8 w-8')}<span className="text-lg font-semibold">{tab}</span></div>
          <div className="flex items-center gap-1">
            <button className={`${btn} flex items-center gap-2 hover:bg-panel`} onClick={() => setAgentOpen(true)}><Icon name="Agent" />AI agent</button>
            <Settings data={data} setData={setData} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pb-32 pt-6 md:px-8 md:pt-8">
          {saveError && <p role="alert" className="mb-4 rounded-2xl bg-[#f6d5cf] p-3 text-sm text-[#7a1a14]">Your latest changes could not be saved. Check your connection; they will retry on the next change.</p>}
          {missed.length > 0 && tab !== 'Today' && !replanOpen && (
            <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-[#fdf1ee] p-4 text-sm">
              <span><b className="font-medium">{missed.length} planned task{missed.length === 1 ? '' : 's'}</b> slipped past {missed.length === 1 ? 'its' : 'their'} time: {missed.slice(0, 3).map((t) => t.title).join(', ')}{missed.length > 3 ? '…' : ''}</span>
              <button className={`${btn} ${BLUE}`} onClick={openReplan}>Replan my week</button>
            </div>
          )}
          {replanOpen && <Replan data={data} busy={busyForAI(data.busy)} energy={patternOf(data)} ratio={ratioOf(tasks)} onClose={() => setReplanOpen(false)} onApply={(plan) => { setTasks(applyReplan(tasks, plan)); setReplanOpen(false) }} />}
          <Banner tab={tab} />
          <div key={tab} className={`enter ${tab === 'Tasks' ? '' : 'max-w-[1100px]'}`}>
            {tab === 'Today' && <Today data={data} setData={setData} tasks={tasks} goals={goals} deadlines={deadlines} focus={focus} pick={pick} setFocus={setFocus} setPick={setPick} setTasks={setTasks}
              goTab={setTab} openTimer={() => setFocusOpen(true)} deleteTask={deleteTask} openAgent={() => setAgentOpen(true)} onReplan={openReplan} onReview={openReview} />}
            {tab === 'Tasks' && <Tasks goals={goals} tasks={tasks} setTasks={setTasks} goTab={setTab} setFocus={setFocus} deleteTask={deleteTask} projects={projects} deadlines={deadlines} setDeadlines={setDeadlines} />}
            {tab === 'Goals' && <Goals goals={goals} setGoals={setGoals} hobbies={hobbies} setHobbies={setHobbies} tasks={tasks} onReview={openReview} guide={data.guide} onGuide={openGuide} fresh={fresh} onMakeTasks={makeTasks} onDismissOffer={() => setFresh(null)} />}
            {tab === 'Projects' && <Projects goals={goals} projects={projects} setProjects={setProjects} tasks={tasks} setTasks={setTasks} deadlines={deadlines} />}
            {tab === 'Calendar' && <Calendar goals={goals} tasks={tasks} setTasks={setTasks} freeHours={data.freeHours} freeToday={freeTodayOf(data)} deadlines={deadlines} setDeadlines={setDeadlines} data={data} setData={setData} onStart={startTask} onReplan={openReplan} />}
          </div>
        </main>
      </div>

      <aside className={`${agentOpen ? 'fixed inset-y-0 right-0 z-30 flex w-full flex-col bg-white sm:w-[26rem] sm:border-l sm:border-line' : 'hidden'}`} aria-label="AI agent" onKeyDown={(e) => e.key === 'Escape' && setAgentOpen(false)}>
        <Agent data={data} setData={setData} onClose={() => setAgentOpen(false)} onReplan={openReplan} onGuide={() => openGuide(data.guide && !data.guide.done && !data.guide.skipped ? 'resume' : 'start')} reviewReq={reviewReq} />
      </aside>
      {guideOpen && <Guide guide={data.guide} saveGuide={saveGuide} onClose={() => setGuideOpen(false)} onSave={finishGuide} />}
      {focus && focusOpen && (
        <Focus key={focus.at} title={focus.title} estimate={focusTask?.hours} spent={focusTask?.spent} logged={!!focusTask}
          onLog={(h) => focusTask && addSpent(focusTask.id, h)}
          onDone={(h) => { if (focusTask) setTasks(tasks.map((t) => (t.id === focusTask.id ? { ...t, done: true, spent: Math.round(((t.spent || 0) + h) * 1000) / 1000 } : t))); setFocus(null) }}
          onStop={(h) => { if (focusTask) addSpent(focusTask.id, h); setFocus(null) }} />
      )}
      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white md:bottom-6 md:left-8 md:right-auto md:mx-0">
          <span className="min-w-0 break-words">{toast.text}</span>
          <button className="shrink-0 rounded-full px-3 py-1 font-medium text-primary" onClick={toast.undo}>Undo</button>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t} className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-xs ${tab === t ? 'bg-pale font-medium text-ink' : 'text-slate-600'}`}
            aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>
            <Icon name={t} />{t}
          </button>
        ))}
      </nav>
    </div>
  )
}
