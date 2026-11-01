import { useEffect, useState } from 'react'
import { COLOURS } from '@desker/shared'
import { inviteAccept, invitePreview, patchMe, type InvitePreview } from './api.ts'

export const HEX: Record<string, string> = { snow: '#f4f7fb', sky: '#9fc3ee', moss: '#9ccc9a', rose: '#f0a9b8', amber: '#f2c46d', plum: '#b69be0' }
const MSG: Record<string, string> = {
  expired: 'This invite has expired. Ask for a new one.', revoked: 'This invite was cancelled. Ask for a new one.', used_up: 'This invite has been used up. Ask for a new one.',
  full: 'This village is full.', banned: "You can't join this village.", closed: 'This village was closed.', too_many_joined: "You're in 20 villages already. Leave one to join another.",
  not_found: "That invite link doesn't work. Check it, or ask for a new one.",
}

// /i/:code: a preview card, Join, then a short first-time setup (outfit colour, what friends see, deadlines) before the world.
export default function InviteJoin({ code }: { code: string }) {
  const [p, setP] = useState<InvitePreview | null>(null), [err, setErr] = useState('')
  const [slug, setSlug] = useState(''), [busy, setBusy] = useState(false)
  const [colour, setColour] = useState('snow'), [sharing, setSharing] = useState('basic'), [deadlines, setDeadlines] = useState(false)
  useEffect(() => {
    invitePreview(code).then((r) => { if (r.verdict === 'already' && r.slug) location.replace(`/v/${r.slug}`); else setP(r) }, (e) => setErr(MSG[e.code] ?? 'Something went wrong. Try again in a moment.'))
  }, [code])
  const join = async () => {
    setBusy(true); setErr('')
    try { const r = await inviteAccept(code); if (!r.joined) return location.replace(`/v/${r.slug}`); setSlug(r.slug) }
    catch (e) { setErr(MSG[(e as { code?: string }).code ?? ''] ?? 'Something went wrong. Try again in a moment.'); setBusy(false) }
  }
  const finish = async () => {
    setBusy(true)
    try { await patchMe(slug, { colour, statusSharing: sharing, shareDeadlines: deadlines }) } catch { /* the defaults stay; all of it can be changed in Settings */ }
    location.replace(`/v/${slug}?first=1`)
  }
  if (err && !p) return <main className="pad"><h1>Couldn't open the invite</h1><p role="alert">{err}</p><a href="/">Back to your villages</a></main>
  if (!p) return <p className="pad">Opening the invite…</p>
  if (slug) return (
    <main className="pad new">
      <h1>You're in! A few quick choices</h1>
      <div className="swatches" role="radiogroup" aria-label="Outfit colour">{COLOURS.map((c) => <button key={c} role="radio" aria-checked={colour === c} aria-label={c} title={c} onClick={() => setColour(c)} style={{ background: HEX[c], outline: colour === c ? '3px solid #35599a' : 'none' }} />)}</div>
      <label>What friends see of my studying
        <select value={sharing} onChange={(e) => setSharing(e.target.value)}>
          <option value="basic">Just "Studying"</option><option value="full">Subject and task</option><option value="off">Nothing</option>
        </select>
        <small>You can change this any time in Settings.</small></label>
      <label><input type="checkbox" checked={deadlines} onChange={(e) => setDeadlines(e.target.checked)} /> Share my deadlines for this village's courses on its Board</label>
      <p><button disabled={busy} onClick={finish}>Enter the village</button></p>
    </main>
  )
  const v = p.village
  if (p.verdict !== 'ok' || !v) return <main className="pad"><h1>Couldn't join</h1><p role="alert">{MSG[p.verdict] ?? 'This invite does not work.'}</p><a href="/">Back to your villages</a></main>
  return (
    <main className="pad new">
      <div className="vcard"><b>{v.name}</b><small>Made by {v.owner}</small><small>{v.members} {v.members === 1 ? 'member' : 'members'} · {v.online} online</small>{p.guest && <small>You'll join as a guest: you can walk and chat, but not claim a desk.</small>}</div>
      {err && <p role="alert">{err}</p>}
      <p><button disabled={busy} onClick={join}>Join village</button></p>
    </main>
  )
}
