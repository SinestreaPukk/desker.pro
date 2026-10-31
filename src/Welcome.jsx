// First sign-in: two quick taps so Desker knows what you want from it. Stored as data.onboarding; "Skip" stores that too, so it is asked once.
import { useState } from 'react'
import { btn, BLUE, ghost, panel } from './ui.js'
import { Avatar } from './px.jsx'
import Wallpaper from './Wallpaper.jsx'
import { WHO, WANTS } from './authForm.js'

const Chip = ({ on, onClick, children }) => <button type="button" aria-pressed={on} onClick={onClick} className={`${btn} ${on ? BLUE : ghost}`}>{children}</button>

export default function Welcome({ name, onDone }) {
  const [who, setWho] = useState('')
  const [wants, setWants] = useState([])
  const toggle = (w) => setWants((l) => (l.includes(w) ? l.filter((x) => x !== w) : [...l, w]))
  const first = String(name || '').trim().split(/\s+/)[0]
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
            <p>Two quick taps and Desker fits you better. You can change your mind any time.</p>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-base">Who is Desker for?</legend>
              <div className="flex flex-wrap gap-2">{WHO.map((w) => <Chip key={w} on={who === w} onClick={() => setWho(who === w ? '' : w)}>{w}</Chip>)}</div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-base">What do you want from it? Pick any.</legend>
              <div className="flex flex-wrap gap-2">{WANTS.map((w) => <Chip key={w} on={wants.includes(w)} onClick={() => toggle(w)}>{w}</Chip>)}</div>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <button className={`${btn} ${BLUE}`} onClick={() => onDone({ who, wants, at: Date.now() })}>Let's go</button>
              <button className={`${btn} ${ghost}`} onClick={() => onDone({ skipped: true, at: Date.now() })}>Skip for now</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
