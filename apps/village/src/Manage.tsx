// Members panel for owner and admins (⋯ menu -> Manage members): change role, kick, ban, transfer ownership.
import { useEffect, useState } from 'react'
import { canModerate, canSetRole } from '@desker/shared'
import { moderate, people, setRole, transfer, type Person } from './api.ts'

export default function Manage({ slug, villageName, myRole, me, onClose }: { slug: string; villageName: string; myRole: string; me: string; onClose: () => void }) {
  const [list, setList] = useState<Person[] | null>(null), [err, setErr] = useState('')
  const [sure, setSure] = useState(''), [xfer, setXfer] = useState<{ id: string; typed: string } | null>(null)
  const load = () => people(slug).then((r) => setList(r.members), () => setErr("Couldn't load members."))
  useEffect(() => { load() }, [slug])
  const run = (p: Promise<unknown>, reload = true) => p.then(() => { setErr(''); setSure(''); setXfer(null); if (reload) load() }, (e) => setErr(e.code === 'name_mismatch' ? "That isn't the village name." : 'Not allowed, or something went wrong.'))
  return (
    <div className="hud-modal" role="dialog" aria-label="Manage members" onClick={onClose}>
      <div className="hud-panel manage" onClick={(e) => e.stopPropagation()}>
        <h2>Manage members</h2>
        {err && <p role="alert">{err}</p>}
        {!list ? <p>Loading…</p> : (
          <ul>{list.map((m) => {
            const mod = m.userId !== me && canModerate(myRole, m.role), roles = ['admin', 'member', 'guest'].filter((r) => r !== m.role && canSetRole(myRole, m.role, r))
            return (
              <li key={m.userId} className={m.banned ? 'off' : ''}>
                <b>{m.name}{m.userId === me ? ' (you)' : ''}</b> <small>{m.banned ? 'banned' : m.role}</small>
                {m.userId !== me && <span className="row">
                  {!m.banned && roles.length > 0 && <select aria-label={`Role for ${m.name}`} value="" onChange={(e) => e.target.value && run(setRole(slug, m.userId, e.target.value))}><option value="">Change role…</option>{roles.map((r) => <option key={r} value={r}>{r}</option>)}</select>}
                  {mod && !m.banned && <button onClick={() => (sure === `k${m.userId}` ? run(moderate(slug, m.userId, 'kick')) : setSure(`k${m.userId}`))}>{sure === `k${m.userId}` ? 'Sure? Kick' : 'Kick'}</button>}
                  {mod && !m.banned && <button onClick={() => (sure === `b${m.userId}` ? run(moderate(slug, m.userId, 'ban')) : setSure(`b${m.userId}`))}>{sure === `b${m.userId}` ? 'Sure? Ban' : 'Ban'}</button>}
                  {mod && m.banned && <button onClick={() => run(moderate(slug, m.userId, 'unban'))}>Unban</button>}
                  {myRole === 'owner' && !m.banned && m.role !== 'guest' && <button onClick={() => setXfer({ id: m.userId, typed: '' })}>Make owner…</button>}
                </span>}
                {xfer?.id === m.userId && (
                  <span className="row"><label>Type “{villageName}” to hand it over <input value={xfer.typed} onChange={(e) => setXfer({ ...xfer, typed: e.target.value })} /></label>
                    <button disabled={xfer.typed.trim() !== villageName} onClick={() => run(transfer(slug, m.userId, xfer.typed).then(() => location.reload()), false)}>Transfer ownership</button></span>)}
              </li>)
          })}</ul>
        )}
        <p><small>Kicked people can rejoin with an invite. Banned people can't.</small></p>
        <p><button onClick={onClose}>Close (Esc)</button></p>
      </div>
    </div>
  )
}
