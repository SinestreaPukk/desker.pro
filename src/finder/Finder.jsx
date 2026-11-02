import { useEffect, useState } from 'react'
import { BLUE, btn, ghost, input, chip } from '../ui.js'
import { rankedGoals, visionOf } from '../goals.js'
import { AREAS, MAX_AREAS, VISION_WORDS, mergeGoals, stepsFor, visionSentence } from './catalog.js'
import { AboutChips } from './NewGoal.jsx'

const Arrow = ({ label, onClick, disabled, d }) => (
  <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-panel disabled:opacity-30" aria-label={label} disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  </button>
)
export const UP = 'M8 13V3M3.5 7.5L8 3l4.5 4.5'
export const DOWN = 'M8 3v10M3.5 8.5L8 13l4.5-4.5'
export { Arrow }

// Finds goals in about a minute with no AI: at most 5 questions, mostly one tap each. Choices word things; they never change the ranking.
export default function Finder({ goals, onSave, onClose }) {
  const existing = rankedGoals(goals)
  const [areas, setAreas] = useState([])
  const [titles, setTitles] = useState({})
  const [step, setStep] = useState(0)
  const [typing, setTyping] = useState(false) // "Something else": type the title on this screen
  const [result, setResult] = useState(null)
  useEffect(() => { const f = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', f); return () => removeEventListener('keydown', f) }, [])

  const steps = stepsFor(areas)
  const s = steps[Math.min(step, steps.length - 1)]
  const toggleArea = (a) => setAreas((x) => (x.includes(a) ? x.filter((y) => y !== a) : x.length < MAX_AREAS ? [...x, a] : x))
  const toResult = (word) => {
    const now = Date.now()
    const { goals: merged, left } = mergeGoals(existing, areas.map((area, i) => ({ id: now + i, area, happiness: false, title: titles[area] })))
    setResult({ goals: merged, left, vision: visionSentence(word, merged.map((g) => g.title)) || visionOf(goals)?.title || '' })
  }
  const next = () => { setTyping(false); setStep(step + 1) }
  const pick = (area, title) => {
    setTitles((t) => ({ ...t, [area]: title }))
    if (title) next(); else setTyping(true)
  }
  const swap = (i, j) => setResult((r) => { const list = [...r.goals]; [list[i], list[j]] = [list[j], list[i]]; return { ...r, goals: list } })
  const patchGoal = (id, title) => setResult((r) => ({ ...r, goals: r.goals.map((g) => (g.id === id ? { ...g, title } : g)) }))

  const body = result ? (
    <>
      <h1 className="greeting text-3xl sm:text-4xl">Your vision and goals</h1>
      <label className="block text-sm text-slate-600">Vision (keep it, or reword it)
        <input className={`${input} mt-1 w-full text-ink`} value={result.vision} placeholder="One sentence about where you're going" onChange={(e) => setResult({ ...result, vision: e.target.value })} />
      </label>
      <ol className="space-y-2">
        {result.goals.map((g, i) => (
          <li key={g.id} className="flex items-center gap-2">
            <span className="greeting w-7 shrink-0 text-center text-2xl">{i + 1}</span>
            <input className={`${input} min-w-0 flex-1`} aria-label={`Goal ${i + 1}`} value={g.title} onChange={(e) => patchGoal(g.id, e.target.value)} />
            <Arrow label={`Move ${g.title} up`} d={UP} disabled={i === 0} onClick={() => swap(i, i - 1)} />
            <Arrow label={`Move ${g.title} down`} d={DOWN} disabled={i === result.goals.length - 1} onClick={() => swap(i, i + 1)} />
          </li>
        ))}
      </ol>
      {!result.goals.length && <p className="text-sm text-slate-600">No goals picked. You can add them on the Goals page any time.</p>}
      {result.left.length > 0 && <p className="text-sm text-slate-600">You can have 5 goals, so these were left out: {result.left.map((g) => g.title).join(', ')}.</p>}
    </>
  ) : s.kind === 'areas' ? (
    <>
      <h1 className="greeting text-3xl sm:text-4xl">Which parts of life do you want to move forward this year?</h1>
      <p className="text-sm text-slate-600">Up to {MAX_AREAS}. The order you tap them is the order they rank in, and you can change it at the end.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Parts of life">
        {AREAS.map(({ name }) => {
          const n = areas.indexOf(name)
          return <button key={name} type="button" className={chip(n >= 0)} aria-pressed={n >= 0} disabled={n < 0 && areas.length >= MAX_AREAS} onClick={() => toggleArea(name)}>{n >= 0 ? `${n + 1}  ` : ''}{name}</button>
        })}
      </div>
    </>
  ) : s.kind === 'about' ? (
    <>
      <h1 key={s.area} className="greeting text-3xl sm:text-4xl">{s.area}: what's it about?</h1>
      <AboutChips area={s.area} value={titles[s.area]} onPick={(t) => pick(s.area, t)} />
      {typing && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); next() }}>
          <input autoFocus className={`${input} min-w-0 flex-1`} aria-label="Goal title" placeholder="Name this goal" value={titles[s.area] || ''} onChange={(e) => setTitles((t) => ({ ...t, [s.area]: e.target.value }))} />
          <button className={`${btn} ${BLUE}`}>Next</button>
        </form>
      )}
    </>
  ) : (
    <>
      <h1 className="greeting text-3xl sm:text-4xl">In five years, what do you want most?</h1>
      <div className="flex flex-wrap gap-2" role="group" aria-label="What you want most">
        {VISION_WORDS.map((w) => <button key={w} type="button" className={chip(false)} onClick={() => toResult(w)}>{w}</button>)}
      </div>
    </>
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="Find your goals">
      <header className="flex items-center justify-between px-4 pt-3">
        <img src="/favicon.svg" alt="" className="h-8 w-8" />
        <button className={`${btn} hover:bg-panel`} onClick={onClose}>{result ? 'Close' : 'Skip'}</button>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div key={result ? 'result' : step} className="enter mx-auto max-w-2xl space-y-5">{body}</div>
      </main>
      <footer className="border-t border-line bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          {(step > 0 || result) && <button className={`${btn} ${ghost} min-h-11`} onClick={() => { if (result) setResult(null); else { setTyping(false); setStep(step - 1) } }}>Back</button>}
          {result
            ? <button className={`${btn} ${BLUE} ml-auto min-h-11 px-6`} onClick={() => onSave(result.goals.filter((g) => g.title.trim()), result.vision)}>Looks right</button>
            : s.kind === 'vision'
              ? <button className={`${btn} ml-auto min-h-11 hover:bg-panel`} onClick={() => toResult('')}>Leave this out</button>
              : <button className={`${btn} ${BLUE} ml-auto min-h-11 px-6`} disabled={s.kind === 'areas' && !areas.length} onClick={next}>Next</button>}
        </div>
      </footer>
    </div>
  )
}
