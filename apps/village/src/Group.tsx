// Study together (Phase 1 CP7): the start dialog, the banner and the summary card. The clock is the shared phaseAt() of the session record, the same for everyone.
import { useState } from 'react'
import { phaseAt, BREAK_WARNING_MS, OUTFIT_TINTS, type Colour, type GroupPhase } from '@desker/shared'
import type { GroupState, GroupSummary } from './api.ts'

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const hex = (c: string) => '#' + (OUTFIT_TINTS[c as Colour] ?? 0xf2f5fa).toString(16).padStart(6, '0')
const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)

export function GroupStart({ onStart, onClose, error }: { onStart: (b: { focusMin: number; breakMin: number; rounds: number }) => void; onClose: () => void; error: string }) {
  const [focus, setFocus] = useState(50), [brk, setBrk] = useState(10), [rounds, setRounds] = useState(3), [cf, setCf] = useState(false), [cb, setCb] = useState(false)
  const pick = (opts: number[], v: number, set: (n: number) => void, custom: boolean, setCustom: (b: boolean) => void, lo: number, hi: number, label: string) => (
    <p className="chips" role="radiogroup" aria-label={label}>
      {opts.map((o) => <button key={o} type="button" role="radio" aria-checked={!custom && v === o} className={!custom && v === o ? 'on' : ''} onClick={() => { setCustom(false); set(o) }}>{o}</button>)}
      <button type="button" role="radio" aria-checked={custom} className={custom ? 'on' : ''} onClick={() => setCustom(true)}>Custom</button>
      {custom && <input type="number" min={lo} max={hi} value={v} onChange={(e) => set(Number(e.target.value))} aria-label={`${label} (${lo} to ${hi})`} />}
    </p>)
  const ok = Number.isInteger(focus) && focus >= 10 && focus <= 120 && Number.isInteger(brk) && brk >= 1 && brk <= 30
  return (
    <div className="hud-modal" role="dialog" aria-label="Start a study session" onClick={onClose}>
      <form className="hud-panel add-item" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { e.nativeEvent.stopPropagation(); if (e.key === 'Escape') onClose() }} onSubmit={(e) => { e.preventDefault(); if (ok) onStart({ focusMin: focus, breakMin: brk, rounds }) }}>
        <h2>Study together</h2>
        <p>Focus minutes</p>{pick([25, 50], focus, setFocus, cf, setCf, 10, 120, 'Focus minutes')}
        <p>Break minutes</p>{pick([5, 10], brk, setBrk, cb, setCb, 1, 30, 'Break minutes')}
        <p className="row"><label>Rounds <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></label></p>
        <p className="meta">{focus}/{brk} × {rounds} · about {hm(rounds * focus + (rounds - 1) * brk)}</p>
        <p className="row"><button type="submit" disabled={!ok}>Start</button> <button type="button" onClick={onClose}>Cancel</button></p>
        {error && <p role="alert" className="err">{error}</p>}
      </form>
    </div>
  )
}

/** The strip under the top bar: what the session is doing now, and the way in or out. */
export function GroupBar({ g, now, joined, canEnd, onJoin, onLeave, onEnd }: { g: GroupState; now: number; joined: boolean; canEnd: boolean; onJoin: () => void; onLeave: () => void; onEnd: () => void }) {
  const p: GroupPhase = phaseAt(g, now), left = p.endsAt - now
  const shape = `${g.focusMin}/${g.breakMin} × ${g.rounds}`
  let line: string
  if (p.kind === 'break') line = left <= BREAK_WARNING_MS ? `Back to desks in ${left > 30_000 ? '1 min' : 'a moment'}` : `Break · ${g.breakMin} min · the Lounge is open`
  else line = `Round ${p.round} of ${g.rounds}`
  return (
    <div className={`group-bar ${p.kind}`} role="status" aria-label="Study session">
      <b>{joined || g.participants.length ? line : `${g.startedByName} started a study session · ${shape}`}</b>
      <span className="clock">{mmss(left)}</span>
      <span className="who-in">{g.participants.length ? g.participants.map((x) => x.name).join(', ') : 'No one has joined yet'}</span>
      {!joined && <button type="button" onClick={onJoin}>Join <kbd>J</kbd></button>}
      {joined && <button type="button" onClick={onLeave}>Leave</button>}
      {canEnd && <button type="button" onClick={onEnd}>End for everyone</button>}
    </div>
  )
}

export function GroupSummaryCard({ s, me, onClose }: { s: GroupSummary; me: string; onClose: () => void }) {
  return (
    <div className="hud-modal" role="dialog" aria-label="Study session summary" onClick={onClose}>
      <div className="hud-panel" onClick={(e) => e.stopPropagation()}>
        <h2>Well done!</h2>
        <p><b>{s.people.length} of you · {hm(s.totalMin)}</b> <span className="meta">{s.focusMin}/{s.breakMin} × {s.rounds}</span></p>
        <ul className="sum">{s.people.map((p) => <li key={p.userId}><i style={{ background: hex(p.colour) }} aria-hidden /> <b>{p.name}{p.userId === me ? ' (you)' : ''}</b> · {hm(p.minutes)}{p.taskTitle || p.courseCode ? <span className="meta"> · {[p.courseCode, p.taskTitle].filter(Boolean).join(' · ')}</span> : null}</li>)}</ul>
        <p><button type="button" onClick={onClose} autoFocus>Close</button></p>
      </div>
    </div>
  )
}
