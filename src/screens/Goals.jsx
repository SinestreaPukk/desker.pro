import { useState } from 'react'
import { BLUE, btn, ghost, input, panel, LEVELS } from '../ui.js'
import Review from '../Review.jsx'

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
export default function Goals({ goals, setGoals, hobbies, setHobbies, tasks, onReview }) {
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
      <form className={`${panel} mb-6`} onSubmit={submit}>
        <div className="flex flex-wrap items-center gap-3">
          <input className={`${input} min-w-48 flex-1`} placeholder="Goal" aria-label="Goal" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          <select className={input} aria-label="Level" value={d.level} onChange={(e) => setD({ ...d, level: +e.target.value })}>
            {LEVELS.map((l, i) => <option key={l.name} value={i}>{l.name} ({l.hint})</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!d.happiness} onChange={(e) => setD({ ...d, happiness: e.target.checked })} /> Happiness goal
          </label>
          <button className={`${btn} ${BLUE}`}>{d.id ? 'Save' : 'Add'}</button>
          {d.id && <button type="button" className={`${btn} ${ghost}`} onClick={() => setD(blank)}>Cancel</button>}
        </div>
      </form>
      <div className="flex flex-col items-center gap-2">
        {LEVELS.map((l, i) => (
          <section key={l.name} className={`w-full ${l.w} ${l.cls} rounded-2xl p-5`}>
            <h2 className="text-center text-lg font-semibold">{l.name} <span className="text-sm font-normal text-slate-800">{l.hint}</span></h2>
            <ul className="mt-3 space-y-2">
              {!goals.some((g) => g.level === i) && <li className="text-center text-sm text-slate-800">No goals yet</li>}
              {goals.filter((g) => g.level === i).map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/85 px-4 py-2">
                  <span className="min-w-0 break-words">{g.title}{g.happiness && <span className="ml-2 rounded-full bg-pale px-2 text-xs">happiness</span>}</span>
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
