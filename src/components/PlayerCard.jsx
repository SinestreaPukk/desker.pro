import { totalXp, levelOf, questOf, badgesOf } from '../game.js'
import { doneStats } from '../tasks.js'

// Today's game card: level and XP bar, the day's quest, the streak and the badges (earned ones lit).
export default function PlayerCard({ data, className = '' }) {
  const { tasks = [] } = data
  const L = levelOf(totalXp(data)), q = questOf(tasks), { streak } = doneStats(tasks), badges = badgesOf(data)
  return (
    <section className={`${className}`} aria-label="Your progress">
      <h2 className="px-tab px-tab-kori mb-3 inline-block">Level {L.level}</h2>
      <p className="flex flex-wrap items-center gap-2"><span className="text-base text-slate-700">{L.xp} XP, {L.to - L.xp} to level {L.level + 1}</span></p>
      <div className="mt-2 h-2 max-w-xs overflow-hidden bg-panel" role="progressbar" aria-valuenow={L.pct} aria-valuemin="0" aria-valuemax="100" aria-label={`Level ${L.level} progress`}>
        <div className="h-full bg-primary" style={{ width: `${L.pct}%` }} />
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-base text-slate-700">
        Daily quest: finish {q.goal} tasks <span className="flex gap-1" aria-hidden="true">{Array.from({ length: q.goal }, (_, i) => <span key={i} className={`px-pip ${i < q.done ? 'px-pip-on' : ''}`} />)}</span>
        {q.complete ? 'Quest complete!' : `${q.done} of ${q.goal}`}{streak > 1 && <span className="px-tab px-tab-beni">{streak}-day streak</span>}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1" aria-label="Badges">
        {badges.map((b) => <li key={b.id} title={b.how} className={`px-tab ${b.got ? 'px-tab-matsu' : 'px-tab-yuki opacity-60'}`}>{b.got ? b.name : `? ${b.how}`}</li>)}
      </ul>
    </section>
  )
}
