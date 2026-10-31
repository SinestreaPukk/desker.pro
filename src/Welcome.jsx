// First sign-in, one short screen: two taps that give Desker a starting guess about you, then your first task or deadline.
// Stored as data.onboarding ({ sharpest, slow, at }); "Skip" stores { skipped } so it is asked once. onDone(onboarding, first) with first = { task } | { deadline } | undefined.
import { useState, useEffect } from 'react'
import { track } from './analytics.js'
import { btn, BLUE, ghost, input, panel } from './ui.js'
import { Avatar } from './px.jsx'
import Wallpaper from './Wallpaper.jsx'
import DateField from './components/DateField.jsx'
import { parseQuick } from './lists.js'
import { cleanName, PERSONA } from './persona.js'

export const SHARPEST = ['Morning', 'Afternoon', 'Evening', 'Late night']
export const SLOW = ['Rarely', 'Sometimes', 'Almost always']

const Chip = ({ on, onClick, children }) => <button type="button" aria-pressed={on} onClick={onClick} className={`${btn} ${on ? BLUE : ghost}`}>{children}</button>

export default function Welcome({ name, onDone }) {
  useEffect(() => { track('signed_up') }, []) // the first screen a new account sees; a reload before finishing repeats it, so count distinct users
  const [sharpest, setSharpest] = useState('')
  const [slow, setSlow] = useState('')
  const [kname, setKname] = useState('')
  const [kind, setKind] = useState('Task')
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  const first = String(name || '').trim().split(/\s+/)[0]
  const isDl = kind === 'Deadline'
  const parsed = text.trim() ? parseQuick(text) : null // "Statics quiz Monday 3pm" works here as in the Tasks add box
  const due = date || parsed?.due
  const go = () => onDone({ sharpest, slow, at: Date.now(), ...(kname.trim() && { kodama: cleanName(kname) }) }, !parsed ? undefined : isDl ? { deadline: { id: Date.now(), title: parsed.title, date: due, ...(parsed.start && { time: parsed.start }) } } : { task: { ...parsed, ...(due && { due }) } })
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
            <p>Desker is the study planner for university students. It learns how long your work really takes and when you focus best, then plans around you. It starts with a guess, so two quick taps help.</p>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-base">When do you usually feel sharpest?</legend>
              <div className="flex flex-wrap gap-2">{SHARPEST.map((w) => <Chip key={w} on={sharpest === w} onClick={() => setSharpest(sharpest === w ? '' : w)}>{w}</Chip>)}</div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-base">Do your tasks usually take longer than you expect?</legend>
              <div className="flex flex-wrap gap-2">{SLOW.map((w) => <Chip key={w} on={slow === w} onClick={() => setSlow(slow === w ? '' : w)}>{w}</Chip>)}</div>
            </fieldset>
            <label className="flex flex-col gap-1 text-base">Your study companion is a small kodama. Name it, or keep the default.
              <input className={`${input} w-full`} maxLength="20" placeholder={PERSONA.defaultName} value={kname} onChange={(e) => setKname(e.target.value)} />
            </label>
            <div className="space-y-2">
              <p className="text-base">What is coming up?</p>
              <div role="group" aria-label="Add a" className="px-seg">
                {['Task', 'Deadline'].map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}
              </div>
              <p className="text-base text-slate-700">{isDl ? 'An exam, quiz or assignment date. You can break it into tasks next.' : 'One thing to do. Add a date if it has to be done by then.'}</p>
              <input className={`${input} w-full`} aria-label={isDl ? 'First deadline' : 'First task'} value={text} onChange={(e) => setText(e.target.value)}
                placeholder={isDl ? 'e.g. Statics midterm Monday 3pm' : 'e.g. Read chapter 4 tomorrow'} />
              {(isDl || parsed) && <label className="flex flex-col gap-1 text-base text-slate-600">{isDl ? 'Date (required)' : 'Due date (optional)'}
                <DateField className={`${input} w-full`} value={date || parsed?.due || ''} onChange={(e) => setDate(e.target.value)} />
              </label>}
              <p className="text-base text-slate-700">Have a syllabus? You can import it on the Tasks page after this.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={`${btn} ${BLUE}`} disabled={isDl && !!parsed && !due} onClick={go}>{parsed ? `Add ${isDl ? 'deadline' : 'task'} and plan my week` : "Let's go"}</button>
              <button className={`${btn} ${ghost}`} onClick={() => onDone({ skipped: true, at: Date.now() })}>Skip for now</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
