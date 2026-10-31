import { profile, learnedThisWeek, accuracyByWeek } from '../rhythm.js'
import { btn, ghost, panel } from '../ui.js'
import BoxHead from './BoxHead.jsx'

// Today's small view of Your rhythm. On Sundays it becomes the weekly report.
export default function RhythmCard({ data, onOpen }) {
  const p = profile(data)
  const sunday = new Date().getDay() === 0
  const learned = sunday && !p.off ? learnedThisWeek(data) : []
  const last = accuracyByWeek(p.visible.outcomes).at(-1)
  const line = p.off ? 'Learning is switched off.'
    : p.dur.n < 3 ? 'Desker is still guessing how long things take you. Tick tasks off and say how long they took, or use the timer.'
    : last?.planErr != null ? `Plans were off by ${last.planErr}% on average the last week you timed tasks. Your own estimates were off by ${last.estErr}%.`
    : `Your work takes about ${p.dur.overall}x what you estimate.`
  return (
    <section className={`${panel} !p-3 lg:!p-4`} aria-label="Your rhythm">
      <BoxHead tab={sunday ? 'Your week' : 'Your rhythm'} tabClass="px-tab-matsu" line={`${p.confidence.label}.`}>
        <button className={`${btn} ${ghost}`} onClick={onOpen}>{sunday ? 'Open report' : 'Open'}</button>
      </BoxHead>
      <p className="mt-2 text-base text-slate-700">{line}</p>
      {learned.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">{learned.slice(0, 3).map((l) => <li key={l}>{l}</li>)}</ul>}
    </section>
  )
}
