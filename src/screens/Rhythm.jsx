import { useState, useEffect } from 'react'
import { track } from '../analytics.js'
import { btn, ghost, panel, input, DANGER } from '../ui.js'
import {
  profile, rhythmOf, TYPES, startingGrid, accuracyByWeek, learnedThisWeek, rangesText, withPrefs, resetRhythm, MIN_CHECKINS,
} from '../rhythm.js'
import { recap } from '../insights.js'
import { fmtDate } from '../shared.jsx'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 6:00 to 22:00
const hourLabel = (h) => (h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`)
// three steps of one hue, plus a text label in the cell title: colour is never the only cue
const SHADE = ['bg-yuki-1', 'bg-kori-1', 'bg-kori-2']

function Heatmap({ curve, sharpest }) {
  const grid = curve.confident ? curve.grid : startingGrid(sharpest) // before enough check-ins: a drawn starting guess, never planned from
  return (
    <div className="overflow-x-auto" role="img" aria-label={`Energy by weekday and hour. ${curve.confident ? `Usually high at ${rangesText(curve.hours('high')) || 'no clear hours'}.` : `A starting guess until you have ${MIN_CHECKINS} check-ins.`}`}>
      <table className="border-separate border-spacing-px text-xs">
        <thead><tr><th />{HOURS.map((h) => <th key={h} className="w-7 font-normal text-slate-700">{h % 3 === 0 ? hourLabel(h) : ''}</th>)}</tr></thead>
        <tbody>
          {DAYS.map((name, i) => {
            const dow = (i + 1) % 7
            return (
              <tr key={name}>
                <th className="pr-1 text-right font-normal text-slate-700">{name}</th>
                {HOURS.map((h) => {
                  const v = grid[dow][h], lvl = v >= 1.35 ? 2 : v <= 0.65 ? 0 : 1
                  return <td key={h} title={`${name} ${hourLabel(h)}: ${['low', 'medium', 'high'][lvl]}${curve.confident ? '' : ' (starting guess)'}`} className={`h-6 ${SHADE[lvl]}`} />
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-slate-700">Stronger colour means more energy.{!curve.confident && ` This is a starting guess for a typical student${sharpest ? ' (using the time of day you told us)' : ''}.`}</p>
    </div>
  )
}

const Pct = ({ v }) => (v == null ? 'n/a' : `${v}%`)

// "Your rhythm": what Desker has learned about how long your work takes and when you focus best, and every control over it.
export default function Rhythm({ data, setData, onReplan }) {
  useEffect(() => { track('rhythm_page_viewed') }, [])
  const p = profile(data)
  const r = rhythmOf(data)
  const [sure, setSure] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const weeks = accuracyByWeek(p.visible.outcomes).slice(-8)
  const week = recap(data)
  const learned = learnedThisWeek(data)
  const types = TYPES.map((type) => [type, { n: p.dur.byType[type]?.n || 0, mult: p.dur.multFor(type) }]).sort((a, b) => b[1].n - a[1].n) // every kind of work: the ones without timings yet show the starting guess
  const recent = [...r.outcomes].reverse().slice(0, 12)
  const byId = new Map(data.tasks.map((t) => [t.id, t]))
  const set = (fn) => setData((d) => ({ ...d, rhythm: fn(rhythmOf(d)) }))
  const setType = (task, type) => setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task ? { ...t, type } : t)), rhythm: { ...rhythmOf(d), outcomes: rhythmOf(d).outcomes.map((o) => (o.task === task ? { ...o, type } : o)) } }))
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), rhythm: r, energyLog: data.energyLog || [] }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'desker-rhythm.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const sunday = new Date().getDay() === 0
  const early = p.dur.n < 3
  const sec = 'mb-6'

  return (
    <div className="space-y-6">
      <section className={`${panel} ${sec}`} aria-label="Summary">
        <h2 className="px-tab px-tab-matsu mb-3 inline-block">{sunday ? 'Your week' : 'Where you are'}</h2>
        <p className="text-2xl">{p.off ? 'Learning is switched off.' : p.confidence.label}</p>
        <p className="mt-1 text-slate-700">
          {p.off ? 'Desker plans with the numbers you type in and does not record anything new. Your old data is kept until you delete it below.'
            : early ? `Desker starts with a guess: it plans about ${p.dur.overall}x the time you estimate. Finish and time a few tasks and tap your energy now and then, and this page fills in.`
            : `Based on ${p.dur.n} finished task${p.dur.n === 1 ? '' : 's'}${p.energy.n ? ` and ${p.energy.n} energy check-in${p.energy.n === 1 ? '' : 's'}` : ''}. Your work takes about ${p.dur.overall}x what you estimate.`}
        </p>
        {!p.off && (
          <div className="mt-3">
            <h3 className="font-semibold">{sunday ? 'This week Desker learned' : 'What Desker learned this week'}</h3>
            {learned.length ? <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">{learned.map((l) => <li key={l}>{l}</li>)}</ul>
              : <p className="mt-1 text-slate-700">{early ? 'Nothing new yet. It needs a few more finished tasks.' : 'Nothing new this week. Your numbers held steady.'}</p>}
            <p className="mt-2 text-base text-slate-700">{week.done ? `${week.done} task${week.done === 1 ? '' : 's'} done this week, ${week.hours} h focused.` : 'No tasks done yet this week.'}</p>
          </div>
        )}
        <button className={`${btn} ${ghost} mt-3`} onClick={onReplan}>Plan next week</button>
      </section>

      <section className={panel} aria-label="How long things take">
        <h2 className="mb-2 text-2xl">How long things take you</h2>
        <p className="mb-2 text-base text-slate-700">The number is how many times your estimate it really takes. 1.5x means a 1 hour task takes 1.5 hours.</p>
        {types.length ? (
          <table className="w-full text-left text-base">
            <thead><tr className="text-slate-700"><th className="py-1 font-normal">Kind of work</th><th className="font-normal">Takes you</th><th className="font-normal">Based on</th></tr></thead>
            <tbody>{types.map(([type, x]) => <tr key={type} className="border-t border-line"><td className="py-1">{type}</td><td>{x.mult}x</td><td className="text-slate-700">{x.n === 0 ? 'starting guess' : `${x.n} task${x.n === 1 ? '' : 's'}${x.n < 3 ? ', still a guess' : ''}`}</td></tr>)}</tbody>
          </table>
        ) : null}
        {p.dur.n === 0 && <p className="mt-2 text-base text-slate-700">When you tick a task off, Desker asks how long it took. Use the timer and it knows without asking.</p>}
        <h3 className="mt-4 font-semibold">How close the plans were</h3>
        <p className="text-base text-slate-700">How far off, on average, each week's time guesses were: your own estimate against what Desker reserved. Smaller is better.</p>
        {weeks.length ? (
          <table className="mt-1 w-full text-left text-base">
            <thead><tr className="text-slate-700"><th className="py-1 font-normal">Week of</th><th className="font-normal">Tasks</th><th className="font-normal">Your guess</th><th className="font-normal">Desker</th></tr></thead>
            <tbody>{weeks.map((w) => <tr key={w.week} className="border-t border-line"><td className="whitespace-nowrap py-1 pr-2">{fmtDate(w.week).replace(/^\w+, /, '')}</td><td>{w.n}</td><td><Pct v={w.estErr} /></td><td><Pct v={w.planErr} /></td></tr>)}</tbody>
          </table>
        ) : <p className="mt-1 text-slate-700">Shows up once you have finished a few timed tasks, and should shrink over the weeks.</p>}
      </section>

      <section className={panel} aria-label="Your energy">
        <h2 className="mb-2 text-2xl">When you have energy</h2>
        <Heatmap curve={p.energy} sharpest={data.onboarding?.sharpest} />
        <p className="mt-2 text-slate-700">{p.energy.confident ? `Usually high at ${rangesText(p.energy.hours('high')) || 'no clear hours'}. Usually low at ${rangesText(p.energy.hours('low')) || 'no clear hours'}. Demanding work is planned into your high hours.` : `Tap your energy a few times a day (Today does the asking). After ${Math.max(1, MIN_CHECKINS - p.energy.n)} more check-ins this becomes yours.`}</p>
        <ul className="mt-2 space-y-1 text-base text-slate-700">
          {p.focus && <li>Your focus sessions usually run about {p.focus} minutes, so the timer starts there.</li>}
          {p.lag != null && <li>{p.lag >= 10 ? `You usually start about ${p.lag} minutes late, so blocks get that much slack.` : p.lag <= -5 ? `You usually start ${-p.lag} minutes early.` : 'You usually start on time.'}</li>}
        </ul>
      </section>

      <section className={panel} aria-label="Check and correct">
        <h2 className="mb-2 text-2xl">Check and correct</h2>
        <p className="text-base text-slate-700">The last timings Desker learned from. If a kind of work is wrong, fix it and the numbers update. Ignore a stretch of time that was not normal, like exam week or being ill.</p>
        {recent.length ? (
          <ul className="mt-2 space-y-1 text-base">
            {recent.map((o) => {
              const t = byId.get(o.task)
              return (
                <li key={`${o.task}-${o.src}-${o.at}`} className="flex flex-wrap items-center gap-2 border-t border-line py-1">
                  <span className="min-w-0 flex-1 break-words">{t?.title || 'Deleted task'}</span>
                  <span className="text-slate-700">{Math.round(o.est * 60)} min planned, {Math.round(o.actual * 60)} min taken</span>
                  <select className={`${input} text-base`} aria-label={`Kind of work for ${t?.title || 'this task'}`} value={o.type} onChange={(e) => setType(o.task, e.target.value)}>
                    {TYPES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                  <button className={`${btn} ${DANGER}`} aria-label={`Forget this timing for ${t?.title || 'deleted task'}`} onClick={() => set((x) => ({ ...x, outcomes: x.outcomes.filter((y) => y !== o) }))}>Forget</button>
                </li>
              )
            })}
          </ul>
        ) : <p className="mt-2 text-slate-700">Nothing recorded yet.</p>}
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (range.from && range.to && range.from <= range.to) { set((x) => withPrefs(x, { excluded: [...x.prefs.excluded, range] })); setRange({ from: '', to: '' }) } }}>
          <label className="flex flex-col gap-1 text-base">Ignore from<input type="date" className={input} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-base">to<input type="date" className={input} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
          <button className={`${btn} ${ghost}`} disabled={!range.from || !range.to || range.from > range.to}>Ignore this period</button>
        </form>
        {r.prefs.excluded.length > 0 && (
          <ul className="mt-2 text-base">
            {r.prefs.excluded.map((x, i) => (
              <li key={i} className="flex items-center gap-2">Ignoring {fmtDate(x.from)} to {fmtDate(x.to)}
                <button className={btn} onClick={() => set((y) => withPrefs(y, { excluded: y.prefs.excluded.filter((_, j) => j !== i) }))}>Stop ignoring</button></li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel} aria-label="Your data">
        <h2 className="mb-2 text-2xl">Your data</h2>
        <p className="text-base text-slate-700">Desker records when you focus, how long finished tasks took and your energy taps. It stays in your account and is used only to plan for you. You can download it, ignore a stretch of time, switch learning off or delete it here.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={!p.off} onChange={(e) => set((x) => withPrefs(x, { off: e.target.checked ? undefined : true }))} />Learn from how I work</label>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={!p.prefs.noAsk} disabled={p.off} onChange={(e) => set((x) => withPrefs(x, { noAsk: e.target.checked ? undefined : true }))} />Ask me how my energy is now and then</label>
          <button className={`${btn} ${ghost}`} onClick={exportJson}>Download my rhythm data</button>
        </div>
        <div className="mt-3">
          {sure === 'all' ? (
            <p role="alert">Delete everything Desker learned: {r.outcomes.length} timings, {r.sessions.length} focus sessions and {(data.energyLog || []).length} energy taps? Your tasks stay.{' '}
              <button className={`${btn} ${DANGER}`} onClick={() => { setData((d) => ({ ...d, rhythm: resetRhythm(rhythmOf(d)), energyLog: [] })); setSure('') }}>Delete it</button>
              <button className={btn} onClick={() => setSure('')}>Cancel</button></p>
          ) : <button className={`${btn} ${DANGER}`} onClick={() => setSure('all')}>Delete what Desker learned</button>}
        </div>
      </section>
    </div>
  )
}
