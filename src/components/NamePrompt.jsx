import { useState } from 'react'
import { Kodama } from '../px.jsx'
import { btn, ghost, input, BLUE } from '../ui.js'
import { cleanName, PERSONA } from '../persona.js'
import { track } from '../analytics.js'

// Asked once, of people who started before the kodama could be named. Saving a name or keeping the default both end the question for good (data.kodama.nameAsked).
export default function NamePrompt({ setData }) {
  const [name, setName] = useState('')
  const finish = (n) => setData((d) => ({ ...d, kodama: { ...d.kodama, ...(n && { name: n }), nameAsked: true } }))
  const save = (e) => { e.preventDefault(); const n = cleanName(name); if (name.trim()) { track('kodama_named'); finish(n) } }
  return (
    <div className="px-backdrop fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <form role="dialog" aria-modal="true" aria-label="Name your kodama" className="px-panel w-full max-w-md bg-yuki-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onSubmit={save}>
        <div className="flex items-end gap-3"><Kodama /><p className="min-w-0 flex-1 text-2xl">I don't have a name yet. What should you call me?</p></div>
        <input autoFocus className={`${input} mt-4 w-full`} aria-label="Name" maxLength="20" placeholder={PERSONA.defaultName} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`${btn} ${BLUE}`} disabled={!name.trim()}>Save</button>
          <button type="button" className={`${btn} ${ghost}`} onClick={() => finish()}>Keep {PERSONA.defaultName}</button>
        </div>
        <p className="mt-2 text-xs text-slate-700">You can change it any time in the kodama's window on Today.</p>
      </form>
    </div>
  )
}
