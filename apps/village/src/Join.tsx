import { useEffect, useState } from 'react'
import { COLOURS } from '@desker/shared'
import { join, patchMe } from './api.ts'

export const HEX: Record<string, string> = { snow: '#f4f7fb', sky: '#9fc3ee', moss: '#9ccc9a', rose: '#f0a9b8', amber: '#f2c46d', plum: '#b69be0' }
const MSG: Record<string, string> = {
  bad_key: "That join link doesn't work. Ask for a fresh one.",
  full: 'This village is full.',
}

// /join/:slug?k=<key>: check the key, add me as a member, then a quick outfit colour pick.
export default function Join({ slug }: { slug: string }) {
  const [state, setState] = useState<'joining' | 'pick' | 'error'>('joining')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [already, setAlready] = useState(false)
  useEffect(() => {
    const key = new URLSearchParams(location.search).get('k') ?? ''
    history.replaceState(null, '', location.pathname) // the key is not kept in the address bar or history
    join(slug, key).then((r) => { if (r.joined) setState('pick'); else { setAlready(true); location.replace(`/v/${slug}`) } })
      .catch((e) => { setMsg(MSG[e.code] ?? 'Something went wrong. Try again in a moment.'); setState('error') })
  }, [slug])
  const choose = async (colour: string) => {
    setSaving(true)
    try { await patchMe(slug, { colour }) } catch { /* the default colour stays; they can change it later */ }
    location.replace(`/v/${slug}`)
  }
  if (state === 'error') return <main className="pad"><h1>Couldn't join</h1><p role="alert">{msg}</p><a href="/">Back to your villages</a></main>
  if (state === 'joining' || already) return <p className="pad">Joining…</p>
  return (
    <main className="pad">
      <h1>You're in! Pick your outfit colour</h1>
      <div className="swatches">{COLOURS.map((c) => <button key={c} disabled={saving} aria-label={c} title={c} onClick={() => choose(c)} style={{ background: HEX[c] }} />)}</div>
    </main>
  )
}
