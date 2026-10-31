import { useState, useEffect } from 'react'
import { Scene, Kodama, SEASONS } from '../px.jsx'
import { input, btn, ghost } from '../ui.js'
import { nameOf, growthOf, stateOf, STAGES } from '../kodama.js'
import { cleanName } from '../persona.js'
import { badgesOf, nextBadge, habitStreak, habitDays } from '../game.js'
import { notesOf, addNote, editNote, removeNote, clearNotes, MAX_LEN } from '../memory.js'
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
const Bar = ({ pct, label }) => <div className="mt-2 h-3 max-w-sm overflow-hidden border-2 border-line bg-panel" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label={label}><div className="h-full bg-primary" style={{ width: `${Math.max(2, pct)}%` }} /></div>
const Pic = ({ n, size = 12, alt = '' }) => <img src={`/pixel/${n}.png`} alt={alt} aria-hidden={alt ? undefined : 'true'} width={size * 4} height={size * 4} className={`px-art block shrink-0 ${size === 12 ? 'h-12 w-12' : size === 8 ? 'h-8 w-8' : 'h-16 w-16'}`} />
const Card = ({ title, aside, children }) => (
  <section className="px-sunk p-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-slate-700">{title}</h3>{aside && <span className="text-slate-700">{aside}</span>}</div>
    {children}
  </section>
)
const TABS = ['Growth', 'Badges', 'Numbers', 'Memory', 'Settings']

// What the kodama has noted down about you. Everything here is something you said or did, and you can change or remove any of it.
function Memory({ data, setData, name }) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(null) // { id, text }
  const [sure, setSure] = useState(false)
  const notes = notesOf(data)
  const set = (fn) => setData((d) => fn(d))
  return (
    <Card title={`What ${name} remembers`} aside={`${notes.length} note${notes.length === 1 ? '' : 's'}`}>
      <p className="mt-1 text-slate-700">Short notes from things you said or did, like how an exam went. {name} reads them to talk with you, and they are sent along with your questions to the AI. You can change or delete any of them.</p>
      <ul className="mt-3 space-y-2">
        {notes.slice().reverse().map((n) => (
          <li key={n.id} className="flex flex-wrap items-start gap-2 border-t border-line pt-2">
            {editing?.id === n.id ? (
              <form className="flex min-w-0 flex-1 flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); set((d) => editNote(d, n.id, editing.text)); setEditing(null) }}>
                <input autoFocus className={`${input} min-w-0 flex-1`} aria-label="Note" maxLength={MAX_LEN} value={editing.text} onChange={(e) => setEditing({ id: n.id, text: e.target.value })} />
                <button className={`${btn} ${ghost}`}>Save</button><button type="button" className={btn} onClick={() => setEditing(null)}>Cancel</button>
              </form>
            ) : (
              <>
                <p className="min-w-0 flex-1 break-words"><span className="text-xs text-slate-700">{new Date(n.at).toLocaleDateString('sv')} </span>{n.text}</p>
                <button className={`${btn} ${ghost}`} aria-label={`Edit note: ${n.text}`} onClick={() => setEditing({ id: n.id, text: n.text })}>Edit</button>
                <button className={btn} aria-label={`Delete note: ${n.text}`} onClick={() => set((d) => removeNote(d, n.id))}>Delete</button>
              </>
            )}
          </li>
        ))}
        {!notes.length && <li className="text-slate-700">{name} has not noted anything yet.</li>}
      </ul>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { set((d) => addNote(d, text, 'said')); setText('') } }}>
        <input className={`${input} min-w-0 flex-1`} aria-label={`Tell ${name} something to remember`} placeholder={`Tell ${name} something to remember`} maxLength={MAX_LEN} value={text} onChange={(e) => setText(e.target.value)} />
        <button className={`${btn} ${ghost}`}>Add</button>
      </form>
      {notes.length > 0 && (sure
        ? <p role="alert" className="mt-3">Forget all {notes.length} notes? <button className={`${btn} ${ghost}`} onClick={() => { set(clearNotes); setSure(false) }}>Forget them</button> <button className={btn} onClick={() => setSure(false)}>Keep them</button></p>
        : <button className={`${btn} mt-3`} onClick={() => setSure(true)}>Forget everything</button>)}
    </Card>
  )
}

// Everything the kodama keeps track of in one place: its stage and what grows it, the next badge, your numbers, what it remembers, its name and window view.
// Growth is the only progression: there are no levels, points to lose, daily quests or task-count streaks.
export function KodamaSettings({ data, setData, focusing }) {
  const g = growthOf(data), name = nameOf(data)
  const [draft, setDraft] = useState(name)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('Growth')
  const save = () => { const n = cleanName(draft); setDraft(n); if (n !== name) track('kodama_named'); if (n !== name) setData((d) => ({ ...d, kodama: { ...d.kodama, name: n, nameAsked: true } })) }
  const tasks = data.tasks || []
  const badges = badgesOf(data), got = badges.filter((b) => b.got), next = nextBadge(badges)
  const mood = stateOf(data, { focusing: !!focusing }), [moodName, moodWhy] = MOODS[mood] || MOODS.idle
  const r = data.rhythm || {}, k = data.kodama || {}
  const timings = (r.outcomes || []).length + Object.values(r.archive || {}).reduce((n, a) => n + (a.n || 0), 0)
  const hours = tasks.reduce((n, t) => n + (t.spent || 0), 0)
  const streakOn = !!k.streak, streak = streakOn ? habitStreak(data) : 0
  const lit = habitDays(data)
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const day = dayStr(d); return { day, letter: d.toLocaleDateString('en-US', { weekday: 'narrow' }), lit: lit.has(day), today: i === 6 } })
  const numbers = [
    ['Tasks finished', tasks.filter((t) => t.done && !t.fun).length, <Pic key="a" n="g-quest-on" size={8} />], ['Times logged', timings, <Icon key="b" name="Clock" />], ['Morning plans', (k.rituals?.morning || []).length, <Icon key="c" name="Today" />],
    ['Wrap-ups', (k.rituals?.evening || []).length, <Pic key="d" n="g-moon" size={8} />], ['Energy checks', (data.energyLog || []).length, <Pic key="e" n="g-bolt" size={8} />], ['Hours with the timer', Math.round(hours * 10) / 10, <Pic key="f" n="g-hourglass" size={8} />],
  ]
  return (
    <>
      <button className={`${btn} ${ghost} ml-auto shrink-0 max-sm:!min-h-9 max-sm:!px-2 max-sm:text-xs`} aria-haspopup="dialog" onClick={() => { setTab('Growth'); setOpen(true) }}>{name}, {g.stage.name.toLowerCase()}</button>
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
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="px-tab px-tab-ando flex items-center gap-1 text-2xl"><Pic n={`s-${g.index}`} size={8} />{g.stage.name}</span>
              <span className="px-tab px-tab-matsu flex items-center gap-1 text-2xl"><Pic n="b-timed" size={8} />{got.length}/{badges.length}<span className="sr-only"> badges earned</span></span>
              {streakOn && streak > 0 && <span className="px-tab px-tab-matsu flex items-center gap-1 text-2xl"><Pic n="g-flame" size={8} />{streak}<span className="sr-only"> day habit streak</span></span>}
            </div>

            <div className="px-seg mt-3 flex-wrap" role="group" aria-label="Kodama sections">
              {TABS.map((t) => <button key={t} aria-pressed={tab === t} className="px-btn" onClick={() => setTab(t)}>{t}</button>)}
            </div>

            <div className="mt-3 space-y-3">
              {tab === 'Growth' && (
                <>
                  <Card title="Growth stage" aside={`${g.points} growth`}>
                    <ol className="mt-2 grid grid-cols-5 gap-1 text-center">
                      {STAGES.map((st, i) => (
                        <li key={st.name} className={`flex min-w-0 flex-col items-center px-1 pb-1 ${i === g.index ? 'bg-pale' : ''}`} aria-current={i === g.index ? 'step' : undefined}>
                          <span className={`text-xs ${i === g.index ? 'px-tab px-tab-ando' : 'text-slate-700'}`}>{i === g.index ? 'You' : i < g.index ? 'Reached' : `${st.from}+`}</span>
                          <Pic n={`s-${i}`} alt="" /><span className={`break-words text-xs ${i <= g.index ? 'text-ink' : 'text-slate-600'}`}>{st.name}</span>
                        </li>
                      ))}
                    </ol>
                    <Bar pct={g.pct} label="Growth" />
                    <p className="mt-2 text-slate-700">{g.next ? `${g.toNext} more growth until ${g.next.name}. Next unlock: ${g.next.unlock}` : 'Fully grown. It keeps you company.'}</p>
                    <p className="mt-2 text-slate-700">It grows when you log honest times, tap your energy, plan your mornings and wrap up your days. It never shrinks, and time away costs nothing.</p>
                  </Card>

                  <Card title="Next badge">
                    {next ? (
                      <div className="mt-2 flex items-center gap-3">
                        <Pic n="b-locked" size={16} />
                        <div className="min-w-0 flex-1">
                          <p className="text-2xl">{next.name}</p>
                          <p className="text-slate-700">{next.how}. {next.now} of {next.goal}.</p>
                          <Bar pct={Math.round((next.now / next.goal) * 100)} label={`Progress to ${next.name}`} />
                        </div>
                      </div>
                    ) : <p className="mt-2 text-slate-700">You have every badge.</p>}
                  </Card>

                  {streakOn && (
                    <Card title="Habit streak" aside={streak > 0 ? `${streak} days` : 'Starts with your next habit'}>
                      <ol className="mt-2 grid grid-cols-7 gap-1 text-center">
                        {week.map((d) => (
                          <li key={d.day} className={`flex flex-col items-center ${d.today ? 'bg-pale' : ''}`}>
                            <Pic n={d.lit ? 'g-flame' : 'g-ember'} size={8} alt={`${d.day}${d.lit ? ', a habit done' : ''}`} /><span className="text-xs text-slate-700">{d.letter}</span>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-2 text-slate-700">A flame for each day you logged a time, tapped your energy, planned or wrapped up. Two rest days a week do not break it.</p>
                    </Card>
                  )}
                </>
              )}

              {tab === 'Badges' && (
                <Card title="Badges" aside={`${got.length} of ${badges.length} earned`}>
                  {got.length ? (
                    <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {got.map((b) => (
                        <li key={b.id} className="flex flex-col items-center bg-ando-0 px-1 pb-2 pt-2 text-center text-ink">
                          <Pic n={`b-${b.id}`} size={16} />
                          <p className="mt-1 break-words">{b.name}</p>
                          <p className="text-xs">{b.how}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-2 text-slate-700">No badges yet. They are for the habits that make your plans better.</p>}
                  {next && <p className="mt-3">Next: <b className="font-normal text-ink">{next.name}</b>. {next.how}. {next.now} of {next.goal}.</p>}
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

              {tab === 'Memory' && <Memory data={data} setData={setData} name={name} />}

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
                  <label className="mt-3 flex min-h-11 items-center gap-2"><input type="checkbox" checked={streakOn} onChange={(e) => setData((d) => ({ ...d, kodama: { ...d.kodama, streak: e.target.checked || undefined } }))} />Show a habit streak</label>
                  <p className="text-xs text-slate-700">Counts days when you logged a time, tapped your energy, planned or wrapped up. Up to two rest days a week are fine. Off by default.</p>
                </Card>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
