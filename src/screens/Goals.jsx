import { useState } from 'react'
import { BLUE, btn, ghost, input, panel, LEVELS } from '../ui.js'
import Review from '../Review.jsx'
import { areaTag } from '../guide/questions.js'
import KodamaCard from '../components/KodamaCard.jsx'
import { msOf, progress, addMilestone, removeMilestone, toggleMilestone } from '../milestones.js'

function Hobbies({ hobbies, setHobbies }) {
  const [v, setV] = useState('')
  const add = (e) => {
    e.preventDefault()
    if (!v.trim()) return
    setHobbies([...hobbies, { id: Date.now(), title: v.trim() }])
    setV('')
  }
  return (
    <section className={`${panel} mt-6`}>
      <h2 className="text-base font-semibold">Things I want to do for fun</h2>
      <p className="mb-3 text-base text-slate-600">Hobbies and things that make you happy. The AI agent schedules them between your tasks.</p>
      <form className="mb-3 flex gap-2" onSubmit={add}>
        <input className={`${input} min-w-0 flex-1`} placeholder="e.g. Play guitar" aria-label="New hobby" value={v} onChange={(e) => setV(e.target.value)} />
        <button className={`${btn} ${BLUE}`}>Add</button>
      </form>
      <ul className="flex flex-wrap gap-2">
        {hobbies.map((h) => (
          <li key={h.id} className="flex items-center gap-1 bg-white py-1 pl-4 pr-1 text-base">
            {h.title}
            <button className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100" aria-label={`Remove ${h.title}`}
              onClick={() => setHobbies(hobbies.filter((x) => x.id !== h.id))}>×</button>
          </li>
        ))}
        {!hobbies.length && <li className="text-base text-slate-600">Nothing yet. What would you do with a free hour?</li>}
      </ul>
    </section>
  )
}

// The goals pyramid: narrowest level on top, the near term at the base.
// Entry points for the optional goal-discovery guide. Never blocks anything else on the page.
function GuideEntry({ goals, guide, onGuide, setSkipped }) {
  const draft = guide && !guide.done && (guide.step > 0 || Object.keys(guide.answers || {}).length > 0 || guide.result)
  if (draft) return (
    <div className={`${panel} mb-6 flex flex-wrap items-center gap-3`}>
      <p className="min-w-48 flex-1">You have a goal guide in progress.</p>
      <button className={`${btn} ${BLUE}`} onClick={() => onGuide('resume')}>Resume where you left off</button>
      <button className={`${btn} ${ghost}`} onClick={() => confirm('Start over? Your answers will be cleared.') && onGuide('fresh')}>Start over</button>
    </div>
  )
  if (!goals.length && !guide?.skipped) return (
    <div className={`${panel} mb-6`}>
      <h2 className="text-base font-semibold">Not sure what your goals are? Take the 10-minute guide</h2>
      <p className="mb-3 text-base text-slate-600">A few short questions, then the AI drafts goals you can edit before saving.</p>
      <div className="flex gap-2"><button className={`${btn} ${BLUE}`} onClick={() => onGuide('start')}>Start</button><button className={`${btn} ${ghost}`} onClick={setSkipped}>Skip</button></div>
    </div>
  )
  return (
    <p className="mb-4 flex flex-wrap gap-x-4 text-base">
      <button className="min-h-11 text-accent underline" onClick={() => onGuide('start')}>{goals.length ? 'Discover more goals' : 'Take the 10-minute guide'}</button>
      {guide?.done && <button className="min-h-11 text-accent underline" onClick={() => onGuide('start')}>Retake the guide</button>}
    </p>
  )
}

export default function Goals({ goals, setGoals, onMilestone, hobbies, setHobbies, tasks, onReview, guide, onGuide, fresh, onMakeTasks, onDismissOffer }) {
  const [area, setArea] = useState('')
  const areas = [...new Set(goals.map((g) => g.area).filter(Boolean))]
  const shown = area && areas.includes(area) ? goals.filter((g) => g.area === area) : goals
  const blank = { title: '', level: 3, happiness: false }
  const [d, setD] = useState(blank)
  const [drafts, setDrafts] = useState({}) // new milestone text per goal id
  const tick = (g, m) => { setGoals(toggleMilestone(goals, g.id, m.id)); if (!m.at) onMilestone?.(g.id, m) }
  const addMs = (e, g) => { e.preventDefault(); setGoals(addMilestone(goals, g.id, drafts[g.id] || '')); setDrafts({ ...drafts, [g.id]: '' }) }
  const submit = (e) => {
    e.preventDefault()
    if (!d.title.trim()) return
    setGoals(d.id ? goals.map((g) => (g.id === d.id ? { ...d, milestones: g.milestones } : g)) : [...goals, { ...d, id: Date.now() }])
    setD(blank)
  }
  return (
    <>
      <KodamaCard goals={goals} className="mb-4" />
      <GuideEntry goals={goals} guide={guide} onGuide={onGuide} setSkipped={() => onGuide('skip')} />
      {fresh?.offer && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 bg-pale p-4 text-base">
          <span className="min-w-48 flex-1">Goals saved. Create tasks from your first steps?</span>
          <button className={`${btn} ${BLUE}`} onClick={onMakeTasks}>Create tasks</button>
          <button className={`${btn} hover:bg-white`} onClick={onDismissOffer}>No thanks</button>
        </div>
      )}
      <form className={`${panel} mb-6`} onSubmit={submit}>
        <div className="flex flex-wrap items-center gap-3">
          <input className={`${input} min-w-48 flex-1`} placeholder="Goal" aria-label="Goal" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          <select className={input} aria-label="Level" value={d.level} onChange={(e) => setD({ ...d, level: +e.target.value })}>
            {LEVELS.map((l, i) => <option key={l.name} value={i}>{l.name} ({l.hint})</option>)}
          </select>
          <input className={`${input} w-40`} list="goal-areas" placeholder="Area (optional)" aria-label="Area" value={d.area || ''} onChange={(e) => setD({ ...d, area: e.target.value || undefined })} />
          <datalist id="goal-areas">{areas.map((x) => <option key={x} value={x} />)}</datalist>
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" checked={!!d.happiness} onChange={(e) => setD({ ...d, happiness: e.target.checked })} /> Happiness goal
          </label>
          <button className={`${btn} ${BLUE}`}>{d.id ? 'Save' : 'Add'}</button>
          {d.id && <button type="button" className={`${btn} ${ghost}`} onClick={() => setD(blank)}>Cancel</button>}
        </div>
      </form>
      {areas.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by area">
          {['', ...areas].map((x) => <button key={x} className={`${btn} ${area === x ? BLUE : ghost}`} aria-pressed={area === x} onClick={() => setArea(x)}>{x || 'All areas'}</button>)}
        </div>
      )}
      <div className="flex flex-col items-center gap-2">
        {LEVELS.map((l, i) => (
          <section key={l.name} className={`w-full ${l.w} ${l.cls} p-5`}>
            <h2 className="text-center text-base font-semibold">{l.name} <span className="text-base font-normal text-slate-800">{l.hint}</span></h2>
            <ul className="mt-3 space-y-2">
              {!shown.some((g) => g.level === i) && <li className="text-center text-base text-slate-800">No goals yet</li>}
              {shown.filter((g) => g.level === i).map((g) => (
                <li key={g.id} className={`bg-yuki-0 px-4 py-2 ${fresh?.ids.includes(g.id) ? 'ring-2 ring-accent' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 break-words">{g.top && <span aria-label="Top 3 goal" className="mr-2 bg-beni px-1 text-xs text-yuki-0">Top 3</span>}{g.title}{g.area && <span className={`ml-2 px-2 text-xs ${areaTag(g.area)}`}>{g.area}</span>}{g.happiness && <span className="ml-2 bg-pale px-2 text-xs">happiness</span>}</span>
                  <span className="flex shrink-0 gap-1">
                    <button className={`${btn} hover:bg-slate-100`} onClick={() => setD(g)}>Edit</button>
                    <button className={`${btn} text-danger hover:bg-slate-100`} onClick={() => setGoals(goals.filter((x) => x.id !== g.id))}>Delete</button>
                  </span>
                  </div>
                  <div className="mt-2">
                    <p className="flex flex-wrap items-center gap-2 text-base text-slate-700">Milestones <span className="flex gap-1" aria-hidden="true">{msOf(g).map((m) => <span key={m.id} className={`px-pip ${m.at ? 'px-pip-on' : ''}`} />)}</span>{msOf(g).length > 0 && `${progress(g).done} of ${progress(g).total}`}</p>
                    <ul className="mt-1 space-y-1">
                      {msOf(g).map((m) => (
                        <li key={m.id} className="flex items-center gap-2">
                          <input type="checkbox" checked={!!m.at} onChange={() => tick(g, m)} aria-label={`Reached: ${m.title}`} />
                          <span className={`min-w-0 flex-1 break-words ${m.at ? 'text-slate-700 line-through' : ''}`}>{m.title}</span>
                          <button className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-700 hover:bg-yuki-1" aria-label={`Remove milestone ${m.title}`} onClick={() => setGoals(removeMilestone(goals, g.id, m.id))}>×</button>
                        </li>
                      ))}
                    </ul>
                    <form className="mt-1 flex gap-2" onSubmit={(e) => addMs(e, g)}>
                      <input className={`${input} min-w-0 flex-1`} placeholder="Add a milestone" aria-label={`New milestone for ${g.title}`} value={drafts[g.id] || ''} onChange={(e) => setDrafts({ ...drafts, [g.id]: e.target.value })} />
                      <button className={`${btn} ${ghost}`}>Add</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-6"><Review tasks={tasks} goals={goals} onAgent={onReview} /></div>
      <Hobbies hobbies={hobbies} setHobbies={setHobbies} />
    </>
  )
}
