import { useState, useEffect } from 'react'
import { settle } from './tasks.js'
import { applyPlan as applyReplan } from './replan.js'
import Replan from './Replan.jsx'
import Focus from './Focus.jsx'
import Settings from './Settings.jsx'
import { useSession } from './auth.js'
import Welcome from './Welcome.jsx'
import { startFrom } from './onboarding.js'
import { Icon } from './icons.jsx'
import { quadrant, patternOf, ratioOf, setLiveRatio, busyForAI, importCalendar, freeTodayOf } from './shared.jsx'
import { markInvalid, rhythmOf, record, addOutcome, addSession, addSignal, outcomeFor, typeOf, profile, mayAsk } from './rhythm.js'
import { logEnergy } from './energy.js'
import EnergyAsk from './components/EnergyAsk.jsx'
import NamePrompt from './components/NamePrompt.jsx'
import Feedback from './components/Feedback.jsx'
import { goalDay } from './goalwork.js'
import { SyncContext } from './components/SaveButton.jsx'
import TimeAsk from './components/TimeAsk.jsx'
import { track } from './analytics.js'
import Today from './screens/Today.jsx'
import Tasks from './screens/Tasks.jsx'
import Goals from './screens/Goals.jsx'
import Projects from './screens/Projects.jsx'
import { unlink } from './projects.js'
import Calendar from './screens/Calendar.jsx'
import Rhythm from './screens/Rhythm.jsx'
import Agent from './components/Agent.jsx'
import Guide from './guide/Guide.jsx'
import { addTasks } from './tasks.js'
import { btn, ghost } from './ui.js'
import { Banner } from './art.jsx'
import { Avatar, Hanko } from './px.jsx'
import { toggleMilestone } from './milestones.js'
import { useSync } from './useSync.js'
import { nameOf, needsName, growthOf, legacyGrowth, legacyXp, STAGES } from './kodama.js'

// One URL per section. The old /do-now lives on Today now.
const PATHS = { Today: '/today', Tasks: '/tasks', Goals: '/goals', Projects: '/projects', Calendar: '/calendar', Rhythm: '/rhythm' }
const TABS = Object.keys(PATHS)
const WRAP = 'max-w-[1164px]' // one width for the header, the tabs and every page, so the logo and tabs never move between pages
const PHONE_TABS = ['Today', 'Tasks', 'Calendar', 'Rhythm'] // the rest live under "More" on a phone
const MORE = ['Goals', 'Projects']
const tabOf = () => TABS.find((t) => PATHS[t] === location.pathname) || (location.pathname === '/deadlines' ? 'Tasks' : 'Today') // deadlines live in Tasks now

export default function App() {
  const user = useSession().data?.user
  const [tab, setTabState] = useState(tabOf)
  const [moreOpen, setMoreOpen] = useState(false)
  const setTab = (t) => { if (t !== tab) history.pushState(null, '', PATHS[t]); setTabState(t); window.scrollTo({ top: 0 }) }
  useEffect(() => { const f = () => setTabState(tabOf()); addEventListener('popstate', f); return () => removeEventListener('popstate', f) }, [])
  useEffect(() => {
    document.title = `${tab} - Desker`
    if (location.pathname !== PATHS[tab]) history.replaceState(null, '', PATHS[tab]) // "/" and /do-now land on Today
  }, [tab])

  const [agentOpen, setAgentOpen] = useState(false)
  // N: jump to a task box and start typing (ignored while typing somewhere or with a modifier held)
  useEffect(() => {
    const f = (e) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable], [role="dialog"]')) return
      e.preventDefault()
      setTabState((t) => (t === 'Today' || t === 'Tasks' ? t : 'Today'))
      setTimeout(() => document.querySelector('input[aria-label="Task"], input[aria-label="What needs doing"]')?.focus(), 0)
    }
    addEventListener('keydown', f); return () => removeEventListener('keydown', f)
  }, [])
  const [replanOpen, setReplanOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [fresh, setFresh] = useState(null) // goals just saved from the guide: { ids, offer }
  const [reviewReq, setReviewReq] = useState(0)
  const [, tick] = useState(0) // re-render each minute so "missed" flags stay current
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(id) }, [])
  const [cheer, setCheer] = useState(0) // bumps when Do First is cleared, to animate the logo
  const [toast, setToast] = useState(null) // { text, undo }
  const [askEnergy, setAskEnergy] = useState(false) // "How is your energy now?" right after a focus session
  const [askTime, setAskTime] = useState(null) // { id, title, est }: "How long did that take?" for a task ticked off without the timer
  const [toastHeld, holdToast] = useState(false) // hover or focus pauses the countdown
  useEffect(() => {
    if (!toast || toastHeld) return
    const id = setTimeout(() => setToast(null), 15000)
    return () => clearTimeout(id)
  }, [toast, toastHeld])
  const { data, setData, loadError, status: saveStatus, save } = useSync(user?.id)
  // keep an imported calendar fresh (at most hourly)
  const stale = data?.sync?.url && Date.now() - data.sync.at > 36e5 ? data.sync.url : null
  useEffect(() => {
    if (stale) importCalendar({ url: stale }).then((busy) => setData((d) => ({ ...d, busy, sync: { ...d.sync, at: Date.now() } }))).catch(() => {})
  }, [stale])
  // The old XP/level system is gone. Its total becomes the kodama's starting growth, once, and is never touched again (data.xp stays as it was).
  // `away` is how many days it was since the last visit, for the kodama's welcome back. Both are kept in data.kodama.
  const loaded = !!data
  useEffect(() => {
    if (!loaded) return
    track('session_started', { device: innerWidth < 640 ? 'phone' : 'desktop', theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' })
    const q = new URLSearchParams(location.search)
    if (q.get('from') === 'push') { track('notification_opened', { kind: q.get('k') }); history.replaceState(null, '', location.pathname) }
    setData((d) => {
      const k = d.kodama || {}
      return { ...d, kodama: { ...k, legacy: k.legacy ?? legacyGrowth(legacyXp(d)), away: k.lastSeen ? Math.floor((Date.now() - k.lastSeen) / 864e5) : 0, lastSeen: Date.now() } }
    })
  }, [loaded])
  // One-off cleanup: stamp stored timings that cannot teach anything (a few seconds, a forgotten timer). Numbers are recomputed on read regardless.
  useEffect(() => {
    if (!loaded) return
    setData((d) => { const r = d.rhythm && markInvalid(rhythmOf(d)); return r && r !== undefined && r.outcomes !== d.rhythm.outcomes ? { ...d, rhythm: { ...d.rhythm, outcomes: r.outcomes } } : d })
  }, [loaded])
  // Growing into the next stage is announced once per device, quietly.
  const stage = data?.kodama?.legacy !== undefined ? growthOf(data).index : -1 // not before the one-time XP migration has run
  useEffect(() => {
    if (stage < 0) return
    try {
      const seen = localStorage.seenStage
      if (seen !== undefined && stage > +seen) setToast({ stamp: true, hop: true, text: `${nameOf(data)} grew into a ${STAGES[stage].name.toLowerCase()}. ${STAGES[stage].unlock}` })
      localStorage.seenStage = Math.max(stage, +seen || 0)
    } catch { /* storage blocked: no announcement */ }
  }, [stage])
  if (!data) return <div className="flex items-center gap-3 p-6"><Avatar /><p role="status" className="text-slate-700">{loadError || 'Loading…'}</p></div>
  if (!data.onboarding) return <Welcome name={user?.name} onDone={(onboarding, first) => { track('onboarding_completed', { skipped: !!onboarding.skipped, first: first?.task ? 'task' : first?.deadline ? 'deadline' : 'none' }); if (onboarding.kodama) track('kodama_named'); setData((d) => startFrom(d, onboarding, first)) }} />

  const { goals, tasks } = data
  const rhythm = profile(data)
  setLiveRatio(rhythm.off || rhythm.dur.n < 3 ? undefined : rhythm.dur.overall)
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
  const openReplan = () => { setAgentOpen(false); setTab('Calendar'); setReplanOpen(true) }
  const setPick = (pick) => setData((d) => ({ ...d, pick }))
  const setHobbies = (hobbies) => setData((d) => ({ ...d, hobbies }))
  const setGoals = (goals) => setData((d) => ({ ...d, goals }))
  const milestoneReached = (goalId, m) => setToast({ stamp: true, text: `Milestone reached: ${m.title}. The kodama is happy, tomorrow is a lucky day.`,
    undo: () => { setData((d) => ({ ...d, goals: toggleMilestone(d.goals, goalId, m.id) })); setToast(null) } })
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
    setTasks(addTasks(tasks, goals.filter((g) => fresh.ids.includes(g.id) && g.firstStep).map((g) => ({ title: g.firstStep, goalId: g.id })), 'ai'))
    setFresh(null)
  }
  const openReview = () => { setAgentOpen(true); setReviewReq((n) => n + 1) }
  // Every task change goes through settle(): it stamps doneAt, adds the next copy of finished repeating tasks, and feeds Undo.
  // opts.auto: the change is Desker's own replan, not the user moving something (not counted as a reschedule)
  const setTasks = (next, opts = {}) => {
    const r = settle(tasks, next)
    const before = new Map(tasks.map((t) => [t.id, t]))
    const moved = opts.auto ? [] : r.tasks.filter((t) => { const b = before.get(t.id); return b && !t.done && !t.fun && b.when && t.when && (b.when !== t.when || b.start !== t.start) })
    const timed = r.finished.map((id) => r.tasks.find((t) => t.id === id)).filter((t) => t && !t.fun && !t.repeat)
    for (const t of r.tasks.filter((x) => r.finished.includes(x.id) && !x.fun)) track('task_completed', { timed: t.spent > 0 })
    for (const t of timed.filter((x) => x.spent > 0)) track('duration_logged', { source: 'timer' })
    if (moved.length || timed.length) setData((d) => record(d, (x) => {
      x = moved.reduce((acc, t) => addSignal(acc, { k: 'resched', at: Date.now(), task: t.id }), x)
      return timed.filter((t) => t.spent > 0).reduce((acc, t) => addOutcome(acc, outcomeFor(t, d, t.spent, 'timer', t.doneAt)), x)
    }))
    const untimed = timed.filter((t) => !(t.spent > 0))
    if (untimed.length === 1 && r.finished.length === 1 && !data.rhythm?.prefs?.off) setAskTime({ id: untimed[0].id, title: untimed[0].title, est: untimed[0].hours })
    const doFirst = (list) => list.some((t) => !t.done && !t.fun && quadrant(t) === 0)
    const cleared = r.finished.length > 0 && doFirst(tasks) && !doFirst(r.tasks)
    if (cleared) setCheer((n) => n + 1)
    setData((d) => ({ ...d, tasks: r.tasks }))
    if (r.finished.length) {
      const names = r.tasks.filter((t) => r.finished.includes(t.id)).map((t) => t.title)
      setToast({ stamp: true, text: `Done: ${names.length > 1 ? `${names.length} tasks` : names[0]}${r.spawned.length ? ' (next one added)' : ''}${cleared ? '. Do First is clear.' : ''}`,
        undo: () => { setData((d) => ({ ...d, tasks: settle(d.tasks, d.tasks.filter((t) => !r.spawned.includes(t.id)).map((t) => (r.finished.includes(t.id) ? { ...t, done: false } : t))).tasks })); setToast(null); setAskTime(null) } })
    }
  }
  const deleteTask = (t) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) }))
    setToast({ text: `Deleted: ${t.title}`, undo: () => { setData((d) => ({ ...d, tasks: [...d.tasks, t] })); setToast(null) } })
  }
  // minutes after (negative: before) the planned start, when this sitting was planned for today
  const lagOf = (t, start) => {
    if (!t?.when || !/^\d\d:\d\d$/.test(t.start || '') || t.when !== new Date(start).toLocaleDateString('sv')) return undefined
    return Math.max(-60, Math.min(240, Math.round((start - new Date(`${t.when}T${t.start}:00`).getTime()) / 6e4)))
  }
  const answerTime = (minutes) => {
    const t = tasks.find((x) => x.id === askTime.id)
    if (t) { track('duration_logged', { source: 'chip' }); setData((d) => record(d, (r) => addOutcome(r, outcomeFor(t, d, minutes / 60, 'tap')))) }
    setAskTime(null)
  }
  const logo = () => <span key={cheer} className={`flex ${cheer ? 'cheer' : ''}`}><Avatar /></span>

  return (
    <SyncContext.Provider value={{ status: saveStatus, save }}>
    <div className="min-h-dvh">
      <Feedback page={tab} />
      {needsName(data) && data.kodama?.legacy !== undefined && <NamePrompt setData={setData} />}
      <header className="sticky top-0 z-10 hidden border-b border-line bg-white md:block">
        <div className={`mx-auto px-8 pt-3 ${WRAP}`}>
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-3 py-1 pr-3 text-left" onClick={() => setTab('Today')} aria-label="Desker, go to Today">
            {logo()}
            <span className="block text-base font-semibold leading-tight">Desker</span>
          </button>
          <div className="flex items-center gap-2">
            <button className={`${btn} ${ghost} flex items-center gap-2`} onClick={() => setAgentOpen(true)}><Icon name="Agent" />Talk to {nameOf(data)}</button>
            <Settings data={data} setData={setData} />
          </div>
        </div>
        <nav className="-mb-px mt-2 flex gap-6" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t} className={`border-b-2 py-2 text-base ${tab === t ? 'border-accent font-medium text-ink' : 'border-transparent text-slate-600 hover:text-ink'}`}
              aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        </div>
      </header>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-white px-4 md:hidden">
          <div className="flex items-center gap-2">{logo()}<span className="text-base font-semibold">{tab}</span></div>
          <div className="flex items-center gap-1">
            <button className={`${btn} flex items-center gap-2 hover:bg-panel`} aria-label={`Talk to ${nameOf(data)}`} onClick={() => setAgentOpen(true)}><Icon name="Agent" /></button>
            <Settings data={data} setData={setData} />
          </div>
        </header>

        <main className={`mx-auto w-full px-4 pb-44 pt-4 md:px-8 md:pb-32 md:pt-8 ${WRAP}`}>
          {saveStatus === 'offline' && <p role="alert" className="px-panel mb-4 p-3 text-danger">Desker cannot reach the server right now. Your changes are kept on this device and will save as soon as it is back.</p>}
          {replanOpen && <Replan data={data} busy={busyForAI(data.busy)} energy={patternOf(data)} ratio={ratioOf(tasks)} onClose={() => setReplanOpen(false)} onApply={(plan) => { setTasks(applyReplan(tasks, plan), { auto: true }); setReplanOpen(false) }} />}
          <Banner tab={tab} />
          <div key={tab} className="enter">
            {tab === 'Today' && <Today data={data} setData={setData} tasks={tasks} goals={goals} deadlines={deadlines} focus={focus} pick={pick} setFocus={setFocus} setPick={setPick} setTasks={setTasks}
              goTab={setTab} openTimer={() => setFocusOpen(true)} deleteTask={deleteTask} openAgent={() => setAgentOpen(true)} onReplan={openReplan} onReview={openReview} />}
            {tab === 'Tasks' && <Tasks rhythm={rhythm} goals={goals} tasks={tasks} setTasks={setTasks} goTab={setTab} setFocus={setFocus} deleteTask={deleteTask} projects={projects} deadlines={deadlines} setDeadlines={setDeadlines} />}
            {tab === 'Goals' && <Goals daily={goalDay(data)} goals={goals} setGoals={setGoals} onMilestone={milestoneReached} hobbies={hobbies} setHobbies={setHobbies} tasks={tasks} onReview={openReview} guide={data.guide} onGuide={openGuide} fresh={fresh} onMakeTasks={makeTasks} onDismissOffer={() => setFresh(null)} />}
            {tab === 'Projects' && <Projects rhythm={rhythm} goals={goals} projects={projects} setProjects={setProjects} tasks={tasks} setTasks={setTasks} deadlines={deadlines} />}
            {tab === 'Rhythm' && <Rhythm data={data} setData={setData} onReplan={openReplan} />}
            {tab === 'Calendar' && <Calendar rhythm={rhythm} goals={goals} tasks={tasks} setTasks={setTasks} freeHours={data.freeHours} freeToday={freeTodayOf(data)} deadlines={deadlines} setDeadlines={setDeadlines} data={data} setData={setData} onStart={startTask} onReplan={openReplan} />}
          </div>
        </main>
      </div>

      <aside className={`${agentOpen ? 'fixed inset-y-0 right-0 z-30 flex w-full flex-col bg-white sm:w-[26rem] sm:border-l sm:border-line' : 'hidden'}`} aria-label="Companion chat" onKeyDown={(e) => e.key === 'Escape' && setAgentOpen(false)}>
        <Agent data={data} setData={setData} onClose={() => setAgentOpen(false)} onReplan={openReplan} onGuide={() => openGuide(data.guide && !data.guide.done && !data.guide.skipped ? 'resume' : 'start')} reviewReq={reviewReq} />
      </aside>
      {guideOpen && <Guide guide={data.guide} saveGuide={saveGuide} onClose={() => setGuideOpen(false)} onSave={finishGuide} />}
      {focus && focusOpen && (
        <Focus key={focus.at} title={focus.title} estimate={focusTask?.hours} spent={focusTask?.spent} logged={!!focusTask} suggestWork={rhythm.focus || undefined}
          onSession={(s) => { track('focus_session_completed', { minutes: s.active, result: s.result }); setData((d) => record(d, (r) => addSession(r, { task: focusTask?.id, type: focusTask ? typeOf(focusTask) : undefined, ...s, lag: lagOf(focusTask, s.start) }))); if (s.active >= 5 && mayAsk(data)) setAskEnergy(true) }}
          onLog={(h) => focusTask && addSpent(focusTask.id, h)}
          onDone={(h) => { if (focusTask) setTasks(tasks.map((t) => (t.id === focusTask.id ? { ...t, done: true, spent: Math.round(((t.spent || 0) + h) * 1000) / 1000 } : t))); setFocus(null) }}
          onStop={(h) => { if (focusTask) addSpent(focusTask.id, h); setFocus(null) }} />
      )}
      {askTime && (
        <div className={`fixed inset-x-4 z-40 mx-auto max-w-md md:left-8 md:right-auto md:mx-0 ${toast ? 'bottom-44 md:bottom-28' : 'bottom-24 md:bottom-6'}`}>
          <TimeAsk key={askTime.id} title={askTime.title} est={askTime.est} onSave={answerTime} onSkip={() => setAskTime(null)} />
        </div>
      )}
      {askEnergy && !askTime && (
        <div className={`fixed inset-x-4 z-40 mx-auto max-w-md md:left-8 md:right-auto md:mx-0 ${toast ? 'bottom-44 md:bottom-28' : 'bottom-24 md:bottom-6'}`}>
          <EnergyAsk onTap={(l) => { track('energy_logged', { prompted: true }); setData((d) => ({ ...d, energyLog: logEnergy(d.energyLog, l) })); setAskEnergy(false) }} onSkip={() => setAskEnergy(false)} />
        </div>
      )}
      {toast && (
        <div role="status" onMouseEnter={() => holdToast(true)} onMouseLeave={() => holdToast(false)} onFocus={() => holdToast(true)} onBlur={() => holdToast(false)} className="px-btn-primary fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center justify-between gap-3 p-2 md:bottom-6 md:left-8 md:right-auto md:mx-0">
          {toast.hop ? <span className="px-hop"><Avatar /></span> : toast.stamp && <Hanko key={toast.text} />}
          <span className="min-w-0 flex-1 break-words">{toast.text}</span>
          {toast.undo && <button className="min-h-11 shrink-0 px-3 underline" onClick={toast.undo}>Undo</button>}
          <button className="min-h-11 shrink-0 px-3" onClick={() => setToast(null)}>Dismiss</button>
        </div>
      )}
      {moreOpen && <div className="fixed inset-0 z-20 md:hidden" onClick={() => setMoreOpen(false)} aria-hidden="true" />}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Sections">
        {PHONE_TABS.map((t) => (
          <button key={t} className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-xs ${tab === t ? 'bg-pale font-medium text-ink' : 'text-slate-600'}`}
            aria-current={tab === t ? 'page' : undefined} onClick={() => { setMoreOpen(false); setTab(t) }}>
            <Icon name={t} />{t}
          </button>
        ))}
        <div className="relative flex min-w-0 flex-1">
          <button className={`flex min-h-16 w-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-xs ${MORE.includes(tab) ? 'bg-pale font-medium text-ink' : 'text-slate-600'}`}
            aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
            <Icon name="More" />More
          </button>
          {moreOpen && (
            <ul role="menu" className="px-panel absolute bottom-full right-1 mb-1 w-40 bg-white p-1">
              {MORE.map((t) => (
                <li key={t} role="none"><button role="menuitem" className={`${btn} w-full !justify-start gap-2 ${tab === t ? 'bg-pale' : ''}`} aria-current={tab === t ? 'page' : undefined} onClick={() => { setMoreOpen(false); setTab(t) }}><Icon name={t} />{t}</button></li>
              ))}
            </ul>
          )}
        </div>
      </nav>
    </div>
    </SyncContext.Provider>
  )
}
