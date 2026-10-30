import { useState, useEffect, useMemo, useRef } from 'react'
import { post } from '../api.js'
import { btn, input } from '../ui.js'
import { track } from '../track.js'
import { AREAS, PHASES, stepsFor, minutesLeft, tagItems, chipLabel, qaOf, fromAI, toSave } from './questions.js'
import GuideReview from './GuideReview.jsx'
import { Button } from '../components/ui.jsx'

const chip = (on) => `chip min-h-11 rounded-full border px-4 py-2 text-sm transition ${on ? 'border-accent bg-pale text-ink' : 'border-control bg-white text-slate-700 hover:bg-pale'}`
const EMPTY = { vision: '', summary: '', letGo: [], goals: [] }

// Full-screen wizard: one question per screen, autosaved into data.guide so it can be resumed or retaken.
export default function Guide({ guide, saveGuide, onClose, onSave }) {
  const [g, setG] = useState(() => ({ areas: [], custom: [], answers: {}, step: 0, ...guide }))
  const [stage, setStage] = useState(g.result ? 'review' : 'ask')
  const [custom, setCustom] = useState('')
  const latest = useRef(g)
  latest.current = g
  useEffect(() => { const id = setTimeout(() => saveGuide(g), 400); return () => clearTimeout(id) }, [g])
  const close = () => { saveGuide(latest.current); onClose() }
  useEffect(() => { const f = (e) => e.key === 'Escape' && close(); addEventListener('keydown', f); return () => removeEventListener('keydown', f) }, [])

  const steps = useMemo(() => stepsFor(g.areas), [g.areas])
  const i = Math.min(g.step, steps.length - 1)
  const s = steps[i]
  useEffect(() => { track('goals_guide_step', { step: i + 1, phase: PHASES[s.phase] }) }, [i])
  const set = (id, v) => setG((x) => ({ ...x, answers: { ...x.answers, [id]: v } }))
  const go = (n) => setG((x) => ({ ...x, step: n }))
  const a = g.answers
  const last = i === steps.length - 1
  const ready = s.kind !== 'areas' || g.areas.length > 0

  const build = async () => {
    const cur = latest.current
    if (cur.result && !confirm('Building again replaces the goals you edited and have not saved. Continue?')) return
    setStage('building')
    try {
      const out = await post('/api/chat', { mode: 'guide', areas: g.areas, qa: qaOf(steps, cur.answers, cur.areas) })
      setG((x) => ({ ...x, result: fromAI(out) }))
      setStage('review')
    } catch (err) { setG((x) => ({ ...x, error: err.message })); setStage('error') }
  }
  const next = () => (!ready ? null : last ? build() : go(i + 1))
  const onKey = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); next() } }
  const toggleArea = (x) => setG((v) => ({ ...v, areas: v.areas.includes(x) ? v.areas.filter((y) => y !== x) : [...v.areas, x] }))
  const addCustom = (e) => {
    e.preventDefault()
    const x = custom.trim().slice(0, 40)
    if (x && ![...AREAS, ...g.custom].includes(x)) setG((v) => ({ ...v, custom: [...v.custom, x], areas: [...v.areas, x] }))
    setCustom('')
  }
  const insert = (id, text) => set(id, a[id] ? `${a[id].replace(/\s+$/, '')}\n${text}` : text)

  const shell = (body, footer) => (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="Goal discovery guide" onKeyDown={onKey}>
      {body}
      {footer && <div className="border-t border-line bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
    </div>
  )

  if (stage === 'building') return shell(
    <div className="m-auto text-center" role="status"><div className="mb-4 flex justify-center gap-1"><span className="dot" /><span className="dot" style={{ animationDelay: '150ms' }} /><span className="dot" style={{ animationDelay: '300ms' }} /></div>
      <p className="text-lg">Building your goals…</p><p className="text-sm text-slate-600">This takes about 15 seconds.</p></div>)

  if (stage === 'error') return shell(
    <div className="m-auto max-w-sm px-6 text-center" role="alert">
      <p className="text-lg">Couldn't build your goals. Try again.</p>
      <p className="mt-1 text-sm text-slate-600">{g.error} Your answers are saved.</p>
      <div className="mt-5 flex flex-col gap-2">
        <Button variant="primary" className="min-h-11" onClick={build}>Try again</Button>
        <Button variant="secondary" className="min-h-11" onClick={() => { setG((x) => ({ ...x, result: x.result || EMPTY })); setStage('review') }}>Write my goals myself</Button>
        <button className={`${btn} min-h-11 hover:bg-panel`} onClick={() => setStage('ask')}>Back to answers</button>
      </div>
    </div>)

  if (stage === 'review') return shell(
    <GuideReview result={g.result} setResult={(fn) => setG((x) => ({ ...x, result: typeof fn === 'function' ? fn(x.result) : fn }))}
      areas={g.areas} onClose={close} onBack={() => setStage('ask')} onSave={() => { saveGuide(latest.current); onSave(toSave(g.result)) }} />)

  const pct = Math.round((i / (steps.length + 1)) * 100)
  const body = (
    <>
      <header className="border-b border-line px-4 pb-3 pt-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <ol className="flex min-w-0 flex-wrap gap-x-3 text-xs text-slate-600" aria-label="Phases">
            {PHASES.map((p, k) => <li key={p} aria-current={k === s.phase ? 'step' : undefined} className={k === s.phase ? 'font-semibold text-ink' : ''}>{p}</li>)}
          </ol>
          <button className={`${btn} shrink-0 hover:bg-panel`} onClick={close}>Save &amp; close</button>
        </div>
        <div className="mx-auto mt-2 flex max-w-2xl items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-pale" role="progressbar" aria-label="Guide progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-xs text-slate-600">about {minutesLeft(steps, i)} min left</span>
        </div>
        <p className="sr-only" aria-live="polite">Question {i + 1} of {steps.length}, {PHASES[s.phase]}</p>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div key={s.id} className="enter mx-auto max-w-2xl">
          {s.area && <p className="mb-2 text-sm font-medium text-accent">{s.area}</p>}
          <h1 id="q" className="text-xl leading-snug sm:text-2xl">{s.q}</h1>
          <p id="hint" className="mt-2 text-sm text-slate-600">{s.hint}</p>
          <div className="mt-5">
            {s.kind === 'areas' && (
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="q">
                {[...AREAS, ...g.custom].map((x) => <button key={x} type="button" className={chip(g.areas.includes(x))} aria-pressed={g.areas.includes(x)} onClick={() => toggleArea(x)}>{x}</button>)}
                <form className="flex gap-2" onSubmit={addCustom}>
                  <input className={`${input} w-44`} aria-label="Add your own area" placeholder="+ Add your own" value={custom} onChange={(e) => setCustom(e.target.value)} />
                  {custom.trim() && <Button variant="secondary">Add</Button>}
                </form>
              </div>
            )}
            {s.kind === 'text' && (
              <>
                <textarea autoFocus className={`${input} min-h-40 w-full resize-y`} aria-labelledby="q" aria-describedby="hint" maxLength={1500} value={a[s.id] || ''} onChange={(e) => set(s.id, e.target.value)} />
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Examples">
                  {s.chips.map((c) => <button key={c} type="button" className={chip(false)} onClick={() => insert(s.id, c)}>{c.trim()}…</button>)}
                </div>
              </>
            )}
            {s.kind === 'rate' && (
              <ul className="space-y-4">
                {g.areas.map((x) => (
                  <li key={x}>
                    <label className="block"><span className="flex justify-between text-sm"><span>{x}</span><span className="tabular-nums text-slate-600">{a.q4?.[x] ?? 'not rated'}</span></span>
                      <input type="range" min="1" max="10" className="mt-2 w-full" aria-label={`${x}, 1 to 10`} value={a.q4?.[x] ?? 5} onChange={(e) => set('q4', { ...a.q4, [x]: +e.target.value })} /></label>
                  </li>
                ))}
              </ul>
            )}
            {s.kind === 'triple' && [0, 1, 2].map((k) => (
              <label key={k} className="mb-3 block text-sm">Goal {k + 1}
                <input autoFocus={k === 0} className={`${input} mt-1 w-full`} maxLength={200} value={a.q10?.[k] || ''} onChange={(e) => { const v = [...(a.q10 || ['', '', ''])]; v[k] = e.target.value; set('q10', v) }} />
              </label>
            ))}
            {s.kind === 'tag' && (() => {
              const items = tagItems(a, g.areas)
              const cycle = { undefined: 'x', x: 'o', o: undefined }
              return items.length ? (
                <ul className="space-y-2">
                  {items.map((it) => {
                    const t = a.q11?.[it]
                    const next = { ...a.q11 }
                    if (cycle[t]) next[it] = cycle[t]; else delete next[it]
                    return (
                      <li key={it}><button type="button" className={`${chip(!!t)} w-full text-left`} aria-label={`${it}: ${t === 'x' ? 'excited' : t === 'o' ? 'obligation' : 'not marked'}. Tap to change.`} onClick={() => set('q11', next)}>
                        <span className="mr-2">{t === 'x' ? '⚡ Excited' : t === 'o' ? '😐 Obligation' : '·'}</span>{chipLabel(it)}</button></li>
                    )
                  })}
                </ul>
              ) : <p className="text-sm text-slate-600">Nothing to mark yet. Answer some earlier questions, or skip ahead.</p>
            })()}
          </div>
        </div>
      </main>
    </>
  )
  const foot = (
    <div className="mx-auto flex max-w-2xl items-center gap-2">
      <Button variant="secondary" className="min-h-11" disabled={i === 0} onClick={() => go(i - 1)}>Back</Button>
      {s.kind !== 'areas' && <button className={`${btn} min-h-11 hover:bg-panel`} onClick={() => { set(s.id, undefined); last ? setTimeout(build, 0) : go(i + 1) }}>Skip question</button>}
      <Button variant="primary" className="ml-auto min-h-11 px-6" disabled={!ready} onClick={next} title="Cmd/Ctrl+Enter">{last ? (g.result ? 'Rebuild my goals' : 'Build my goals') : 'Next'}</Button>
    </div>
  )
  return shell(body, foot)
}
