import { useState, useEffect } from 'react'
import { Scene, Kodama, SEASONS } from '../px.jsx'
import { input, btn, ghost } from '../ui.js'
import { nameOf, growthOf, stateOf, STAGES } from '../kodama.js'
import { cleanName } from '../persona.js'
import { totalXp, levelOf, questOf, badgesOf } from '../game.js'
import { doneStats } from '../tasks.js'
import { track } from '../analytics.js'

// The kodama's home: the window view with the kodama sitting in it. The speech line goes next to it (Today passes it in).
export function Home({ data, focusing, heavy, view }) {
  return (
    <div className="relative">
      <Scene {...view} />
      <div className="pointer-events-none absolute bottom-1 left-3 flex sm:left-6" style={{ '--px': 'var(--px-scene)' }}><Kodama mood={stateOf(data, { focusing, heavy })} /></div>
    </div>
  )
}

const MOODS = {
  idle: ['Resting', 'Nothing special going on. Ready when you are.'],
  focus: ['Focused', 'You are in a focus session, so it is keeping quiet.'],
  sleepy: ['Sleepy', 'It is late. It would like you to rest too.'],
  happy: ['Happy', 'A goal milestone was reached today.'],
  lucky: ['Lucky', 'You reached a milestone yesterday, so today feels lucky.'],
  cozy: ['Cozy', 'You wrapped up the day. It is settling in.'],
  calm: ['Calm', 'Today looks full. It is staying steady with you.'],
}
const Bar = ({ pct, label }) => <div className="mt-1 h-2 max-w-xs overflow-hidden bg-panel" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label={label}><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
const Section = ({ title, children }) => <section className="px-rule pb-3"><h3 className="mb-1 text-slate-700">{title}</h3>{children}</section>

// Everything the kodama keeps track of in one place: how it feels, its stage, your level, the daily quest, streak, badges and numbers, then its name and window view.
// Growth only ever goes up; the next unlock is shown as something to look forward to, never as a debt.
export function KodamaSettings({ data, setData, focusing }) {
  const g = growthOf(data), name = nameOf(data)
  const [draft, setDraft] = useState(name)
  const [open, setOpen] = useState(false)
  const save = () => { const n = cleanName(draft); setDraft(n); if (n !== name) track('kodama_named'); if (n !== name) setData((d) => ({ ...d, kodama: { ...d.kodama, name: n } })) }
  const tasks = data.tasks || [], real = tasks.filter((t) => !t.fun)
  const xp = totalXp(data), lv = levelOf(xp), quest = questOf(real), stats = doneStats(tasks), badges = badgesOf({ tasks, goals: data.goals || [], guide: data.guide })
  const mood = stateOf(data, { focusing: !!focusing }), [moodName, moodWhy] = MOODS[mood] || MOODS.idle
  const r = data.rhythm || {}, k = data.kodama || {}
  const timings = (r.outcomes || []).length + Object.values(r.archive || {}).reduce((n, a) => n + (a.n || 0), 0)
  const numbers = [
    ['Tasks finished', real.filter((t) => t.done).length], ['Times logged', timings], ['Morning plans', (k.rituals?.morning || []).length],
    ['Wrap-ups', (k.rituals?.evening || []).length], ['Energy checks', (data.energyLog || []).length], ['Hours with the timer', Math.round(tasks.reduce((n, t) => n + (t.spent || 0), 0) * 10) / 10],
  ]
  useEffect(() => { if (open && xp > (data.xp || 0)) setData((d) => ({ ...d, xp })) }, [open]) // the score is the highest reached: deleting a task never costs a level
  return (
    <>
      <button className={`${btn} ${ghost} ml-auto shrink-0`} aria-haspopup="dialog" onClick={() => setOpen(true)}>{name}, {g.stage.name.toLowerCase()}</button>
      {open && (
        <div className="px-backdrop fixed inset-0 z-40 flex items-end justify-center sm:items-center" onClick={() => setOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label={`${name}, your kodama`} className="px-panel max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto bg-yuki-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-base" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base">{name}, {g.stage.name.toLowerCase()}</h2>
              <button autoFocus className={btn} onClick={() => setOpen(false)}>Close</button>
            </div>

            <Section title="How it feels">
              <div className="flex items-center gap-3">
                <div className="flex shrink-0" style={{ '--px': 'var(--px-scene)' }}><Kodama mood={mood} /></div>
                <div><p className="text-2xl">{moodName}</p><p className="text-slate-700">{moodWhy}</p></div>
              </div>
            </Section>

            <Section title="Level">
              <p className="text-2xl">Level {lv.level} <span className="text-base text-slate-700">{xp} XP, {lv.to - xp} to level {lv.level + 1}</span></p>
              <Bar pct={lv.pct} label="Level progress" />
              <p className="mt-1 text-slate-700">XP comes from finished tasks (more for important, urgent and long ones), goal milestones and the goals guide. It never goes down.</p>
            </Section>

            <Section title="Rank">
              <p className="text-2xl">{g.stage.name} <span className="text-base text-slate-700">stage {g.index + 1} of {STAGES.length}, {g.points} growth</span></p>
              <ol className="mt-2 flex flex-wrap gap-2">
                {STAGES.map((st, i) => <li key={st.name} className={`px-sunk px-2 py-1 ${i <= g.index ? 'text-ink' : 'text-slate-600'}`} aria-current={i === g.index ? 'step' : undefined}>{i <= g.index ? '' : 'Locked '}{st.name} <span className="text-xs">{st.from}+</span></li>)}
              </ol>
              <Bar pct={g.pct} label="Growth" />
              <p className="mt-1 text-slate-700">{g.next ? `It grows when you log honest times, take energy checks and wrap up days. Next: ${g.next.name}, ${g.toNext} to go. ${g.next.unlock}` : 'Fully grown. It keeps you company.'}</p>
            </Section>

            <Section title="Daily quest">
              <p>Finish {quest.goal} tasks today: {quest.done} of {quest.goal}{quest.complete ? '. Done for today.' : ''}</p>
              <Bar pct={Math.round((quest.done / quest.goal) * 100)} label="Daily quest" />
              <p className="mt-2">{stats.streak > 0 ? `${stats.streak}-day streak. One rest day a week does not break it.` : 'No streak right now. Finish a task to start one.'}</p>
            </Section>

            <Section title={`Badges ${badges.filter((b) => b.got).length} of ${badges.length}`}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {badges.map((b) => (
                  <li key={b.id} className={`px-sunk px-2 py-1 ${b.got ? 'text-ink' : 'text-slate-600'}`}>
                    <p>{b.got ? 'Earned: ' : 'Locked: '}{b.name}</p><p className="text-xs">{b.how}</p>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Your numbers">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                {numbers.map(([l, v]) => <div key={l} className="flex justify-between gap-2"><dt className="text-slate-700">{l}</dt><dd className="tabular-nums">{v}</dd></div>)}
              </dl>
            </Section>

            <Section title="Name and window view">
              <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); save() }}>
                <label className="flex items-center gap-2">Its name<input className={`${input} w-40`} maxLength="20" value={draft} onChange={(e) => setDraft(e.target.value)} /></label>
                <button className={`${btn} ${ghost}`} disabled={cleanName(draft) === name}>Save name</button>
              </form>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {[['variant', 'Time of day', ['morning', 'dusk', 'night'], 1], ['season', 'Season', SEASONS, 2]].map(([key, label, opts, need]) => {
                  const unlocked = g.index >= need
                  return (
                    <label key={key} className="flex items-center gap-2">{label}
                      <select className={`${input} !min-h-0 w-auto capitalize`} disabled={!unlocked} value={unlocked ? data.scene?.[key] || '' : ''}
                        onChange={(e) => setData((d) => ({ ...d, scene: { ...d.scene, [key]: e.target.value || undefined } }))}>
                        <option value="">{unlocked ? 'Automatic' : `At ${STAGES[need].name}`}</option>
                        {unlocked && opts.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                  )
                })}
              </div>
            </Section>
          </section>
        </div>
      )}
    </>
  )
}
