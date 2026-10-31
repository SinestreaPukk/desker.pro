import { panel } from './ui.js'
import { Avatar } from './px.jsx'

// TODO(owner): placeholder text. Replace with your real policy before the beta opens; the headings are a starting point only.
const PAGES = {
  privacy: ['Privacy', [
    ['What Desker stores', 'TODO: list what is kept for each account: tasks, deadlines, goals, the calendar link you paste, how long tasks take you, focus sessions and energy taps.'],
    ['Product analytics', 'TODO: say that Desker counts anonymous product events (sign-ups, tasks completed, features used) to learn whether students come back. Events never contain task titles or other content.'],
    ['AI', 'TODO: explain which text is sent to the AI service (your tasks, goals and notes you share with the kodama) and that it is not used for anything else.'],
    ['Your choices', 'TODO: export (Settings, Export JSON), deletion (Settings, Danger zone) and turning prompts off.'],
  ]],
  terms: ['Terms', [
    ['Using Desker', 'TODO: who may use it, acceptable use, and that Desker is a planning aid, not advice.'],
    ['Your content', 'TODO: you own your tasks and notes; what Desker may do with them to run the service.'],
    ['Changes and contact', 'TODO: how changes are announced and how to reach you.'],
  ]],
}

export default function Legal({ kind }) {
  const [title, sections] = PAGES[kind]
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <a href="/" className="mb-6 flex items-center gap-3" aria-label="Desker home"><Avatar /><span className="text-2xl">Desker</span></a>
      <h1 className="mb-4 text-4xl">{title}</h1>
      <p role="note" className={`${panel} mb-6`}>This page is a placeholder and has not been written yet.</p>
      {sections.map(([h, t]) => <section key={h} className="mb-5"><h2 className="mb-1">{h}</h2><p className="text-slate-700">{t}</p></section>)}
    </div>
  )
}
