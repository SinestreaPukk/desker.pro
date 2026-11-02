// Privacy settings (SPEC Checkpoint 8), inside the gear panel: what friends in this village see of what I am studying.
import { useState } from 'react'
import { patchMe, patchVillage, type Info } from './api.ts'
import Notifications from './Notifications.tsx'

export default function Privacy({ slug, me, libraryAutoFocus }: { slug: string; me: Info['me']; libraryAutoFocus: boolean }) {
  const [sharing, setSharing] = useState(me.statusSharing), [deadlines, setDeadlines] = useState(me.shareDeadlines), [auto, setAuto] = useState(libraryAutoFocus), [err, setErr] = useState(false)
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
    <Notifications />
  </>)
}
