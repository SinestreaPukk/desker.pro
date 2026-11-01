import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { info, type Info } from './api.ts'

// Checkpoint 4 replaces the canvas with the real WorldScene. For now: the village's data, a member list, and proof Phaser renders.
export default function World({ slug }: { slug: string }) {
  const el = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<Info | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { info(slug).then(setData).catch((e) => setErr(e.code ?? 'error')) }, [slug])
  useEffect(() => {
    if (!data) return
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: el.current!, width: 640, height: 360, pixelArt: true, roundPixels: true, backgroundColor: '#dfe9f5',
      scene: { create(this: Phaser.Scene) { this.add.text(16, 16, data.village.name, { fontFamily: 'monospace', color: '#35599a' }) } } })
    return () => game.destroy(true)
  }, [data])
  if (err === 'not_member') return <main className="pad"><h1>You're not in this village</h1><p>You need a join link from a member. Ask a friend to send you one.</p><a href="/">Back to your villages</a></main>
  if (err) return <main className="pad"><p role="alert">Couldn't open the village ({err}).</p><a href="/">Back</a></main>
  if (!data) return <p className="pad">Loading the world…</p>
  return (
    <main className="pad">
      <h1>{data.village.name}</h1>
      <div ref={el} />
      <h2>Members</h2>
      <ul className="list">{data.members.map((m) => <li key={m.userId}>{m.name} <small>{m.role}</small></li>)}</ul>
    </main>
  )
}
