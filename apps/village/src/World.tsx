import { useEffect, useRef, useState } from 'react'
import { actionOf, isTyping, type Colour, type Member, type ServerMsg, type ZoneId } from '@desker/shared'
import BubbleBox from './BubbleBox.tsx'
import ChatLog from './ChatLog.tsx'
import { info, type Info } from './api.ts'
import { connect, type Status } from './net/connection.ts'
import Hud from './Hud.tsx'
import { Bridge } from './game/bridge.ts'

const PILL: Record<Status, string> = {
  connecting: 'Connecting…', online: '', reconnecting: 'Reconnecting…', failed: "Can't reach the village right now.",
  refresh: 'Kodama Village was updated. Please refresh the page.', elsewhere: 'Opened in another tab. Close that one or refresh here.',
}

/** A soft blip when someone nearby speaks, if the player turned cosy sounds on (SPEC §4.3). */
function blip() {
  try {
    const p = JSON.parse(localStorage.getItem('village.sound') ?? '{}'); if (!p.on) return
    const ac = new AudioContext(), o = ac.createOscillator(), g = ac.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(660, ac.currentTime); o.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.08)
    g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.12 * (p.volume ?? 0.5) + 0.0001, ac.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.18)
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.2); o.onended = () => ac.close()
  } catch { /* no audio available */ }
}

export default function World({ slug }: { slug: string }) {
  const el = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<Info | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('connecting')
  const [online, setOnline] = useState<Member[]>([])
  const [zone, setZone] = useState<ZoneId>('plaza')
  const [talk, setTalk] = useState<{ text: string } | null>(null), [shake, setShake] = useState(0), [notice, setNotice] = useState('')
  const [log, setLog] = useState<Extract<ServerMsg, { t: 'log' }>['items'] | null>(null), [logOpen, setLogOpen] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([])
  const send = useRef<(m: object) => void>(() => {}), lastText = useRef('')
  useEffect(() => { info(slug).then(setData).catch((e) => setErr(e.code ?? 'error')) }, [slug])
  useEffect(() => {
    if (!data || !el.current) return
    const onMsg = (m: ServerMsg) => {
      if (m.t === 'welcome') setOnline(m.members) // a fresh welcome replaces local state
      else if (m.t === 'joined') setOnline((o) => [...o.filter((x) => x.userId !== m.member.userId), m.member])
      else if (m.t === 'left') setOnline((o) => o.filter((x) => x.userId !== m.userId))
      else if (m.t === 'log') setLog(m.items)
      else if (m.t === 'said' && m.text && m.userId !== data.me.userId) blip()
      else if (m.t === 'queued') for (const q of m.items) { const id = Math.random(); setToasts((t) => [...t, { id, text: `${q.name ?? 'Someone'}: ${q.text ?? ''}` }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 12000) }
      else if (m.t === 'error' && m.code === 'slow_down') { setNotice('Slow down a little'); setShake((n) => n + 1); setTalk({ text: lastText.current }); setTimeout(() => setNotice(''), 2500) } // the box comes back with what you wrote
    }
    const bridge = new Bridge()
    const net = connect(data.village.id, { message: (m) => { onMsg(m); bridge.fromServer(m) }, status: setStatus })
    bridge.out = net.send; send.current = net.send
    // Even pixel size only: an odd-sized canvas puts tile edges on half pixels at zoom 3 and draws faint seams. (Registered before Phaser's own resize listener.)
    const box = el.current, fit = () => { box.style.width = `${innerWidth & ~1}px`; box.style.height = `${innerHeight & ~1}px` }
    fit(); window.addEventListener('resize', fit)
    let game: { destroy: (b: boolean) => void } | undefined, gone = false
    const name = data.members.find((m) => m.userId === data.me.userId)?.name ?? 'You'
    // the name tags use the pixel font, so it must be loaded before the first tag is drawn
    Promise.all([import('./game/start.ts'), document.fonts.load('7px VT323')]).then(([{ startGame }]) => { if (!gone) game = startGame(box, { userId: data.me.userId, name, colour: data.me.colour as Colour, bridge, onZone: setZone }) })
    return () => { gone = true; window.removeEventListener('resize', fit); net.close(); game?.destroy(true) }
  }, [data])
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLogOpen(false); return }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping() || actionOf(e.key) !== 'talk') return
      e.preventDefault(); setNotice(''); setTalk({ text: '' })
    }
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on)
  }, [])
  const names = [...new Set([...(data?.members ?? []), ...online].map((m) => m.name))]
  const say = (text: string) => { lastText.current = text; send.current({ t: 'say', text }); setTalk(null); setNotice('') }
  const openLog = () => { setLog(null); setLogOpen(true); send.current({ t: 'log' }) }
  if (err === 'not_member') return <main className="pad"><h1>You're not in this village</h1><p>You need a join link from a member. Ask a friend to send you one.</p><a href="/">Back to your villages</a></main>
  if (err) return <main className="pad"><p role="alert">Couldn't open the village ({err}).</p><a href="/">Back</a></main>
  if (!data) return <p className="pad">Loading the world…</p>
  return (
    <div className="world">
      <div ref={el} className="canvas" />
      <Hud name={data.village.name} zone={zone} pill={PILL[status]}>
        <div className="hud-online" aria-label="Online now (debug)">Online: {online.map((m) => m.name).join(', ') || '—'}</div>
        <div className="toasts" aria-live="polite">{toasts.map((t) => <p key={t.id}>📌 {t.text}</p>)}</div>
        <div className="bar-actions">
          <button onClick={() => { setNotice(''); setTalk({ text: '' }) }}>Talk<kbd>T</kbd></button>
          <button onClick={openLog}>Chat log</button>
        </div>
        {talk && <BubbleBox names={names} me={data.members.find((m) => m.userId === data.me.userId)?.name ?? ''} initial={talk.text} shake={shake} notice={notice} onSend={say} onClose={() => { setTalk(null); setNotice('') }} />}
        {logOpen && <ChatLog items={log} onClose={() => setLogOpen(false)} />}
      </Hud>
    </div>
  )
}
