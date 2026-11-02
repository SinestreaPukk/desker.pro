import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { stateUrl } from './api.js'
import { addTasks, day, settle } from './tasks.js'
import Focus from './Focus.jsx'
import Settings from './Settings.jsx'
import { migrate } from './storage.js'
import { Icon } from './icons.jsx'
import { importCalendar } from './shared.jsx'
import { rank, dragTo, letAppDecide } from './rank.js'
import { anotherSession, syncSessions } from './sessions.js'
import { setVision } from './goals.js'
import { becomeProject, meetingToProject, meetingToTask, newProject, taskToMeeting } from './events.js'
import { unlink } from './projects.js'
import Now from './screens/Now.jsx'
import Goals from './screens/Goals.jsx'
import Calendar from './screens/Calendar.jsx'
import Agent from './components/Agent.jsx'
import ItemSheet from './components/ItemSheet.jsx'
import MeetingSheet from './components/MeetingSheet.jsx'
import { ProgressChips } from './components/Progress.jsx'
import Finder from './finder/Finder.jsx'
import { btn, ghost } from './ui.js'

// The timer lives in the open page, so a saved one is dropped on load rather than shown as running.
// One URL per page. Every other path, such as the old /today and /tasks, lands on Now.
const PATHS = { Now: '/now', Calendar: '/calendar', Goals: '/goals' }
const TABS = Object.keys(PATHS)
const KEEPALIVE_LIMIT = 60_000 // browsers refuse keepalive requests over about 64 KB, and the server takes more
const tabOf = () => TABS.find((t) => PATHS[t] === location.pathname) || 'Now'

export default function App() {
  const [tab, setTabState] = useState(tabOf)
  const setTab = (t) => { if (t !== tab) history.pushState(null, '', PATHS[t]); setTabState(t); window.scrollTo({ top: 0 }) }
  useEffect(() => { const f = () => setTabState(tabOf()); addEventListener('popstate', f); return () => removeEventListener('popstate', f) }, [])
  useEffect(() => {
    document.title = `${tab} · Desker`
    if (location.pathname !== PATHS[tab]) history.replaceState(null, '', PATHS[tab])
  }, [tab])

  const [agentOpen, setAgentOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [finderOpen, setFinderOpen] = useState(false)
  const [settingsReq, setSettingsReq] = useState(0)
  const [sheet, setSheet] = useState(null) // { kind: 'task' | 'project', id }
  const [converting, setConverting] = useState(null) // { task, type, kind }, a task being changed: nothing happens until Save
  const [, tick] = useState(0) // re-render each minute so the ranking and the day stay current
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(id) }, [])
  const [cheer, setCheer] = useState(0) // bumps when the Do First box is cleared, to animate the logo
  const [toast, setToast] = useState(null) // { text, undo, project?, sticky? }
  useEffect(() => {
    if (!toast || toast.sticky) return
    const id = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(id)
  }, [toast])
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState(false)
  const firstLoad = useRef(true)
  useEffect(() => {
    fetch(stateUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load your data')))).then((d) => setData({ ...migrate(d), focus: null })).catch((e) => setLoadError(e.message))
  }, [])
  useEffect(() => { // the finder opens on the first visit only, and never for people who already have goals
    if (!data || !firstLoad.current) return
    firstLoad.current = false
    if (!data.goals.length && !data.finder) setFinderOpen(true)
  }, [data])
  // keep an imported calendar fresh (at most hourly)
  const stale = data?.sync?.url && Date.now() - data.sync.at > 36e5 ? data.sync.url : null
  useEffect(() => {
    if (stale) importCalendar({ url: stale }).then((busy) => setData((d) => ({ ...d, busy, sync: { ...d.sync, at: Date.now() } }))).catch(() => {})
  }, [stale])
  useEffect(() => {
    if (!data) return
    const save = () => {
      removeEventListener('pagehide', save)
      clearTimeout(id)
      const body = JSON.stringify(data)
      fetch(stateUrl, { method: 'PUT', keepalive: body.length < KEEPALIVE_LIMIT, headers: { 'content-type': 'application/json' }, body })
        .then((r) => setSaveError(!r.ok)).catch(() => setSaveError(true))
    }
    const id = setTimeout(save, 500)
    addEventListener('pagehide', save) // leaving within that half second still saves
    return () => { clearTimeout(id); removeEventListener('pagehide', save) }
  }, [data])
  // One place keeps sessions right after any change, on load, and when the day changes. It returns the same list when nothing changed, so this settles.
  const today = day(new Date())
  useLayoutEffect(() => {
    if (!data) return
    setData((d) => { const tasks = syncSessions(d.tasks, d.projects); return tasks === d.tasks ? d : { ...d, tasks } })
  }, [data?.tasks, data?.projects, today])
  if (!data) return <p className="p-6 text-slate-600">{loadError || 'Loading…'}</p>

  const { goals, tasks, projects, events } = data
  const rows = rank(data)
  const focus = data.focus && (!data.focus.taskId || tasks.some((t) => t.id === data.focus.taskId && !t.done)) ? data.focus : null
  const focusTask = focus && tasks.find((t) => t.id === focus.taskId)
  const setFocus = (f) => { setData((d) => ({ ...d, focus: f })); setFocusOpen(!!f) } // starting something opens the timer
  const addSpent = (id, hours) => hours > 0 && setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, spent: Math.round(((t.spent || 0) + hours) * 1000) / 1000 } : t)) }))
  const startTask = (t) => setFocus({ taskId: t.id, title: t.title, at: Date.now() })
  const setGoals = (g) => setData((d) => ({ ...d, goals: g }))
  const setEvents = (e) => setData((d) => ({ ...d, events: e }))
  const patchProject = (id, patch) => setData((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))

  const setProgress = (id, n) => {
    const p = projects.find((x) => x.id === id)
    if (!p) return
    patchProject(id, { progress: n })
    if (n >= 5 && (p.progress ?? 0) < 5) setToast({ text: `Finished: ${p.title}`, undo: () => { patchProject(id, { progress: p.progress }); setToast(null) } })
    else if (toast?.project === id) setToast(null)
  }
  // Every task change goes through settle(): it stamps doneAt, adds the next copy of finished repeating tasks, and feeds Undo.
  const setTasks = (next) => {
    const r = settle(tasks, next)
    const boxes = (list) => rank({ goals, projects, tasks: list }).some((x) => x.box === 0)
    if (r.finished.length && boxes(tasks) && !boxes(r.tasks)) setCheer((n) => n + 1)
    setData((d) => ({ ...d, tasks: r.tasks }))
    if (!r.finished.length) return
    const names = r.tasks.filter((t) => r.finished.includes(t.id)).map((t) => t.title)
    const inProject = r.tasks.find((t) => r.finished.includes(t.id) && projects.some((p) => p.id === t.projectId && (p.progress ?? 0) < 5))
    setToast({
      text: `Done: ${names.length > 1 ? `${names.length} tasks` : names[0]}${r.spawned.length ? ' (next one added)' : ''}`,
      undo: () => { setData((d) => ({ ...d, tasks: settle(d.tasks, d.tasks.filter((t) => !r.spawned.includes(t.id)).map((t) => (r.finished.includes(t.id) ? { ...t, done: false } : t))).tasks })); setToast(null) },
      ...(inProject && { project: inProject.projectId, sticky: true }), // the Progress question stays until you answer or close it
    })
  }
  const patchTask = (id, patch) => setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const doneTask = (t) => patchTask(t.id, { done: true })
  const deleteTask = (t) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) }))
    setToast({ text: `Deleted: ${t.title}`, undo: () => { setData((d) => ({ ...d, tasks: [...d.tasks, t] })); setToast(null) } })
  }
  const deleteProject = (p) => {
    const before = tasks
    setData((d) => ({ ...d, projects: d.projects.filter((x) => x.id !== p.id), tasks: unlink(d.tasks, p.id) }))
    setToast({ text: `Deleted: ${p.title}`, undo: () => { setData((d) => ({ ...d, projects: [...d.projects, p], tasks: before })); setToast(null) } })
  }
  const deleteGoal = (g) => {
    setGoals(goals.filter((x) => x.id !== g.id))
    setToast({ text: `Deleted: ${g.title}`, undo: () => { setGoals(goals); setToast(null) } })
  }
  // Adds a batch from the Add box or chat, and returns the id of the first one.
  const addItems = (items) => {
    const base = Math.max(Date.now(), ...projects.map((p) => p.id + 1))
    const newProjects = items.filter((i) => i.type === 'project').map((i, k) => newProject(i, base + k))
    const taskItems = items.filter((i) => i.type !== 'project').map(({ type, ...i }) => Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined)))
    const out = addTasks(tasks, taskItems)
    setData((d) => ({ ...d, projects: [...d.projects, ...newProjects], tasks: out }))
    return newProjects[0]?.id ?? out.at(-1)?.id
  }
  // Saving the add form, from a calendar slot or from + Add on Now.
  const addNew = (x, kind, type) => {
    if (type === 'Project') addItems([meetingToProject(x, kind)])
    else if (kind === 'Reminder') addItems([meetingToTask(x)])
    else setData((d) => ({ ...d, events: [...d.events, { ...x, id: Date.now() }] }))
  }
  const changed = (text) => {
    const before = data
    setConverting(null)
    setToast({ text, undo: () => { setData((d) => ({ ...d, tasks: before.tasks, projects: before.projects, events: before.events })); setToast(null) } })
  }
  const toProject = (from, x, kind) => {
    setData((d) => becomeProject(d, from, x, kind))
    changed(`Now a project: ${x.title}`)
  }
  const saveConverted = (x, kind, type) => {
    if (type === 'Project') return toProject({ task: converting.task.id }, x, kind)
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== converting.task.id), events: [...d.events, { ...x, id: Date.now() }] }))
    changed(`Now a meeting: ${x.title}`)
  }
  const another = (p) => setData((d) => ({ ...d, tasks: anotherSession(d.tasks, p) }))
  const applyDrag = (fn) => { const next = fn({ tasks, projects }); setData((d) => ({ ...d, ...next })) }
  const openTask = (t) => setSheet(t.session ? { kind: 'project', id: t.projectId } : { kind: 'task', id: t.id })
  const openProject = (p) => setSheet({ kind: 'project', id: p.id })
  const openFinder = () => { setAgentOpen(false); setFinderOpen(true) }
  const closeFinder = () => { setData((d) => ({ ...d, finder: { ...d.finder, skipped: true } })); setFinderOpen(false) }
  const saveFinder = (list, vision) => {
    setData((d) => ({ ...d, goals: setVision(list, vision), finder: { done: true }, checkGoalOrder: undefined }))
    setFinderOpen(false)
    setTab('Now')
  }
  const toastProject = toast?.project && projects.find((p) => p.id === toast.project)
  const canAnother = toastProject && !tasks.some((t) => t.projectId === toastProject.id && !t.session && !t.done && !t.fun)
  const logo = (cls) => <img key={cheer} src="/favicon.svg" alt="" className={`${cls} ${cheer ? 'cheer' : ''}`} />

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 hidden border-b border-line bg-white md:block">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-6 px-8 py-2">
          <div className="flex items-center gap-6">
            <button className="flex items-center gap-3 rounded-xl py-1 pr-3 text-left" onClick={() => setTab('Now')} aria-label="Desker, go to Now">
              {logo('h-9 w-9')}
              <span className="text-lg font-semibold leading-tight">Desker</span>
            </button>
            <nav className="flex gap-6" aria-label="Pages">
              {TABS.map((t) => (
                <button key={t} className={`border-b-2 py-2 text-sm ${tab === t ? 'border-accent font-medium text-ink' : 'border-transparent text-slate-600 hover:text-ink'}`}
                  aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button className={`${btn} ${ghost} flex items-center gap-2`} onClick={() => setAgentOpen(true)}><Icon name="Agent" />Ask</button>
            <Settings data={data} setData={setData} openReq={settingsReq} />
          </div>
        </div>
      </header>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-white px-4 md:hidden">
          <div className="flex items-center gap-2">{logo('h-8 w-8')}<span className="text-lg font-semibold">{tab}</span></div>
          <div className="flex items-center gap-1">
            <button className={`${btn} flex items-center gap-2 hover:bg-panel`} onClick={() => setAgentOpen(true)}><Icon name="Agent" />Ask</button>
            <Settings data={data} setData={setData} openReq={settingsReq} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1100px] px-4 pb-32 pt-4 md:px-8 md:pt-6">
          {saveError && <p role="alert" className="mb-4 rounded-2xl bg-[#f6d5cf] p-3 text-sm text-[#7a1a14]">Your latest changes could not be saved. Check your connection; they will retry on the next change.</p>}
          <div key={tab} className="enter">
            {tab === 'Now' && <Now rows={rows} goals={goals} projects={projects} tasks={tasks} events={events} busy={data.busy || []} finderSkipped={data.finder?.skipped}
              onAdd={addNew}
              onFinder={openFinder} onStart={startTask} onDone={doneTask} onOpen={openTask} onOpenProject={openProject} onDrag={(id, box) => applyDrag((doc) => dragTo(doc, id, box))} setProgress={setProgress} patchProject={patchProject} onAnother={another} />}
            {tab === 'Calendar' && <Calendar goals={goals} events={events} setEvents={setEvents} busy={data.busy || []} tasks={tasks} projects={projects} onOpenTask={openTask} onOpenProject={openProject} onDoneTask={doneTask} onFinishProject={setProgress} patchTask={patchTask} patchProject={patchProject} onAdd={addNew} onMeetingToProject={(x, kind) => toProject({ event: x.id }, x, kind)} onConnect={() => setSettingsReq((n) => n + 1)} />}
            {tab === 'Goals' && <Goals goals={goals} setGoals={setGoals} projects={projects} tasks={tasks} checkOrder={data.checkGoalOrder} onDismissCheck={() => setData((d) => ({ ...d, checkGoalOrder: undefined }))}
              onOpenProject={openProject} onOpenTask={openTask} onFinder={openFinder} onDeleteGoal={deleteGoal} />}
          </div>
        </main>
      </div>

      {sheet && <ItemSheet item={sheet} rows={rows} goals={goals} tasks={tasks} projects={projects} patchTask={patchTask} patchProject={patchProject} setProgress={setProgress}
        onStart={startTask} onDone={doneTask} onDelete={deleteTask} onDeleteProject={deleteProject} onOpenTask={openTask} onAnother={another} onMakeMeeting={(task, type, kind) => { setSheet(null); setConverting({ task, type, kind }) }} onClose={() => setSheet(null)}
        onAddTask={(projectId, title) => addItems([{ type: 'task', title, projectId }])}
        onMove={(id, box) => applyDrag((doc) => dragTo(doc, id, box))} onClear={(id) => applyDrag((doc) => letAppDecide(doc, id))}
        onClearProject={(id) => setData((d) => ({ ...d, projects: d.projects.map((p) => { if (p.id !== id) return p; const { important, urgent, ...rest } = p; return rest }) }))} />}
      {converting && <MeetingSheet meeting={taskToMeeting(converting.task)} startType={converting.type} startKind={converting.kind} goals={goals} note={converting.task.projectId ? 'Its link to its project ends.' : ''} onSave={saveConverted} onReminder={() => { setSheet({ kind: 'task', id: converting.task.id }); setConverting(null) }} onClose={() => setConverting(null)} />}
      <aside className={`${agentOpen ? 'fixed inset-y-0 right-0 z-30 flex w-full flex-col bg-white sm:w-[26rem] sm:border-l sm:border-line' : 'hidden'}`} aria-label="Chat" onKeyDown={(e) => e.key === 'Escape' && setAgentOpen(false)}>
        <Agent data={data} onAdd={addItems} onClose={() => setAgentOpen(false)} onFinder={openFinder} />
      </aside>
      {finderOpen && <Finder goals={goals} onSave={saveFinder} onClose={closeFinder} />}
      {focus && focusOpen && (
        <Focus key={focus.at} title={focus.title} spent={focusTask?.spent} logged={!!focusTask}
          onLog={(h) => focusTask && addSpent(focusTask.id, h)}
          onDone={(h) => { if (focusTask) setTasks(tasks.map((t) => (t.id === focusTask.id ? { ...t, done: true, spent: Math.round(((t.spent || 0) + h) * 1000) / 1000 } : t))); setFocus(null) }}
          onStop={(h) => { if (focusTask) addSpent(focusTask.id, h); setFocus(null) }} />
      )}
      {toast && (
        <div role="status" className="enter fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md space-y-2 rounded-2xl bg-ink px-4 py-3 text-sm text-white md:bottom-6 md:left-8 md:right-auto md:mx-0">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <span className="min-w-0 basis-full break-words sm:basis-0 sm:flex-1">{toast.text}</span>
            <span className="-ml-3 flex shrink-0 items-center gap-1 sm:ml-0">
              <button className="min-h-11 rounded-full px-3 font-medium text-primary" onClick={toast.undo}>Undo</button>
              {canAnother && <button className="min-h-11 rounded-full px-3 font-medium text-primary" onClick={() => another(toastProject)}>Another session</button>}
              {toast.sticky && <button className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10" aria-label="Close" onClick={() => setToast(null)}>✕</button>}
            </span>
          </div>
          {toastProject && (
            <div className="flex flex-wrap items-center gap-2">
              <span>Progress now?</span>
              <ProgressChips dark value={toastProject.progress ?? 0} onPick={(n) => setProgress(toastProject.id, n)} />
            </div>
          )}
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Pages">
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
