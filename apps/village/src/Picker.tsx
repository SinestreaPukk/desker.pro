import { useEffect, useState } from 'react'
import { mine, type Mine } from './api.ts'
import { HEX } from './Join.tsx'

export default function Picker() {
  const [list, setList] = useState<Mine[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { mine().then((r) => setList(r.villages)).catch((e) => setErr(e.message)) }, [])
  return (
    <main className="pad">
      <h1>Your villages</h1>
      {err ? <p role="alert">{/sign in/i.test(err) ? <>Sign in on Desker first, then come back. <a href="https://desker.dev">Open Desker</a></> : <>Couldn't load your villages ({err}).</>}</p> : !list ? <p>Loading…</p> : (
        <>
          {!list.length && <p>No village yet. Make one for your friends, or open an invite link someone sent you.</p>}
          <div className="vcards">{list.map((v) => (
            <a key={v.slug} className="vcard" href={`/v/${v.slug}`}>
              <b>{v.name}</b>
              <span className="dots" aria-label={`${v.dots.length} online`}>{v.dots.map((c, i) => <i key={i} style={{ background: HEX[c] ?? HEX.snow }} />)}</span>
              <small>{v.studying ? `${v.studying} studying now` : `${v.members} ${v.members === 1 ? 'member' : 'members'}`}</small>
              {v.next && <small>Next: {v.next.courseCode ? `${v.next.courseCode} · ` : ''}{v.next.title} · {new Date(v.next.dueAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</small>}
            </a>))}
          </div>
          <p><a className="btn" href="/new">+ New village</a></p>
        </>
      )}
    </main>
  )
}
