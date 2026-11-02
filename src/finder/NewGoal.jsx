import { useState } from 'react'
import { btn, BLUE, ghost, input, chip } from '../ui.js'
import { AREAS } from './catalog.js'

const SOMETHING_ELSE = 'Something else'

// The choices for one area. "Something else" gives a blank title.
export function AboutChips({ area, value, onPick }) {
  const { choices } = AREAS.find((a) => a.name === area)
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={`${area}: what's it about?`}>
      {[...choices, SOMETHING_ELSE].map((c) => (
        <button key={c} type="button" className={chip(value === c)} aria-pressed={value === c} onClick={() => onPick(c === SOMETHING_ELSE ? '' : c)}>{c}</button>
      ))}
    </div>
  )
}

// "Add a goal" on the Goals page: area, what it's about, title. Enter saves.
export default function NewGoal({ onAdd, onCancel }) {
  const [area, setArea] = useState('')
  const [picked, setPicked] = useState(false)
  const [title, setTitle] = useState('')
  const save = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), area })
  }
  return (
    <section className="space-y-3 rounded-2xl bg-panel p-4" aria-label="Add a goal">
      {!area && (
        <>
          <p className="text-sm font-medium">Which part of life?</p>
          <div className="flex flex-wrap gap-2">{AREAS.map((a) => <button key={a.name} type="button" className={chip(false)} onClick={() => setArea(a.name)}>{a.name}</button>)}</div>
        </>
      )}
      {area && !picked && (
        <>
          <p className="text-sm font-medium">{area}: what's it about?</p>
          <AboutChips area={area} value={title} onPick={(t) => { setTitle(t); setPicked(true) }} />
        </>
      )}
      {picked && (
        <form className="flex flex-wrap gap-2" onSubmit={save}>
          <input autoFocus className={`${input} min-w-0 flex-1`} aria-label="Goal title" placeholder="Name this goal" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className={`${btn} ${BLUE}`} disabled={!title.trim()}>Add</button>
        </form>
      )}
      <button type="button" className={`${btn} ${ghost}`} onClick={onCancel}>Cancel</button>
    </section>
  )
}
