import { useState } from 'react'
import { btn, ghost, input, chip } from '../ui.js'
import { doneByGoal } from '../rank.js'
import { daysLeft, pace } from '../sessions.js'
import { rankedGoals, visionOf, moveGoal, setVision } from '../goals.js'
import { canAddGoal } from '../finder/catalog.js'
import NewGoal from '../finder/NewGoal.jsx'
import { Arrow, UP, DOWN } from '../finder/Finder.jsx'
import { ProgressBar } from '../components/Progress.jsx'

// Rank is the design: type steps down from #1 to #5, with no boxes.
const SIZES = [['text-6xl', 'text-3xl'], ['text-5xl', 'text-2xl'], ['text-4xl', 'text-xl'], ['text-3xl', 'text-lg'], ['text-2xl', 'text-base']]
const size = (i) => SIZES[Math.min(i, SIZES.length - 1)]

function Editable({ value, label, className, onSave, placeholder }) {
  const [edit, setEdit] = useState(false)
  if (!edit) return <button className={`text-left ${className} block min-h-11 max-w-full break-words`} onClick={() => setEdit(true)} aria-label={`${label}: ${value || 'not set'}. Tap to edit.`}>{value || <span className="text-slate-500">{placeholder}</span>}</button>
  const done = (e) => { setEdit(false); const v = e.target.value.trim(); if (v !== value) onSave(v) }
  return <input autoFocus aria-label={label} defaultValue={value} className={`${input} w-full`} onBlur={done}
    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = value; e.target.blur() } }} />
}

const leftWords = (date) => {
  const n = daysLeft(date)
  return n < 0 ? `${-n} day${n === -1 ? '' : 's'} past due` : n === 0 ? 'Due today' : `${n} day${n === 1 ? '' : 's'} left`
}

function ProjectLine({ p, onOpen }) {
  const label = pace(p)?.label
  return (
    <li>
      <button className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1 text-left text-sm hover:bg-panel" onClick={() => onOpen(p)}>
        <span className="min-w-0 break-words font-medium">{p.title}</span>
        <ProgressBar value={p.progress ?? 0} />
        <span className="tabular-nums text-slate-600">{p.progress ?? 0}/5</span>
        {p.date && <span className="text-slate-600">{leftWords(p.date)}</span>}
        {label && <span className={`rounded-full px-2 text-xs ${label === 'Behind' ? 'bg-[#f6d5cf] text-[#7a1a14]' : 'bg-pale text-accent-dark'}`}>{label}</span>}
      </button>
    </li>
  )
}

export default function Goals({ goals, setGoals, projects, tasks, checkOrder, onDismissCheck, onOpenProject, onOpenTask, onFinder, onDeleteGoal }) {
  const [adding, setAdding] = useState(false)
  const [dragId, setDragId] = useState(null)
  const ranked = rankedGoals(goals)
  const vision = visionOf(goals)
  const done = doneByGoal(tasks, projects)
  const live = new Set(ranked.map((g) => g.id))
  const active = projects.filter((p) => (p.progress ?? 0) < 5)
  const finished = projects.filter((p) => (p.progress ?? 0) >= 5)
  const looseProjects = active.filter((p) => !live.has(p.goalId))
  const looseTasks = tasks.filter((t) => !t.done && !t.fun && !t.session && !live.has(t.goalId) && !projects.some((p) => p.id === t.projectId))
  const rename = (id, title) => { if (title) setGoals(goals.map((g) => (g.id === id ? { ...g, title } : g))) }
  const add = (g) => { setGoals([...goals, { id: Date.now(), level: 3, happiness: false, ...g }]); setAdding(false) }
  const link = 'min-h-11 text-sm text-accent underline'

  return (
    <div className="max-w-3xl">
      <Editable value={vision?.title || ''} label="Vision" placeholder="Add a vision sentence" className="greeting mb-8 w-full !text-center text-3xl leading-tight md:text-4xl" onSave={(v) => setGoals(setVision(goals, v))} />

      {checkOrder && (
        <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-pale p-4 text-sm">
          <span className="min-w-48 flex-1">Your goals are now one ranked list, and rank decides what comes first. Check the order.</span>
          <button className={`${btn} hover:bg-white`} onClick={onDismissCheck}>Looks right</button>
        </div>
      )}

      <ol className="space-y-8">
        {ranked.map((g, i) => {
          const [num, title] = size(i)
          const mine = active.filter((p) => p.goalId === g.id)
          return (
            <li key={g.id} draggable onDragStart={(e) => { setDragId(g.id); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDragId(null)}
              onDragOver={(e) => dragId && e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (dragId) setGoals(moveGoal(goals, dragId, i)); setDragId(null) }}
              className={dragId === g.id ? 'opacity-50' : ''}>
              <div className="flex items-start gap-3">
                <span className={`greeting w-10 shrink-0 text-center md:w-14 ${num}`} aria-hidden="true">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1"><Editable value={g.title} label={`Goal ${i + 1}`} className={`${title} font-medium leading-tight`} onSave={(v) => rename(g.id, v)} /></div>
                    <span className="flex shrink-0">
                      <Arrow label={`Move ${g.title} up`} d={UP} disabled={i === 0} onClick={() => setGoals(moveGoal(goals, g.id, i - 1))} />
                      <Arrow label={`Move ${g.title} down`} d={DOWN} disabled={i === ranked.length - 1} onClick={() => setGoals(moveGoal(goals, g.id, i + 1))} />
                      <button className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-panel" aria-label={`Delete ${g.title}`} onClick={() => onDeleteGoal(g)}>×</button>
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{done.get(g.id) || 0} done this week</p>
                  {mine.length > 0 && <ul className="mt-2 space-y-1">{mine.map((p) => <ProjectLine key={p.id} p={p} onOpen={onOpenProject} />)}</ul>}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {!ranked.length && <p className="text-slate-600">No goals yet. Your goals decide what comes first on Now.</p>}

      <div className="mt-8 space-y-4">
        {adding
          ? <NewGoal onAdd={add} onCancel={() => setAdding(false)} />
          : (
            <div className="flex flex-wrap items-center justify-between gap-x-4">
              {canAddGoal(goals)
                ? <button className={`${btn} ${ghost}`} onClick={() => setAdding(true)}>+ Add a goal</button>
                : <span className="text-sm text-slate-600">You have your 5 goals. To add another, delete one first.</span>}
              <button className={link} onClick={onFinder}>{ranked.length ? 'Retake the finder (1 min)' : 'Find your goals (1 min)'}</button>
            </div>
          )}

        {(looseProjects.length > 0 || looseTasks.length > 0) && (
          <section aria-label="Not linked">
            <h2 className="mb-1 text-sm font-medium">Not linked</h2>
            <ul className="flex flex-wrap items-center gap-2">
              {looseProjects.map((p) => <li key={`p${p.id}`}><button className={chip(false)} onClick={() => onOpenProject(p)}>{p.title} · Link a goal</button></li>)}
              {looseTasks.map((t) => <li key={t.id}><button className="min-h-11 rounded-full px-3 text-sm text-slate-700 hover:bg-panel" onClick={() => onOpenTask(t)}>{t.title}</button></li>)}
            </ul>
          </section>
        )}

        {finished.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-accent">Finished ({finished.length})</summary>
            <ul className="mt-2 space-y-1">{finished.map((p) => <ProjectLine key={p.id} p={p} onOpen={onOpenProject} />)}</ul>
          </details>
        )}
      </div>
    </div>
  )
}
