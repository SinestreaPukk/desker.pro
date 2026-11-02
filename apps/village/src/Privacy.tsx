// Privacy settings (SPEC Checkpoint 8), inside the gear panel: what friends in this village see of what I am studying.
import { useEffect, useState } from 'react'
import { blocks, patchMe, patchVillage, unblockUser, type Info } from './api.ts'
import Notifications from './Notifications.tsx'
import { lowFx, setLowFx } from './game/touch.ts'

export default function Privacy({ slug, me, libraryAutoFocus, onBlocked }: { slug: string; me: Info['me']; libraryAutoFocus: boolean; onBlocked: (id: string, on: boolean) => void }) {
  const [bl, setBl] = useState<{ userId: string; name: string }[]>([])
  useEffect(() => { blocks(slug).then((r) => setBl(r.blocks), () => {}) }, [slug])
  const [sharing, setSharing] = useState(me.statusSharing), [deadlines, setDeadlines] = useState(me.shareDeadlines), [auto, setAuto] = useState(libraryAutoFocus), [err, setErr] = useState(false), [fxNote, setFxNote] = useState(false)
  const run = (p: Promise<unknown>, after?: () => void) => p.then(() => { setErr(false); after?.() }, () => setErr(true))
  return (<>
    <fieldset className="privacy">
      <legend>Privacy in this village</legend>
      <label>What friends see of my status{' '}
        <select value={sharing} onChange={(e) => { const v = e.target.value; setSharing(v); run(patchMe(slug, { statusSharing: v }), () => location.reload()) }}>
          <option value="full">Everything (course, task)</option>
          <option value="basic">Just "Studying"</option>
          <option value="off">Nothing</option>
        </select>
      </label>
      <label><input type="checkbox" checked={deadlines} onChange={(e) => { setDeadlines(e.target.checked); run(patchMe(slug, { shareDeadlines: e.target.checked })) }} /> Share my deadlines with this village</label>
      {(me.role === 'owner' || me.role === 'admin') && <label><input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); run(patchVillage(slug, { libraryAutoFocus: e.target.checked })) }} /> Entering the Library turns Focus on (everyone, after a reload)</label>}
      {err && <p role="alert">Couldn't save that. Try again.</p>}
    </fieldset>
    <fieldset className="privacy">
      <legend>People I blocked</legend>
      {bl.length === 0 ? <p>No one. Block someone from the Members list; they are never told.</p> : <ul>{bl.map((b) => <li key={b.userId}>{b.name} <button type="button" onClick={() => unblockUser(slug, b.userId).then(() => { setBl((l) => l.filter((x) => x.userId !== b.userId)); onBlocked(b.userId, false) }, () => setErr(true))}>Unblock</button></li>)}</ul>}
    </fieldset>
    <fieldset className="privacy">
      <legend>Display</legend>
      <label><input type="checkbox" defaultChecked={lowFx()} onChange={(e) => { setLowFx(e.target.checked); setFxNote(true) }} /> Low effects (less snow, no steam or dust)</label>
      {fxNote && <p>Takes effect the next time you open the village.</p>}
    </fieldset>
    <Notifications />
  </>)
}
