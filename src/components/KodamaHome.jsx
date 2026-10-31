import { useState, useEffect } from 'react'
import { Scene, Kodama, SEASONS } from '../px.jsx'
import { input, btn, ghost } from '../ui.js'
import { nameOf, growthOf, stateOf, STAGES } from '../kodama.js'
import { cleanName } from '../persona.js'
import { totalXp, levelOf, questOf, badgesOf } from '../game.js'
import { doneStats } from '../tasks.js'
import { dayStr } from '../milestones.js'
import { Icon } from '../icons.jsx'
import { track } from '../analytics.js'

// The kodama's home: the window view with the kodama sitting in it. The speech line goes next to it (Today passes it in).
// `children` is the kodama's speech bubble: it sits inside the scene, to the right of the sprite.
export function Home({ data, focusing, heavy, view, children }) {
  return (
    <div className="relative">
      <Scene {...view} />
      <div className="pointer-events-none absolute bottom-1 left-3 flex sm:left-6" style={{ '--px': 'var(--px-scene)' }}><Kodama mood={stateOf(data, { focusing, heavy })} /></div>
      {children && <div className="absolute inset-y-1 left-28 right-2 flex items-start sm:left-56 sm:right-4 sm:inset-y-4">{children}</div>}
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
const Bar = ({ pct, label }) => <div className="mt-2 h-3 max-w-sm overflow-hidden border-2 border-line bg-panel" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label={label}><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
const Pic = ({ n, size = 12, alt = '' }) => <img src={`/pixel/${n}.png`} alt={alt} aria-hidden={alt ? undefined : 'true'} width={size * 4} height={size * 4} className={`px-art block shrink-0 ${size === 12 ? 'h-12 w-12' : size === 8 ? 'h-8 w-8' : 'h-16 w-16'}`} /> // always the light-theme sprites: the medals carry their own rim so they read on dark too
const Card = ({ title, aside, children }) => (
  <section className="px-sunk p-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-slate-700">{title}</h3>{aside && <span className="text-slate-700">{aside}</span>}</div>
    {children}
  </section>
)
// How far you are towards each badge: [now, goal]. The badge itself (earned or not) comes from badgesOf.
const progressOf = (id, s) => ({ first: [s.done, 1], ten: [s.done, 10], fifty: [s.done, 50], streak3: [s.streak, 3], streak7: [s.streak, 7], milestone: [s.milestones, 1], guide: [s.guide ? 1 : 0, 1], focus: [Math.round(s.hours * 10) / 10, 5] })[id]
const TABS = ['Progress', 'Badges', 'Numbers', 'Settings']

// Everything the kodama keeps track of in one place: how it feels, its stage, your level, the daily quest, streak, badges and numbers, then its name and window view.
// Growth only ever goes up; the next unlock is shown as something to look forward to, never as a debt.
export function KodamaSettings({ data, setData, focusing }) {
  const g = growthOf(data), name = nameOf(data)
  const [draft, setDraft] = useState(name)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('Progress')
  const save = () => { const n = cleanName(draft); setDraft(n); if (n !== name) track('kodama_named'); if (n !== name) setData((d) => ({ ...d, kodama: { ...d.kodama, name: n } })) }
  const tasks = data.tasks || [], real = tasks.filter((t) => !t.fun)
  const xp = totalXp(data), lv = levelOf(xp), quest = questOf(real), stats = doneStats(tasks), badges = badgesOf({ tasks, goals: data.goals || [], guide: data.guide })
  const mood = stateOf(data, { focusing: !!focusing }), [moodName, moodWhy] = MOODS[mood] || MOODS.idle
  const r = data.rhythm || {}, k = data.kodama || {}
  const timings = (r.outcomes || []).length + Object.values(r.archive || {}).reduce((n, a) => n + (a.n || 0), 0)
  const hours = tasks.reduce((n, t) => n + (t.spent || 0), 0)
  const prog = { done: real.filter((t) => t.done).length, streak: stats.streak, milestones: (data.goals || []).reduce((n, x) => n + (x.milestones || []).filter((m) => m.at).length, 0), guide: !!data.guide?.done, hours }
  const earned = badges.filter((b) => b.got).length
  const nextBadge = badges.filter((b) => !b.got).map((b) => { const [now, goal] = progressOf(b.id, prog); return { ...b, now, goal } }).sort((a, b) => b.now / b.goal - a.now / a.goal)[0]
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const day = dayStr(d); return { day, letter: d.toLocaleDateString('en-US', { weekday: 'narrow' }), lit: real.some((t) => t.done && t.doneAt && dayStr(new Date(t.doneAt)) === day), today: i === 6 } })
  const numbers = [
    ['Tasks finished', prog.done, <Pic key="a" n="g-quest-on" size={8} />], ['Times logged', timings, <Icon key="b" name="Clock" />], ['Morning plans', (k.rituals?.morning || []).length, <Icon key="c" name="Today" />],
    ['Wrap-ups', (k.rituals?.evening || []).length, <Pic key="d" n="g-moon" size={8} />], ['Energy checks', (data.energyLog || []).length, <Pic key="e" n="g-bolt" size={8} />], ['Hours with the timer', Math.round(hours * 10) / 10, <Pic key="f" n="g-hourglass" size={8} />],
  ]
  useEffect(() => { if (open && xp > (data.xp || 0)) setData((d) => ({ ...d, xp })) }, [open]) // the score is the highest reached: deleting a task never costs a level
  return (
    <>
      <button className={`${btn} ${ghost} ml-auto shrink-0 max-sm:!min-h-9 max-sm:!px-2 max-sm:text-xs`} aria-haspopup="dialog" onClick={() => { setTab('Progress'); setOpen(true) }}>{name}, {g.stage.name.toLowerCase()}</button>
      {open && (
        <div className="px-backdrop fixed inset-0 z-40 flex items-end justify-center sm:items-center" onClick={() => setOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label={`${name}, your kodama`} className="px-panel max-h-[94vh] w-full max-w-xl overflow-y-auto bg-yuki-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-base sm:p-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="px-strip px-strip-fit" aria-hidden="true"><img src="/pixel/strip-kodama.png" alt="" width="192" height="24" className="px-art" /></div>
              <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2"><Kodama mood={mood} /></div>
            </div>

            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-4xl leading-8">{name}</h2>
                <p className="mt-1 text-slate-700">{g.stage.name}. <b className="font-normal text-ink">{moodName}.</b> {moodWhy}</p>
              </div>
              <button autoFocus className={`${btn} shrink-0`} onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-2">
                <span className="px-tab px-tab-ando text-2xl" aria-label={`Level ${lv.level}`}>Level {lv.level}</span>
                <span className="px-tab px-tab-matsu flex items-center gap-1 text-2xl"><Pic n="g-flame" size={8} />{stats.streak}<span className="sr-only"> day streak</span></span>
                <span className="px-tab px-tab-matsu flex items-center gap-1 text-2xl"><Pic n="b-first" size={8} />{earned}/{badges.length}<span className="sr-only"> badges</span></span>
              </div>
            </div>

            <div className="px-seg mt-3 flex-wrap" role="group" aria-label="Kodama sections">
              {TABS.map((t) => <button key={t} aria-pressed={tab === t} className="px-btn" onClick={() => setTab(t)}>{t}</button>)}
            </div>

            <div className="mt-3 space-y-3">
              {tab === 'Progress' && (
                <>
                  <Card title="Level" aside={`${xp} XP`}>
                    <p className="text-2xl">Level {lv.level} <span className="text-base text-slate-700">{lv.to - xp} XP to level {lv.level + 1}</span></p>
                    <Bar pct={lv.pct} label="Level progress" />
                    <p className="mt-2 text-slate-700">XP comes from finished tasks (more for important, urgent and long ones), goal milestones and the goals guide. It never goes down.</p>
                  </Card>

                  <Card title="Rank: growth stage" aside={`${g.points} growth`}>
                    <ol className="mt-2 grid grid-cols-5 gap-1 text-center">
                      {STAGES.map((st, i) => (
                        <li key={st.name} className={`flex min-w-0 flex-col items-center px-1 pb-1 ${i === g.index ? 'bg-pale' : ''}`} aria-current={i === g.index ? 'step' : undefined}>
                          <span className={`text-xs ${i === g.index ? 'px-tab px-tab-ando' : 'text-slate-700'}`}>{i === g.index ? 'You' : i < g.index ? 'Reached' : `${st.from}+`}</span>
                          <Pic n={`s-${i}`} alt="" /><span className={`break-words text-xs ${i <= g.index ? 'text-ink' : 'text-slate-600'}`}>{st.name}</span>
                        </li>
                      ))}
                    </ol>
                    <Bar pct={g.pct} label="Growth" />
                    <p className="mt-2 text-slate-700">{g.next ? `It grows when you log honest times, take energy checks and wrap up days. ${g.toNext} to go until ${g.next.name}. ${g.next.unlock}` : 'Fully grown. It keeps you company.'}</p>
                  </Card>

                  <Card title="Daily quest" aside={quest.complete ? 'Done for today' : `${quest.done} of ${quest.goal}`}>
                    <div className="mt-2 flex items-center gap-2">
                      {Array.from({ length: quest.goal }, (_, i) => <Pic key={i} n={i < quest.done ? 'g-quest-on' : 'g-quest-off'} size={8} />)}
                      <p className="ml-2 min-w-0 flex-1">Finish {quest.goal} tasks today.</p>
                    </div>
                  </Card>

                  <Card title="This week" aside={stats.streak > 0 ? `${stats.streak}-day streak` : 'No streak yet'}>
                    <ol className="mt-2 grid grid-cols-7 gap-1 text-center">
                      {week.map((d) => (
                        <li key={d.day} className={`flex flex-col items-center ${d.today ? 'bg-pale' : ''}`}>
                          <Pic n={d.lit ? 'g-flame' : 'g-ember'} size={8} alt={`${d.day}${d.lit ? ', task finished' : ''}`} /><span className="text-xs text-slate-700">{d.letter}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-2 text-slate-700">A flame for every day you finished a task. One rest day a week does not break a streak.</p>
                  </Card>
                </>
              )}

              {tab === 'Badges' && (
                <Card title="Badges" aside={`${earned} of ${badges.length} earned`}>
                  <Bar pct={Math.round((earned / badges.length) * 100)} label="Badges earned" />
                  {nextBadge && <p className="mt-2">Closest: <b className="font-normal text-ink">{nextBadge.name}</b>, {Math.min(nextBadge.now, nextBadge.goal)} of {nextBadge.goal}. {nextBadge.how}.</p>}
                  <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {badges.map((b) => {
                      const [now, goal] = progressOf(b.id, prog)
                      return (
                        <li key={b.id} className={`flex flex-col items-center px-1 pb-2 pt-2 text-center ${b.got ? 'bg-ando-0 text-ink' : ''}`}>
                          <Pic n={b.got ? `b-${b.id}` : 'b-locked'} size={16} />
                          <p className={`mt-1 break-words ${b.got ? 'text-ink' : 'text-slate-700'}`}>{b.name}</p>
                          <p className={`text-xs ${b.got ? 'text-ink' : 'text-slate-700'}`}>{b.got ? 'Earned' : b.how}</p>
                          {!b.got && <p className="text-xs text-slate-700">{Math.min(now, goal)} / {goal}</p>}
                        </li>
                      )
                    })}
                  </ul>
                </Card>
              )}

              {tab === 'Numbers' && (
                <Card title="Your numbers">
                  <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {numbers.map(([l, v, pic]) => (
                      <li key={l} className="flex flex-col items-center px-1 text-center">{pic}<span className="text-2xl tabular-nums">{v}</span><span className="text-xs text-slate-700">{l}</span></li>
                    ))}
                  </ul>
                </Card>
              )}

              {tab === 'Settings' && (
                <Card title="Name and window view">
                  <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); save() }}>
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
                </Card>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
