import { totalXp, levelOf, questOf, badgesOf, SCENE_UNLOCK } from '../game.js'
import { SEASONS } from '../px.jsx'
import { input } from '../ui.js'
import { doneStats } from '../tasks.js'

// Today's game card: level and XP bar, the day's quest, the streak and the badges (earned ones lit).
export default function PlayerCard({ data, setData, className = '' }) {
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
      <div className="mt-3 flex flex-wrap items-center gap-3 text-base">
        {[['variant', 'Time of day', ['morning', 'dusk', 'night']], ['season', 'Season', SEASONS]].map(([key, label, opts]) => {
          const open = L.level >= SCENE_UNLOCK[key]
          return (
            <label key={key} className="flex items-center gap-2">{label}
              <select className={`${input} !min-h-0 w-auto capitalize`} disabled={!open} value={open ? data.scene?.[key] || '' : ''}
                onChange={(e) => setData((d) => ({ ...d, scene: { ...d.scene, [key]: e.target.value || undefined } }))}>
                <option value="">{open ? 'Automatic' : `Level ${SCENE_UNLOCK[key]}`}</option>
                {open && opts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          )
        })}
      </div>
    </section>
  )
}
