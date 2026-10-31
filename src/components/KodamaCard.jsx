import { Kodama } from '../px.jsx'
import { kodamaMood, msOf } from '../milestones.js'

// Today's kodama: happy after a milestone, a lucky day after that, otherwise unchanged.
export default function KodamaCard({ goals, className = '' }) {
  const { mood, happy, lucky } = kodamaMood(goals)
  const any = goals.some((g) => msOf(g).length)
  const [title, sub] = happy ? ['Milestone reached.', lucky ? 'Tomorrow is lucky again.' : 'Tomorrow is a lucky day.']
    : lucky ? ['A lucky day.', "Yesterday's milestone brought luck."]
    : any ? ['No milestone yet today.', 'Reach one and tomorrow is lucky.']
    : ['Add milestones to a goal.', 'The kodama cheers for each one.']
  return (
    <div className={`flex items-center gap-3 ${className}`} role="status">
      <Kodama mood={mood} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">{title}{happy && lucky && <span className="px-tab px-tab-matsu">Lucky day</span>}</p>
        <p className="text-base text-slate-700">{sub}</p>
      </div>
    </div>
  )
}
