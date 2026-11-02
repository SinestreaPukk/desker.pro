// Notification settings (Phase 1 CP8), inside the gear panel, and the one-time "want a nudge?" card.
import { useEffect, useState } from 'react'
import { QUIET_DEFAULT, type PushKind, type PushPrefs } from '@desker/shared'
import { disable, enable, pushState, save, supported } from './push.ts'
import type { PushState } from './api.ts'

const LABEL: Record<PushKind, string> = { answered: 'Someone answers my question', group: 'A study session starts in my village', busy: 'My village is busy (3+ friends studying)', deadline: 'A Board item I confirmed is due within a day' }
const hours = Array.from({ length: 24 }, (_, h) => h)

export default function Notifications() {
  const [st, setSt] = useState<PushState | null>(null), [err, setErr] = useState('')
  useEffect(() => { if (supported()) pushState().then(setSt, () => {}) }, [])
  if (!supported() || !st?.configured) return null // no keys on the server, or an old browser: nothing to show
  const set = (prefs: PushPrefs) => { setSt({ ...st, prefs }); if (st.subscribed) save(prefs).catch(() => setErr("Couldn't save that. Try again.")) }
  const on = (e: React.ChangeEvent<HTMLInputElement>) => (e.target.checked ? enable(st).then(() => { setErr(''); setSt({ ...st, subscribed: true }) }, (x: Error) => { setErr(x.message); e.target.checked = false }) : disable().then(() => setSt({ ...st, subscribed: false }), () => setErr("Couldn't turn that off.")))
  const q = st.prefs.quiet ?? QUIET_DEFAULT
  return (
    <fieldset className="privacy">
      <legend>Notifications</legend>
      <label><input type="checkbox" checked={st.subscribed} onChange={on} /> Notify me on this device</label>
      {st.subscribed && <>
        {(Object.keys(LABEL) as PushKind[]).map((k) => <label key={k}><input type="checkbox" checked={st.prefs.types[k]} onChange={(e) => set({ ...st.prefs, types: { ...st.prefs.types, [k]: e.target.checked } })} /> {LABEL[k]}</label>)}
        <label>Quiet hours{' '}
          <select value={q.from} aria-label="Quiet from" onChange={(e) => set({ ...st.prefs, quiet: { ...q, from: Number(e.target.value) } })}>{hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select>
          {' '}to{' '}
          <select value={q.to} aria-label="Quiet until" onChange={(e) => set({ ...st.prefs, quiet: { ...q, to: Number(e.target.value) } })}>{hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select>
        </label>
        <small>Nothing is sent during quiet hours, or while you are in the village.</small>
      </>}
      {err && <p role="alert">{err}</p>}
    </fieldset>
  )
}

/** Shown once, after a first finished focus or a first question. "Not now" is remembered on this device. */
export function NudgeCard({ onClose }: { onClose: () => void }) {
  const [st, setSt] = useState<PushState | null>(null), [err, setErr] = useState('')
  useEffect(() => { pushState().then(setSt, onClose) }, [])
  if (!st) return null
  const done = () => { localStorage.setItem('village.push.asked', '1'); onClose() }
  return (
    <div className="knock-card" role="dialog" aria-label="Notifications">
      <span>Want a nudge when friends answer or start a session?</span>
      <span className="row"><button onClick={() => enable(st).then(done, (e: Error) => setErr(e.message))}>Yes, notify me</button><button onClick={done}>Not now</button></span>
      {err && <span role="alert">{err}</span>}
    </div>
  )
}

/** Worth asking now? Only on a device that can, where the server can send, who has not been asked or already said yes. */
export async function shouldAsk() {
  if (!supported() || localStorage.getItem('village.push.asked') || Notification.permission === 'denied') return false
  try { const s = await pushState(); return s.configured && !s.subscribed } catch { return false }
}
