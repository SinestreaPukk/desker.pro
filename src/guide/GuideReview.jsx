import { useState } from 'react'
import { post } from '../api.js'
import { BLUE, btn, ghost, input, rowCard, LEVELS } from '../ui.js'
import { areaTag } from './questions.js'

const BADGE = ['Vision', 'Long', 'Mid', 'Short']
const Tag = ({ a }) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${areaTag(a)}`}>{a}</span>

function Card({ g, areas, patch, remove }) {
  const [rw, setRw] = useState(null) // { busy } | { title, why, firstStep } | { error }
  const rewrite = async () => {
    setRw({ busy: true })
    try { setRw(await post('/api/chat', { mode: 'guide-rewrite', goal: { title: g.title, area: g.area, level: LEVELS[g.level].name, why: g.why } })) } catch (e) { setRw({ error: e.message }) }
  }
  return (
    <li className={`${rowCard} p-3`}>
      <div className="flex items-center gap-2">
        {g.top && <span title="One of your top 3 this year" aria-label="Top 3 goal">⭐</span>}
        <input autoFocus={!g.title} className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-1 font-medium hover:border-control" aria-label="Goal title" placeholder="Describe the goal" value={g.title} onChange={(e) => patch({ title: e.target.value })} />
        <span className="shrink-0 rounded-full bg-pale px-2.5 py-0.5 text-xs">{BADGE[g.level]}</span>
      </div>
      {g.why && <p className="mt-1 px-1 text-sm text-slate-600">{g.why}</p>}
      {g.firstStep && <p className="px-1 text-sm">First step: {g.firstStep}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <select className={`${input} !py-1`} aria-label="Level" value={g.level} onChange={(e) => patch({ level: +e.target.value })}>
          {LEVELS.slice(1).map((l, k) => <option key={l.name} value={k + 1}>{l.name}</option>)}
        </select>
        <select className={`${input} !py-1`} aria-label="Area" value={g.area || ''} onChange={(e) => patch({ area: e.target.value || undefined })}>
          <option value="">No area</option>
          {[...new Set([...areas, g.area].filter(Boolean))].map((x) => <option key={x}>{x}</option>)}
        </select>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!g.happiness} onChange={(e) => patch({ happiness: e.target.checked })} />Happiness</label>
        <button className={`${btn} hover:bg-panel`} disabled={!g.title.trim() || rw?.busy} onClick={rewrite}>✨ Rewrite</button>
        <button className={`${btn} text-danger hover:bg-panel`} onClick={remove}>Delete</button>
      </div>
      {rw && (
        <div className="mt-2 rounded-xl bg-panel p-3 text-sm" role="status">
          {rw.busy ? 'Rewriting…' : rw.error ? <>{rw.error} <button className="underline" onClick={() => setRw(null)}>Dismiss</button></> : (
            <>
              <p className="text-slate-600">Before: {g.title}</p>
              <p>After: {rw.title}</p>
              <div className="mt-2 flex gap-2">
                <button className={`${btn} ${BLUE}`} onClick={() => { patch({ title: rw.title, ...(rw.why && { why: rw.why }), ...(rw.firstStep && { firstStep: rw.firstStep }) }); setRw(null) }}>Use new</button>
                <button className={`${btn} ${ghost}`} onClick={() => setRw(null)}>Keep mine</button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}

export default function GuideReview({ result, setResult, areas, onClose, onBack, onSave }) {
  const [view, setView] = useState('area')
  const { vision, summary, letGo, goals } = result
  const patchGoal = (id) => (p) => setResult((r) => ({ ...r, goals: r.goals.map((g) => (g.id === id ? { ...g, ...p } : g)) }))
  const removeGoal = (id) => () => setResult((r) => ({ ...r, goals: r.goals.filter((g) => g.id !== id) }))
  const addGoal = (area) => setResult((r) => ({ ...r, goals: [...r.goals, { id: Math.max(Date.now(), ...r.goals.map((g) => g.id + 1)), title: '', level: 3, happiness: false, ...(area && { area }) }] }))
  const groups = [...new Set([...areas, ...goals.map((g) => g.area).filter(Boolean)])]
  const toggle = { 'area': 'By area', 'level': 'By level' }
  return (
    <>
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h1 className="text-lg font-semibold">Review your goals</h1>
        <button className={`${btn} hover:bg-panel`} onClick={onClose}>Save &amp; close</button>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <section>
            <label className="text-sm text-slate-600" htmlFor="vision">Your vision</label>
            <textarea id="vision" rows={2} className={`${input} mt-1 w-full resize-y font-serif text-xl`} maxLength={300} placeholder="One sentence about the life you want" value={vision} onChange={(e) => setResult((r) => ({ ...r, vision: e.target.value }))} />
            {summary && <p className="mt-2 text-slate-700">{summary}</p>}
          </section>
          <div className="flex gap-2" role="group" aria-label="View">
            {Object.entries(toggle).map(([k, label]) => <button key={k} className={`${btn} ${view === k ? BLUE : ghost}`} aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>)}
          </div>
          {view === 'area' ? (
            <div className="space-y-3">
              {[...groups, ...(goals.some((g) => !g.area) ? [''] : [])].map((area) => (
                <details key={area} open className="rounded-2xl bg-panel p-3">
                  <summary className="flex cursor-pointer items-center gap-2 font-medium">{area ? <Tag a={area} /> : 'No area'}<span className="text-sm font-normal text-slate-600">{goals.filter((g) => (g.area || '') === area).length === 1 ? '1 goal' : `${goals.filter((g) => (g.area || '') === area).length} goals`}</span></summary>
                  <ul className="mt-3 space-y-2">
                    {goals.filter((g) => (g.area || '') === area).map((g) => <Card key={g.id} g={g} areas={areas} patch={patchGoal(g.id)} remove={removeGoal(g.id)} />)}
                  </ul>
                  <button className={`${btn} mt-2 hover:bg-white`} onClick={() => addGoal(area)}>+ Add goal</button>
                </details>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2" aria-label="Pyramid preview">
              <section className={`w-full ${LEVELS[0].w} ${LEVELS[0].cls} rounded-2xl p-4 text-center`}><h2 className="font-semibold">Vision</h2><p className="text-sm">{vision || 'No vision yet'}</p></section>
              {LEVELS.slice(1).map((l, k) => (
                <section key={l.name} className={`w-full ${l.w} ${l.cls} rounded-2xl p-4`}>
                  <h2 className="text-center font-semibold">{l.name} <span className="text-sm font-normal">{l.hint}</span></h2>
                  <ul className="mt-2 space-y-2">
                    {!goals.some((g) => g.level === k + 1) && <li className="text-center text-sm">No goals yet</li>}
                    {goals.filter((g) => g.level === k + 1).map((g) => (
                      <li key={g.id} className="flex items-center gap-2 rounded-xl bg-white/85 px-3 py-2 text-sm">{g.top && <span aria-label="Top 3 goal">⭐</span>}<span className="min-w-0 flex-1 break-words">{g.title}{g.happiness && <span className="ml-2 rounded-full bg-pale px-2 text-xs">happiness</span>}</span>{g.area && <Tag a={g.area} />}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <section>
            <h2 className="font-semibold">Let go</h2>
            <p className="text-sm text-slate-600">A reminder of what you will stop doing. Not saved as goals.</p>
            <ul className="mt-2 space-y-2">
              {letGo.map((x, k) => (
                <li key={k} className="flex gap-2">
                  <input className={`${input} min-w-0 flex-1`} aria-label={`Let go ${k + 1}`} value={x} onChange={(e) => setResult((r) => ({ ...r, letGo: r.letGo.map((y, j) => (j === k ? e.target.value : y)) }))} />
                  <button className={`${btn} hover:bg-panel`} aria-label={`Remove let go ${k + 1}`} onClick={() => setResult((r) => ({ ...r, letGo: r.letGo.filter((_, j) => j !== k) }))}>×</button>
                </li>
              ))}
            </ul>
            <button className={`${btn} mt-2 hover:bg-panel`} onClick={() => setResult((r) => ({ ...r, letGo: [...r.letGo, ''] }))}>+ Add</button>
          </section>
        </div>
      </main>
      <div className="border-t border-line bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-2xl gap-2">
          <button className={`${btn} ${ghost} min-h-11`} onClick={onBack}>Back to answers</button>
          <button className={`${btn} ${BLUE} ml-auto min-h-11 px-6`} disabled={!vision.trim() && !goals.some((g) => g.title.trim())} onClick={onSave}>Save to my goals</button>
        </div>
      </div>
    </>
  )
}
