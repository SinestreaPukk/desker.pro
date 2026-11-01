// Invite panel (⋯ menu -> Invite): make links, copy, share to LINE, show a QR, see active links and cancel them.
import { useEffect, useState } from 'react'
import { createInvite, invites, revokeInvite, type Invite } from './api.ts'

const link = (code: string) => `${location.origin}/i/${code}`
const left = (i: Invite) => (i.expiresAt ? `expires ${new Date(i.expiresAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : 'never expires')

function Qr({ text }: { text: string }) { // qrcode-generator is loaded only when someone asks for a QR
  const [svg, setSvg] = useState('')
  useEffect(() => { import('qrcode-generator').then(({ default: qrcode }) => { const q = qrcode(0, 'M'); q.addData(text); q.make(); setSvg(q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })) }) }, [text])
  return <div className="qr" role="img" aria-label="QR code for this invite" dangerouslySetInnerHTML={{ __html: svg }} /> // markup made by the library from our own link, never from user text
}

export default function InvitePanel({ slug, name, canGuest, onClose }: { slug: string; name: string; canGuest: boolean; onClose: () => void }) {
  const [list, setList] = useState<Invite[] | null>(null), [err, setErr] = useState('')
  const [expiresIn, setExp] = useState<'24h' | '7d' | 'never'>('7d'), [maxUses, setMax] = useState<number | null>(null), [asGuest, setGuest] = useState(false)
  const [qr, setQr] = useState(''), [copied, setCopied] = useState('')
  const load = () => invites(slug).then((r) => setList(r.invites), () => setErr("Couldn't load the invites."))
  useEffect(() => { load() }, [slug])
  const make = () => createInvite(slug, { expiresIn, maxUses, asGuest }).then(() => { setErr(''); load() }, (e) => setErr(e.code === 'too_many_invites' ? 'Too many active links. Cancel one first.' : "Couldn't make a link. Try again."))
  const copy = (code: string) => navigator.clipboard?.writeText(link(code)).then(() => { setCopied(code); setTimeout(() => setCopied(''), 2000) }, () => setErr("Couldn't copy. Select the link and copy it by hand."))
  const line = (code: string) => `https://line.me/R/share?text=${encodeURIComponent(`Come study with me in ${name} on Kodama Village: ${link(code)}`)}`
  return (
    <div className="hud-modal" role="dialog" aria-label="Invite friends" onClick={onClose}>
      <div className="hud-panel invite" onClick={(e) => e.stopPropagation()}>
        <h2>Invite friends</h2>
        <div className="row">
          <label>Expires <select value={expiresIn} onChange={(e) => setExp(e.target.value as typeof expiresIn)}><option value="24h">in 24 hours</option><option value="7d">in 7 days</option><option value="never">never</option></select></label>
          <label>Uses <select value={maxUses ?? ''} onChange={(e) => setMax(e.target.value ? Number(e.target.value) : null)}><option value="">unlimited</option><option value="1">1</option><option value="10">10</option><option value="50">50</option></select></label>
          {canGuest && <label><input type="checkbox" checked={asGuest} onChange={(e) => setGuest(e.target.checked)} /> As guests</label>}
          <button onClick={make}>Make link</button>
        </div>
        {err && <p role="alert">{err}</p>}
        {!list ? <p>Loading…</p> : !list.length ? <p>No active links yet.</p> : (
          <ul className="invites">{list.map((i) => (
            <li key={i.code}>
              <code>{link(i.code)}</code>
              <small>{i.asGuest ? 'guest · ' : ''}{i.uses}{i.maxUses ? `/${i.maxUses}` : ''} used · {left(i)} · by {i.createdBy}</small>
              <span className="row">
                <button onClick={() => copy(i.code)}>{copied === i.code ? 'Copied!' : 'Copy'}</button>
                <a className="btn" href={line(i.code)} target="_blank" rel="noopener noreferrer">Share to LINE</a>
                <button onClick={() => setQr(qr === i.code ? '' : i.code)}>QR</button>
                <button onClick={() => revokeInvite(slug, i.code).then(load)}>Cancel link</button>
              </span>
              {qr === i.code && <Qr text={link(i.code)} />}
            </li>))}
          </ul>
        )}
        <p><button onClick={onClose}>Close (Esc)</button></p>
      </div>
    </div>
  )
}
