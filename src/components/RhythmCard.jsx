import { profile, learnedThisWeek, accuracyByWeek } from '../rhythm.js'
import { btn, ghost, panel } from '../ui.js'
import BoxHead from './BoxHead.jsx'

// Today's small view of Your rhythm. On Sundays it becomes the weekly report.
export default function RhythmCard({ data, onOpen }) {
  const p = profile(data)
  const sunday = new Date().getDay() === 0
  const learned = sunday && !p.off ? learnedThisWeek(data) : []
  const last = accuracyByWeek(p.visible.outcomes).filter((w) => w.n).at(-1)
  const early = !p.off && p.dur.n < 3 // the sprout threshold: 3 valid timed tasks
  const need = 3 - p.dur.n
  const line = p.off ? 'Learning is switched off.'
    : p.dur.n < 3 ? 'Desker is still guessing how long things take you. Tick tasks off and say how long they took, or use the timer.'
    : last?.planErr != null ? `Plans were off by about ${last.planErr} min on average the last week you timed tasks. Your own estimates were off by about ${last.estErr} min.`
    : `Your work takes about ${p.dur.overall}x what you estimate.`
  return (
    <section className={`${panel} !p-3 lg:!p-4`} aria-label="Your rhythm">
      <BoxHead tab={sunday ? 'Your week' : 'Your rhythm'} tabClass="px-tab-matsu" line={early ? undefined : `${p.confidence.label}.`}>
        <button className={`${btn} ${ghost}`} onClick={onOpen}>{sunday ? 'Open report' : 'Open'}</button>
      </BoxHead>
      {early ? (
        <div className="mt-2">
          <p className="text-base">{need} more timed task{need === 1 ? '' : 's'} until Desker knows your pace</p>
          <div className="mt-1 h-2 border border-line bg-yuki-1" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={p.dur.n} aria-label="Timed tasks so far"><div className="h-full bg-kori-2" style={{ width: `${(p.dur.n / 3) * 100}%` }} /></div>
          <p className="mt-1 text-base text-slate-700">Time a task with the timer, or tell Desker how long it took.</p>
        </div>
      ) : <p className="mt-2 text-base text-slate-700">{line}</p>}
      {learned.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">{learned.slice(0, 3).map((l) => <li key={l}>{l}</li>)}</ul>}
    </section>
  )
}
