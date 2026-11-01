import { useEffect, useRef, useState } from 'react'
import type { Colour, Member, ServerMsg, ZoneId } from '@desker/shared'
import { info, type Info } from './api.ts'
import { connect, type Status } from './net/connection.ts'
import Hud from './Hud.tsx'
import { Bridge } from './game/bridge.ts'

const PILL: Record<Status, string> = {
  connecting: 'Connecting…', online: '', reconnecting: 'Reconnecting…', failed: "Can't reach the village right now.",
  refresh: 'Kodama Village was updated. Please refresh the page.', elsewhere: 'Opened in another tab. Close that one or refresh here.',
}

export default function World({ slug }: { slug: string }) {
  const el = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<Info | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('connecting')
  const [online, setOnline] = useState<Member[]>([])
  const [zone, setZone] = useState<ZoneId>('plaza')
  useEffect(() => { info(slug).then(setData).catch((e) => setErr(e.code ?? 'error')) }, [slug])
  useEffect(() => {
    if (!data || !el.current) return
    const onMsg = (m: ServerMsg) => {
      if (m.t === 'welcome') setOnline(m.members) // a fresh welcome replaces local state
      else if (m.t === 'joined') setOnline((o) => [...o.filter((x) => x.userId !== m.member.userId), m.member])
      else if (m.t === 'left') setOnline((o) => o.filter((x) => x.userId !== m.userId))
    }
    const bridge = new Bridge()
    const net = connect(data.village.id, { message: (m) => { onMsg(m); bridge.fromServer(m) }, status: setStatus })
    bridge.out = net.send
    // Even pixel size only: an odd-sized canvas puts tile edges on half pixels at zoom 3 and draws faint seams. (Registered before Phaser's own resize listener.)
    const box = el.current, fit = () => { box.style.width = `${innerWidth & ~1}px`; box.style.height = `${innerHeight & ~1}px` }
    fit(); window.addEventListener('resize', fit)
    let game: { destroy: (b: boolean) => void } | undefined, gone = false
    const name = data.members.find((m) => m.userId === data.me.userId)?.name ?? 'You'
    // the name tags use the pixel font, so it must be loaded before the first tag is drawn
    Promise.all([import('./game/start.ts'), document.fonts.load('7px VT323')]).then(([{ startGame }]) => { if (!gone) game = startGame(box, { userId: data.me.userId, name, colour: data.me.colour as Colour, bridge, onZone: setZone }) })
    return () => { gone = true; window.removeEventListener('resize', fit); net.close(); game?.destroy(true) }
  }, [data])
  if (err === 'not_member') return <main className="pad"><h1>You're not in this village</h1><p>You need a join link from a member. Ask a friend to send you one.</p><a href="/">Back to your villages</a></main>
  if (err) return <main className="pad"><p role="alert">Couldn't open the village ({err}).</p><a href="/">Back</a></main>
  if (!data) return <p className="pad">Loading the world…</p>
  return (
    <div className="world">
      <div ref={el} className="canvas" />
      <Hud name={data.village.name} zone={zone} pill={PILL[status]}>
        <div className="hud-online" aria-label="Online now (debug)">Online: {online.map((m) => m.name).join(', ') || '—'}</div>
      </Hud>
    </div>
  )
}
