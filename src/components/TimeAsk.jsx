import { useState } from 'react'
import { btn, BLUE, ghost, input } from '../ui.js'

const STD = [15, 30, 60, 120]
export const fmtMin = (m) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : m === 60 ? '1 hour' : `${m / 60} hours`)

// After a task is ticked off without the timer: "How long did that take?" The estimate is preselected, so the common case is one tap on Save.
// Dismissible; skipping records nothing. onSave(minutes).
export default function TimeAsk({ title, est, onSave, onSkip }) {
  const estMin = est > 0 ? Math.round(est * 60) : null
  const [sel, setSel] = useState(estMin ?? 30)
  const [other, setOther] = useState('')
  const chips = estMin && !STD.includes(estMin) ? [estMin, ...STD] : STD
  const custom = sel === 'other'
  const minutes = custom ? Math.round(+other) : sel
  return (
    <section role="group" aria-label={`How long did ${title} take?`} className="px-panel bg-yuki-0 p-3">
      <p className="break-words">How long did <b className="font-normal underline">{title}</b> take?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((m) => (
          <button key={m} type="button" aria-pressed={sel === m} className={`${btn} ${sel === m ? BLUE : ghost}`} onClick={() => setSel(m)}>{fmtMin(m)}{m === estMin ? ' (planned)' : ''}</button>
        ))}
        <button type="button" aria-pressed={custom} className={`${btn} ${custom ? BLUE : ghost}`} onClick={() => setSel('other')}>Other</button>
      </div>
      {custom && (
        <label className="mt-2 flex items-center gap-2 text-base">Minutes
          <input autoFocus type="number" min="1" max="600" className={`${input} w-24`} value={other} onChange={(e) => setOther(e.target.value)} />
        </label>
      )}
      <div className="mt-3 flex gap-2">
        <button className={`${btn} ${BLUE}`} disabled={!(minutes >= 1 && minutes <= 600)} onClick={() => onSave(minutes)}>Save</button>
        <button className={`${btn} ${ghost}`} onClick={onSkip}>Skip</button>
      </div>
    </section>
  )
}
