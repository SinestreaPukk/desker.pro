import { useState } from 'react'
import { BLUE, btn, ghost, input, panel, LEVELS } from '../ui.js'
import Review from '../Review.jsx'
import { areaTag } from '../guide/questions.js'

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
      <h2 className="text-lg font-semibold">Things I want to do for fun</h2>
      <p className="mb-3 text-sm text-slate-600">Hobbies and things that make you happy. The AI agent schedules them between your tasks.</p>
      <form className="mb-3 flex gap-2" onSubmit={add}>
        <input className={`${input} min-w-0 flex-1`} placeholder="e.g. Play guitar" aria-label="New hobby" value={v} onChange={(e) => setV(e.target.value)} />
        <button className={`${btn} ${BLUE}`}>Add</button>
      </form>
      <ul className="flex flex-wrap gap-2">
        {hobbies.map((h) => (
          <li key={h.id} className="flex items-center gap-1 rounded-full bg-white py-1 pl-4 pr-1 text-sm">
            {h.title}
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" aria-label={`Remove ${h.title}`}
              onClick={() => setHobbies(hobbies.filter((x) => x.id !== h.id))}>×</button>
          </li>
        ))}
        {!hobbies.length && <li className="text-sm text-slate-600">Nothing yet. What would you do with a free hour?</li>}
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
      <h2 className="text-lg font-semibold">Not sure what your goals are? Take the 10-minute guide</h2>
      <p className="mb-3 text-sm text-slate-600">A few short questions, then the AI drafts goals you can edit before saving.</p>
      <div className="flex gap-2"><button className={`${btn} ${BLUE}`} onClick={() => onGuide('start')}>Start</button><button className={`${btn} ${ghost}`} onClick={setSkipped}>Skip</button></div>
    </div>
  )
  return (
    <p className="mb-4 flex flex-wrap gap-x-4 text-sm">
      <button className="min-h-11 text-accent underline" onClick={() => onGuide('start')}>{goals.length ? 'Discover more goals' : 'Take the 10-minute guide'}</button>
      {guide?.done && <button className="min-h-11 text-accent underline" onClick={() => onGuide('start')}>Retake the guide</button>}
    </p>
  )
}

export default function Goals({ goals, setGoals, hobbies, setHobbies, tasks, onReview, guide, onGuide, fresh, onMakeTasks, onDismissOffer }) {
  const [area, setArea] = useState('')
  const areas = [...new Set(goals.map((g) => g.area).filter(Boolean))]
  const shown = area && areas.includes(area) ? goals.filter((g) => g.area === area) : goals
  const blank = { title: '', level: 3, happiness: false }
  const [d, setD] = useState(blank)
  const submit = (e) => {
    e.preventDefault()
    if (!d.title.trim()) return
    setGoals(d.id ? goals.map((g) => (g.id === d.id ? d : g)) : [...goals, { ...d, id: Date.now() }])
    setD(blank)
  }
  return (
    <>
      <GuideEntry goals={goals} guide={guide} onGuide={onGuide} setSkipped={() => onGuide('skip')} />
      {fresh?.offer && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-pale p-4 text-sm">
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
          <label className="flex items-center gap-2 text-sm">
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
          <section key={l.name} className={`w-full ${l.w} ${l.cls} rounded-2xl p-5`}>
            <h2 className="text-center text-lg font-semibold">{l.name} <span className="text-sm font-normal text-slate-800">{l.hint}</span></h2>
            <ul className="mt-3 space-y-2">
              {!shown.some((g) => g.level === i) && <li className="text-center text-sm text-slate-800">No goals yet</li>}
              {shown.filter((g) => g.level === i).map((g) => (
                <li key={g.id} className={`flex items-center justify-between gap-2 rounded-xl bg-white/85 px-4 py-2 transition ${fresh?.ids.includes(g.id) ? 'ring-2 ring-accent' : ''}`}>
                  <span className="min-w-0 break-words">{g.top && <span aria-label="Top 3 goal">⭐ </span>}{g.title}{g.area && <span className={`ml-2 rounded-full px-2 text-xs ${areaTag(g.area)}`}>{g.area}</span>}{g.happiness && <span className="ml-2 rounded-full bg-pale px-2 text-xs">happiness</span>}</span>
                  <span className="flex shrink-0 gap-1">
                    <button className={`${btn} hover:bg-slate-100`} onClick={() => setD(g)}>Edit</button>
                    <button className={`${btn} text-danger hover:bg-slate-100`} onClick={() => setGoals(goals.filter((x) => x.id !== g.id))}>Delete</button>
                  </span>
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
