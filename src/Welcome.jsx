// First sign-in: add the first task or deadline (the one action that makes Today useful), plus two optional taps so Desker knows what you want from it.
// Stored as data.onboarding; "Skip" stores that too, so it is asked once. onDone(onboarding, first) where first is { task } or { deadline } or undefined.
import { useState } from 'react'
import { btn, BLUE, ghost, input, panel } from './ui.js'
import { Avatar } from './px.jsx'
import Wallpaper from './Wallpaper.jsx'
import { WHO, WANTS } from './authForm.js'
import { parseQuick } from './lists.js'

const Chip = ({ on, onClick, children }) => <button type="button" aria-pressed={on} onClick={onClick} className={`${btn} ${on ? BLUE : ghost}`}>{children}</button>

export default function Welcome({ name, onDone }) {
  const [who, setWho] = useState('')
  const [wants, setWants] = useState([])
  const toggle = (w) => setWants((l) => (l.includes(w) ? l.filter((x) => x !== w) : [...l, w]))
  const first = String(name || '').trim().split(/\s+/)[0]
  const [kind, setKind] = useState('Task')
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  const isDl = kind === 'Deadline'
  const parsed = text.trim() ? parseQuick(text) : null // "Call dentist tomorrow 3pm" works here too
  const due = date || parsed?.due
  const go = () => onDone({ who, wants, at: Date.now() }, !parsed ? undefined : isDl ? { deadline: { id: Date.now(), title: parsed.title, date: due } } : { task: { ...parsed, ...(due && { due }) } })
  return (
    <div className="min-h-screen md:grid md:grid-cols-2">
      <aside className="relative h-36 md:sticky md:top-0 md:h-screen">
        <Wallpaper scene="dusk" label="A quiet night in the city" />
        <p className="px-panel absolute right-3 top-3 text-right hidden max-w-sm p-3 text-base md:block">Make yourself at home.</p>
      </aside>
      <main className="flex items-center justify-center p-5 md:p-10">
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center gap-3"><Avatar /><span className="text-2xl">Desker</span></div>
          <section className={`${panel} space-y-4`} aria-label="Welcome">
            <h1 className="text-2xl">{first ? `Welcome, ${first}!` : 'Welcome!'}</h1>
            <p>Desker helps you decide what to do next. Start with one thing you need to get done. You can add more later.</p>
            <div className="space-y-2">
              <div role="group" aria-label="Add a" className="px-seg">
                {['Task', 'Deadline'].map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}
              </div>
              <p className="text-base text-slate-700">{isDl ? 'A date you cannot miss, like an exam or an assignment. You can break it into tasks later.' : 'One thing to do. Add a date if it has to be done by then.'}</p>
              <input className={`${input} w-full`} aria-label={isDl ? 'First deadline' : 'First task'} value={text} onChange={(e) => setText(e.target.value)}
                placeholder={isDl ? 'e.g. Statics midterm Monday 3pm' : 'e.g. Call dentist tomorrow 3pm'} />
              {(isDl || parsed) && <label className="flex flex-col gap-1 text-base text-slate-600">{isDl ? 'Date (required)' : 'Due date (optional)'}
                <input type="date" className={`${input} w-full`} value={date || parsed?.due || ''} onChange={(e) => setDate(e.target.value)} />
              </label>}
            </div>
            <details>
              <summary className="underline">Tell Desker about you (optional)</summary>
              <div className="mt-3 space-y-4">
                <fieldset className="space-y-2">
                  <legend className="mb-1 text-base">Who is Desker for?</legend>
                  <div className="flex flex-wrap gap-2">{WHO.map((w) => <Chip key={w} on={who === w} onClick={() => setWho(who === w ? '' : w)}>{w}</Chip>)}</div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="mb-1 text-base">What do you want from it? Pick any.</legend>
                  <div className="flex flex-wrap gap-2">{WANTS.map((w) => <Chip key={w} on={wants.includes(w)} onClick={() => toggle(w)}>{w}</Chip>)}</div>
                </fieldset>
              </div>
            </details>
            <div className="flex flex-wrap gap-2">
              <button className={`${btn} ${BLUE}`} disabled={isDl && !!parsed && !due} onClick={go}>{parsed ? `Add ${isDl ? 'deadline' : 'task'}` : "Let's go"}</button>
              <button className={`${btn} ${ghost}`} onClick={() => onDone({ skipped: true, at: Date.now() })}>Skip for now</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
