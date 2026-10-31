import { useState } from 'react'
import { Scene, Kodama, SEASONS } from '../px.jsx'
import { input, btn, ghost } from '../ui.js'
import { nameOf, growthOf, stateOf, STAGES } from '../kodama.js'
import { cleanName } from '../persona.js'
import { track } from '../analytics.js'

// The kodama's home: the window view with the kodama sitting in it. The speech line goes next to it (Today passes it in).
export function Home({ data, focusing, heavy, view }) {
  return (
    <div className="relative">
      <Scene {...view} />
      <div className="pointer-events-none absolute bottom-1 left-3 flex sm:left-6" style={{ '--px': 'var(--px-scene)' }}><Kodama mood={stateOf(data, { focusing, heavy })} /></div>
    </div>
  )
}

// Name, growth and the window view. Growth only ever goes up; the next unlock is shown as something to look forward to, never as a debt.
export function KodamaSettings({ data, setData, view }) {
  const g = growthOf(data), name = nameOf(data)
  const [draft, setDraft] = useState(name)
  const save = () => { const n = cleanName(draft); setDraft(n); if (n !== name) track('kodama_named'); if (n !== name) setData((d) => ({ ...d, kodama: { ...d.kodama, name: n } })) }
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className={`${btn} ${ghost} ml-auto shrink-0`} aria-haspopup="dialog" onClick={() => setOpen(true)}>{name}, {g.stage.name.toLowerCase()}</button>
      {open && (
        <div className="px-backdrop fixed inset-0 z-40 flex items-end justify-center sm:items-center" onClick={() => setOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label={`${name}, your kodama`} className="px-panel w-full max-w-md space-y-3 bg-yuki-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-base" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base">{name}, {g.stage.name.toLowerCase()}</h2>
              <button autoFocus className={btn} onClick={() => setOpen(false)}>Close</button>
            </div>
            <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); save() }}>
              <label className="flex items-center gap-2">Its name<input className={`${input} w-40`} maxLength="20" value={draft} onChange={(e) => setDraft(e.target.value)} /></label>
              <button className={`${btn} ${ghost}`} disabled={cleanName(draft) === name}>Save name</button>
            </form>
            <div>
              <p className="text-slate-700">{g.next ? `It grows when you log honest times, take energy checks and wrap up days. Next: ${g.next.name}.` : 'Fully grown. It keeps you company.'}</p>
              <div className="mt-1 h-2 max-w-xs overflow-hidden bg-panel" role="progressbar" aria-valuenow={g.pct} aria-valuemin="0" aria-valuemax="100" aria-label="Growth"><div className="h-full bg-primary" style={{ width: `${g.pct}%` }} /></div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {[['variant', 'Time of day', ['morning', 'dusk', 'night'], 1], ['season', 'Season', SEASONS, 2]].map(([key, label, opts, need]) => {
                const unlocked = g.index >= need
                return (
                  <label key={key} className="flex items-center gap-2">{label}
                    <select className={`${input} !min-h-0 w-auto capitalize`} disabled={!unlocked} value={unlocked ? data.scene?.[key] || '' : ''}
                      onChange={(e) => setData((d) => ({ ...d, scene: { ...d.scene, [key]: e.target.value || undefined } }))}>
                      <option value="">{unlocked ? 'Automatic' : `At ${STAGES[need].name}`}</option>
                      {unlocked && opts.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
