import { useState } from 'react'
import { track } from '../analytics.js'
import { btn, ghost, input, BLUE, panel } from '../ui.js'
import { nameOf } from '../kodama.js'
import { addNote } from '../memory.js'
import BoxHead from './BoxHead.jsx'
import { fmtDate } from '../shared.jsx'

const RESULTS = [['well', 'Went well', 'Nice. Anything you want me to remember?'], ['okay', 'Okay', 'Okay is a fine result. Anything you want me to remember?'], ['rough', 'Rough', 'That sounds hard. Want to tell me a bit about it?']]

// "How did the static quiz go?" once, a day or more after a deadline. The answer is a note the student can read, edit and delete under "What the kodama remembers".
export default function FollowUp({ data, setData, deadline: d }) {
  const [res, setRes] = useState(null)
  const [text, setText] = useState('')
  const close = (note) => setData((x) => {
    const marked = { ...x, deadlines: x.deadlines.map((y) => (y.id === d.id ? { ...y, followed: true } : y)) }
    return note ? addNote(marked, note, 'followup') : marked
  })
  const save = (e) => {
    e.preventDefault(); track('followup_answered', { result: res[0] })
    close(`${d.title} (${fmtDate(d.date)}): ${res[1].toLowerCase()}.${text.trim() ? ` ${text.trim()}` : ''}`)
  }
  const line = res ? res[2] : `How did ${d.title} go?`
  return (
    <section className={`${panel} mb-6`} aria-label={`How did ${d.title} go?`}>
      <BoxHead tab={`Asking ${nameOf(data)}`} line={line}>
        {!res && RESULTS.map((r) => <button key={r[0]} className={`${btn} ${ghost}`} onClick={() => setRes(r)}>{r[1]}</button>)}
        <button className={btn} onClick={() => close()}>{res ? 'Skip' : 'Not now'}</button>
      </BoxHead>
      {res && (
        <form className="mt-3 flex gap-2" onSubmit={save}>
          <input autoFocus className={`${input} min-w-0 flex-1`} aria-label="Anything to add (optional)" maxLength="200" placeholder="Optional, a few words" value={text} onChange={(e) => setText(e.target.value)} />
          <button className={`${btn} ${BLUE}`}>Save</button>
        </form>
      )}
    </section>
  )
}
