import { useEffect, useState } from 'react'
import { mine, type Mine } from './api.ts'

export default function Picker() {
  const [list, setList] = useState<Mine[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { mine().then((r) => setList(r.villages)).catch((e) => setErr(e.message)) }, [])
  return (
    <main className="pad">
      <h1>Your villages</h1>
      {err ? <p role="alert">{/sign in/i.test(err) ? <>Sign in on Desker first, then come back. <a href="https://desker.dev">Open Desker</a></> : <>Couldn't load your villages ({err}).</>}</p> : !list ? <p>Loading…</p> : !list.length ? <p>None yet. Ask a friend for a join link.</p> : (
        <ul className="list">{list.map((v) => <li key={v.slug}><a href={`/v/${v.slug}`}>{v.name}</a> <small>{v.members} {v.members === 1 ? 'member' : 'members'}</small></li>)}</ul>
      )}
    </main>
  )
}
