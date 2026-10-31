import { learned, recap } from '../insights.js'
import { btn, ghost, panel } from '../ui.js'

// "Desker learns you" plus the week in review. The more you use Desker, the more it can say.
export default function Insights({ data, onReplan }) {
  const lines = learned(data), r = recap(data)
  const trend = r.done === r.last ? 'the same as last week' : r.done > r.last ? `${r.done - r.last} more than last week` : `${r.last - r.done} fewer than last week`
  return (
    <section className={`${panel} !p-3 lg:!p-4`} aria-label="What Desker has learned">
      <h2 className="px-tab px-tab-matsu mb-3 inline-block">Insights</h2>
      <p>{r.done ? `${r.done} task${r.done === 1 ? '' : 's'} done, ${trend}.` : 'No tasks done yet this week.'} {r.xp > 0 && `${r.xp} XP earned.`}</p>
      <p className="text-base text-slate-700">{[r.best && `Busiest day: ${r.best}.`, r.hours > 0 && `${r.hours} h focused.`, r.milestones > 0 && `${r.milestones} milestone${r.milestones === 1 ? '' : 's'} reached.`].filter(Boolean).join(' ')}</p>
      <h3 className="mt-3 font-semibold">What Desker has learned about you</h3>
      {lines.length
        ? <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
        : <p className="mt-1 text-base text-slate-700">Finish a few tasks, time them, and tap your energy now and then. Desker works out when you do your best work and how long things really take you.</p>}
      <button className={`${btn} ${ghost} mt-3`} onClick={onReplan}>Plan next week</button>
    </section>
  )
}
