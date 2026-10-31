import { btn, BLUE, ghost, panel } from './ui.js'
import { Avatar, Kodama, Scene } from './px.jsx'
import { PRIVACY_CONTACT_EMAIL } from './config.js'

// The public page at "/" for signed-out visitors. The same words sit, visually hidden, in index.html so crawlers that do not run scripts still read them: keep both in step.
// The three pictures are drawn examples (marked as such), not real accounts.

const cell = ['bg-yuki-1', 'bg-kori-1', 'bg-kori-2', 'bg-yoru-1']
const HEAT = [ // weekday x hour, 0 to 3: an invented student who focuses best in the morning and after dinner
  [0, 1, 3, 3, 2, 0, 1, 1, 2, 2, 0], [0, 1, 3, 3, 2, 0, 1, 2, 2, 1, 0], [0, 2, 3, 2, 1, 0, 1, 1, 1, 1, 0], [0, 1, 2, 3, 2, 1, 1, 2, 3, 2, 0],
  [0, 1, 2, 2, 1, 0, 0, 1, 1, 0, 0], [0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0], [0, 0, 0, 1, 1, 1, 2, 2, 1, 0, 0],
]

const Example = () => <span className="absolute right-3 top-3 text-xs text-slate-700">Example</span>

const Feature = ({ title, text, children }) => (
  <article className={`${panel} relative flex flex-col gap-3`}>
    <Example />
    <div aria-hidden="true" className="px-sunk p-3">{children}</div>
    <h3 className="text-2xl">{title}</h3>
    <p className="text-slate-700">{text}</p>
  </article>
)

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-4">
        <a href="/" className="flex items-center gap-3" aria-label="Desker home"><Avatar /><span className="text-2xl">Desker</span></a>
        <a className={`${btn} ${ghost} inline-flex items-center`} href="/login">Sign in</a>
      </header>

      <main className="mx-auto max-w-[1100px] px-5 pb-16">
        <section className="space-y-8 py-6 lg:py-12" aria-label="Desker">
          <div>
            <h1 className="text-4xl md:text-5xl">The study planner that learns how you study.</h1>
            <p className="mt-4 max-w-xl text-slate-700">Desker learns how long things really take you and when you focus best, with a kodama that plans each day around you. Built for university students with deadlines.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className={`${btn} ${BLUE} inline-flex items-center`} href="/signup">Meet your kodama, it is free</a>
              <a className={`${btn} ${ghost} inline-flex items-center`} href="/login">Sign in</a>
            </div>
            <p className="mt-3 text-base text-slate-700">Email and password, or Google. Your first plan takes about a minute.</p>
          </div>
          <div className="relative w-full max-w-[768px]">
            <Scene season="winter" variant="dusk" />
            <div className="px-panel mt-3 flex items-center gap-3 bg-yuki-0 p-2 sm:absolute sm:bottom-3 sm:left-3 sm:mt-0 sm:max-w-[16rem]"><Kodama /><p className="text-base">Hi. Tell me what is due and I will find the time.</p></div>
          </div>
        </section>

        <section className="py-8" aria-label="What Desker does">
          <h2 className="mb-6 text-2xl">What makes it different</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            <Feature title="It learns you" text="Every task you time teaches Desker how long your work really takes, and when you focus best. Your plans get more accurate each week, and you can watch it happen.">
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(11, minmax(0, 1fr))' }}>
                {HEAT.flat().map((v, i) => <span key={i} className={`h-4 ${cell[v]}`} />)}
              </div>
              <p className="mt-3 text-base">Your plans were 38% off in week 1. 12% off now.</p>
            </Feature>
            <Feature title="It plans around your energy" text="Tell it how much time and energy you have right now and it picks one task, in the hours you do your best work.">
              <p className="px-tab px-tab-ando inline-block">Right now</p>
              <p className="mt-2 text-slate-700">Do this next</p>
              <p className="text-2xl">Read chapter 4 for Cell Biology</p>
              <p className="text-base text-slate-700">45 min. Mornings are your sharpest time.</p>
            </Feature>
            <Feature title="A companion, not a to-do list" text="Your kodama gives you a short plan in the morning and asks two quick things in the evening. It remembers, and it never nags.">
              <div className="flex items-start gap-3"><Kodama /><p className="text-base">Good morning. Problem set at 9, reading at 14:00. Sound good?</p></div>
            </Feature>
          </div>
        </section>

        <section className="py-4" aria-label="Also included">
          <ul className="grid gap-4 text-slate-700 md:grid-cols-3">
            <li className="px-rule pb-3"><b>Import your syllabus.</b> Paste a link or a file and the deadlines appear.</li>
            <li className="px-rule pb-3"><b>Plan around your calendar.</b> Classes and meetings are never double-booked.</li>
            <li className="px-rule pb-3"><b>Deadlines become tasks.</b> Exams and assignments break into steps that fit your week.</li>
          </ul>
        </section>

        <section className={`${panel} mt-8 flex flex-wrap items-center justify-between gap-4`} aria-label="Get started">
          <p className="text-2xl">Ready to see what is due this week?</p>
          <a className={`${btn} ${BLUE} inline-flex items-center`} href="/signup">Meet your kodama, it is free</a>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-6">
        <nav aria-label="Footer" className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-6 gap-y-2 text-base">
          <span>Desker</span>
          <a className="underline" href="/privacy">Privacy</a>
          <a className="underline" href="/terms">Terms</a>
          <a className="underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>Contact</a>
        </nav>
      </footer>
    </div>
  )
}
