import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import type { Member, ServerMsg } from '@desker/shared'
import { info, type Info } from './api.ts'
import { connect, type Status } from './net/connection.ts'

const PILL: Record<Status, string> = {
  connecting: 'Connecting…', online: '', reconnecting: 'Reconnecting…', failed: "Can't reach the village right now.",
  refresh: 'Kodama Village was updated. Please refresh the page.', elsewhere: 'Opened in another tab. Close that one or refresh here.',
}

// Checkpoint 4 replaces the canvas with the real WorldScene. For now: connects to the room and lists who is online (the "debug list").
export default function World({ slug }: { slug: string }) {
  const el = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<Info | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('connecting')
  const [online, setOnline] = useState<Member[]>([])
  useEffect(() => { info(slug).then(setData).catch((e) => setErr(e.code ?? 'error')) }, [slug])
  useEffect(() => {
    if (!data) return
    const onMsg = (m: ServerMsg) => {
      if (m.t === 'welcome') setOnline(m.members) // a fresh welcome replaces local state
      else if (m.t === 'joined') setOnline((o) => [...o.filter((x) => x.userId !== m.member.userId), m.member])
      else if (m.t === 'left') setOnline((o) => o.filter((x) => x.userId !== m.userId))
    }
    const net = connect(data.village.id, { message: onMsg, status: setStatus })
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: el.current!, width: 640, height: 360, pixelArt: true, roundPixels: true, backgroundColor: '#dfe9f5',
      scene: { create(this: Phaser.Scene) { this.add.text(16, 16, data.village.name, { fontFamily: 'monospace', color: '#35599a' }) } } })
    return () => { net.close(); game.destroy(true) }
  }, [data])
  if (err === 'not_member') return <main className="pad"><h1>You're not in this village</h1><p>You need a join link from a member. Ask a friend to send you one.</p><a href="/">Back to your villages</a></main>
  if (err) return <main className="pad"><p role="alert">Couldn't open the village ({err}).</p><a href="/">Back</a></main>
  if (!data) return <p className="pad">Loading the world…</p>
  return (
    <main className="pad">
      <h1>{data.village.name}</h1>
      {PILL[status] && <p className="pill" role="status">{PILL[status]}</p>}
      <div ref={el} />
      <h2>Online now ({online.length}) <small>debug</small></h2>
      <ul className="list">{online.map((m) => <li key={m.userId}>{m.name}</li>)}</ul>
      <h2>Members ({data.members.length})</h2>
      <ul className="list">{data.members.map((m) => <li key={m.userId}>{m.name} <small>{m.role}</small></li>)}</ul>
    </main>
  )
}
