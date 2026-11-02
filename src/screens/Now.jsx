import { useState } from 'react'
import { BLUE, btn, ghost, rowCard, Q, TYPES } from '../ui.js'
import { doneStats, day } from '../tasks.js'
import { daysLeft, restingProjects } from '../sessions.js'
import { comingUp } from '../comingUp.js'
import { fmtDate } from '../shared.jsx'
import { isRealDate, parseQuick } from '../lists.js'
import MeetingSheet from '../components/MeetingSheet.jsx'
import Row from '../components/Row.jsx'

const SHOWN = 5

function Matrix({ rows, onDrop, onDone, onStart, onOpen }) {
  const [over, setOver] = useState(null)
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Matrix">
      {Q.map((q, i) => (
        <section key={q.name} className={`rounded-2xl p-3 ${q.cls} ${over === i ? 'ring-2 ring-accent' : ''}`} aria-label={q.name}
          onDragOver={(e) => { e.preventDefault(); setOver(i) }} onDragLeave={() => setOver(null)}
          onDrop={(e) => { e.preventDefault(); setOver(null); onDrop(+e.dataTransfer.getData('text/plain'), i) }}>
          <h3 className="text-sm font-medium">{q.name}</h3>
          <p className="mb-2 text-xs text-slate-600">{q.hint}</p>
          <ul className="space-y-1">
            {rows.filter((r) => r.box === i).map((r) => <Row key={r.task.id} row={r} onDone={onDone} onStart={onStart} onOpen={onOpen} onDragStart={(e) => e.dataTransfer.setData('text/plain', String(r.task.id))} />)}
          </ul>
        </section>
      ))}
    </div>
  )
}

const Mark = ({ x }) => <><span className={`h-2.5 w-2.5 shrink-0 ${TYPES[x.type].mark}`} aria-hidden="true" /><span className="sr-only">{TYPES[x.type].name}: </span></>

// Classes and meetings are a quick glance, with no action. Things to do, and every project, open their sheet. The mark says which type it is.
function ComingUpList({ groups, onOpenItem }) {
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.name}>
          <h3 className="text-sm font-medium">{g.name}</h3>
          <ul>
            {g.items.map((x) => <li key={x.id}>{x.kind === 'meeting'
              ? <span className="flex items-baseline gap-2 py-1 text-sm text-slate-700"><Mark x={x} /><span className="min-w-0 break-words">{x.label}</span></span>
              : <button className="flex min-h-8 w-full items-baseline gap-2 py-1 text-left text-sm text-slate-700 hover:text-accent" onClick={() => onOpenItem(x)}><Mark x={x} /><span className="min-w-0 break-words">{x.label}</span></button>}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}

function ComingUp({ groups, onOpenItem }) {
  return (
    <section className="hidden md:block" aria-label="Coming up">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Coming up</h2>
      {groups.length ? <ComingUpList groups={groups} onOpenItem={onOpenItem} /> : <p className="text-sm text-slate-600">Nothing due.</p>}
    </section>
  )
}

// "Statics midterm was yesterday. Done?" or a new date, one tap.
function PastDue({ p, onDone, onNewDate }) {
  const ago = -daysLeft(p.date)
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-[#fdf1ee] p-3 text-sm">
      <span className="min-w-48 flex-1">{p.title} was {ago === 1 ? 'yesterday' : `on ${fmtDate(p.date)}`}. Done?</span>
      <button className={`${btn} ${BLUE}`} onClick={() => onDone(p.id, 5)}>Done</button>
      <label className="flex items-center gap-2">New date
        <input type="date" aria-label={`New date for ${p.title}`} className="min-h-11 rounded-xl border border-control bg-white px-2" onBlur={(e) => isRealDate(e.target.value) && onNewDate(p.id, { date: e.target.value })} />
      </label>
    </div>
  )
}

// One question: what could I do now? A top pick with its reason, and ranked alternatives to weigh it against how you feel.
export default function Now({ rows, goals, projects, tasks, events, busy, finderSkipped, onAdd, onFinder, onStart, onDone, onOpen, onOpenProject, onDrag, setProgress, patchProject, onAnother }) {
  const [adding, setAdding] = useState(false)
  const [all, setAll] = useState(false)
  const [matrix, setMatrix] = useState(false)
  const [top, ...rest] = rows
  const alternatives = all ? rest : rest.slice(0, SHOWN)
  const today = day(new Date())
  const showing = new Set([top, ...alternatives].filter(Boolean).map((r) => r.task.id))
  const alsoDue = rows.filter((r) => r.date && r.date <= today && !showing.has(r.task.id))
  const groups = comingUp({ tasks, projects, events, busy })
  const next = groups[0]?.items[0]
  const resting = restingProjects(tasks, projects)
  const pastDue = projects.filter((p) => p.date && (p.progress ?? 0) < 5 && p.date < today)
  // A date or time typed in the title still counts if none was picked, and #name links a task to that project.
  const add = (x, kind, type) => {
    const p = parseQuick(x.title, projects)
    const linked = type === 'Task' && kind === 'Reminder' && p.projectId ? { projectId: p.projectId } : {}
    onAdd({ ...x, title: p.title, date: x.date || p.due || '', start: x.start || p.start || '', ...linked }, kind, type)
    setAdding(false)
  }
  const openUp = (x) => (x.project ? onOpenProject(x.project) : onOpen(x.task))

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12">
      <div className="min-w-0">
        <button className={`${btn} ${BLUE} mb-4 min-h-11 px-6`} onClick={() => setAdding(true)}>+ Add</button>
        {adding && <MeetingSheet meeting={{ title: '', date: '', start: '', end: '' }} allowNoDate startKind="Reminder" goals={goals} onSave={add} onClose={() => setAdding(false)} />}
        {pastDue.map((p) => <PastDue key={p.id} p={p} onDone={setProgress} onNewDate={patchProject} />)}
        {next && (
          <details className="mb-4 md:hidden">
            <summary className="cursor-pointer text-sm text-slate-700">Next: {next.label}</summary>
            <div className="mt-2"><ComingUpList groups={groups} onOpenItem={openUp} /></div>
          </details>
        )}

        {top ? (
          <section className="rounded-2xl bg-panel p-5 md:p-6" aria-label="Top pick">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Top pick</h2>
            <p className="greeting mt-2 break-words text-4xl md:text-5xl">{top.task.title}</p>
            <p className="mt-3 text-slate-700">{top.why}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className={`${btn} ${BLUE} min-h-11 px-6`} onClick={() => onStart(top.task)}>Start</button>
              <button className={`${btn} ${ghost} min-h-11`} onClick={() => onDone(top.task)}>Done</button>
              <button className={`${btn} min-h-11 text-accent hover:bg-pale`} onClick={() => onOpen(top.task)}>Details</button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl bg-panel p-5 md:p-6">
            <p className="greeting text-4xl md:text-5xl">{resting.length ? 'Nothing left for today.' : "What's on your plate?"}</p>
            <p className="mt-3 text-slate-700">{resting.length ? 'Add something else, or keep going with another session.' : 'Add what you have to do, and Desker suggests where to start.'}</p>
                      </section>
        )}

        {alsoDue.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 pl-1 text-sm">
            <span className="text-slate-600">Also due today:</span>
            {alsoDue.map((r) => (
              <span key={r.task.id} className="flex items-center gap-1">
                <label className="flex h-11 w-9 cursor-pointer items-center justify-center"><input type="checkbox" className="tick" checked={false} onChange={() => onDone(r.task)} aria-label={`Mark ${r.task.title} done`} /></label>
                <button className="min-h-11 text-left" onClick={() => onOpen(r.task)}>{r.task.title}{r.date < today ? ' (overdue)' : ''}</button>
              </span>
            ))}
          </div>
        )}

        {!goals.length && finderSkipped && <button className="mt-3 min-h-11 text-sm text-accent underline" onClick={onFinder}>Find your goals (1 min)</button>}

        {rest.length > 0 && (
          <section className="mt-6" aria-label="Or pick one of these">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Or pick one of these</h2>
            <ul className="space-y-1">
              {alternatives.map((r, i) => <Row key={r.task.id} row={r} n={i + 2} onDone={onDone} onStart={onStart} onOpen={onOpen} />)}
            </ul>
          </section>
        )}
        {resting.length > 0 && (
          <section className="mt-6" aria-label="Done for today">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Done for today</h2>
            <ul className="space-y-1">
              {resting.map((p) => (
                <li key={p.id} className={`${rowCard} flex items-center gap-1 pl-3 pr-1`}>
                  <button className="min-h-11 min-w-0 flex-1 break-words py-1 text-left" onClick={() => onOpenProject(p)}>{p.title}</button>
                  <button className={`${btn} shrink-0 text-accent hover:bg-pale`} onClick={() => onAnother(p)}>Another session</button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {rows.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-5 text-sm">
            {rest.length > SHOWN && <button className="min-h-11 text-accent underline" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all (${rest.length})`}</button>}
            <button className="min-h-11 text-accent underline" aria-expanded={matrix} onClick={() => setMatrix(!matrix)}>{matrix ? 'Hide matrix' : 'View matrix'}</button>
            <span className="text-slate-600">Done this week: {doneStats(tasks).week}</span>
          </div>
        )}
        {matrix && <Matrix rows={rows} onDrop={onDrag} onDone={onDone} onStart={onStart} onOpen={onOpen} />}
      </div>
      <ComingUp groups={groups} onOpenItem={openUp} />
    </div>
  )
}
