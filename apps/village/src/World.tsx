import { useEffect, useRef, useState } from 'react'
import { actionOf, isTyping, urgency, type Presence, type Colour, type Member, type ServerMsg, type ZoneId } from '@desker/shared'
import BubbleBox from './BubbleBox.tsx'
import ChatLog from './ChatLog.tsx'
import { track, board as fetchBoard, claimDesk, focusEnd, focusStart, info, type BoardItem, type Info } from './api.ts'
import Board from './Board.tsx'
import { TaskPicker, TimerHud, type Pick, type Timer } from './Focus.tsx'
import Privacy from './Privacy.tsx'
import Members from './Members.tsx'
import { connect, type Status } from './net/connection.ts'
import Hud from './Hud.tsx'
import { Bridge } from './game/bridge.ts'
import { isTouchUi } from './game/touch.ts'

const PILL: Record<Status, string> = {
  connecting: 'Connecting…', online: '', reconnecting: 'Reconnecting…', failed: "Can't reach the village right now.",
  refresh: 'Kodama Village was updated. Please refresh the page.', elsewhere: 'Opened in another tab. Close that one or refresh here.',
}

/** A soft blip when someone nearby speaks, if the player turned cosy sounds on (SPEC §4.3). */
function blip(from = 660, to = 880) {
  try {
    const p = JSON.parse(localStorage.getItem('village.sound') ?? '{}'); if (!p.on) return
    const ac = new AudioContext(), o = ac.createOscillator(), g = ac.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(from, ac.currentTime); o.frequency.exponentialRampToValueAtTime(to, ac.currentTime + 0.08)
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
  const [membersOpen, setMembersOpen] = useState(false), [presence, setPresence] = useState<Presence>('available')
  const timerKey = `village.timer.${slug}`
  const [timer, setTimerState] = useState<Timer | null>(() => { try { const t = JSON.parse(localStorage.getItem(timerKey) ?? 'null') as Timer | null; return t && Date.now() < t.endsAt + 3_600_000 ? t : null } catch { return null } }) // a timer survives a reload
  const [pick, setPick] = useState(false), [ask, setAsk] = useState(false), [now, setNow] = useState(Date.now())
  const timerRef = useRef<Timer | null>(timer), chimed = useRef(false)
  const setTimer = (t: Timer | null) => { timerRef.current = t; setTimerState(t); if (t) localStorage.setItem(timerKey, JSON.stringify(t)); else localStorage.removeItem(timerKey) }
  const [boardOpen, setBoardOpen] = useState(false), [boardItems, setBoardItems] = useState<BoardItem[] | null>(null)
  const touch = isTouchUi(), [more, setMore] = useState(false)
  const time = useRef({ since: Date.now() as number | null, focusMin: 0 }) // minutes present and focused, reported when the tab hides or closes
  const bridgeRef = useRef<Bridge | null>(null)
  const send = useRef<(m: object) => void>(() => {}), lastText = useRef('')
  const loadBoard = () => fetchBoard(slug).then((r) => { setBoardItems(r.items); bridgeRef.current?.boardPin(r.items.some((i) => urgency(i.dueAt, Date.now()) === 'red' && i.dueAt > Date.now())) }, () => {})
  useEffect(() => { if (!data) return; loadBoard(); const t = setInterval(loadBoard, 300_000); return () => clearInterval(t) }, [data]) // polled every 5 minutes in Phase 0
  useEffect(() => { if (boardOpen) { loadBoard(); track(slug, 'board_opened') } }, [boardOpen])
  useEffect(() => { // village_opened, and session_minutes on leave and whenever the tab hides (sendBeacon, as a closing tab cannot wait)
    if (!data) return
    track(slug, 'village_opened', { device: touch ? 'phone' : 'desktop' })
    const report = () => {
      const t = time.current, minutes = t.since ? Math.round((Date.now() - t.since) / 60000) : 0, focusMinutes = Math.round(t.focusMin) // a running timer counts as focus when it ends
      if (minutes > 0 || focusMinutes > 0) track(slug, 'session_minutes', { minutes, focusMinutes }, true)
      t.since = null; t.focusMin = 0
    }
    const vis = () => { if (document.visibilityState === 'hidden') report(); else time.current.since = Date.now() }
    document.addEventListener('visibilitychange', vis); window.addEventListener('pagehide', report)
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', report); report() }
  }, [data])
  useEffect(() => { info(slug).then(setData).catch((e) => setErr(e.code ?? 'error')) }, [slug])
  useEffect(() => { // just created: say hello once (the Kodama's line, as a toast until the NPC sprite exists)
    if (!data || new URLSearchParams(location.search).get('new') !== '1') return
    history.replaceState(null, '', location.pathname)
    toast('Welcome to your village! Invite friends from the ⋯ menu.')
  }, [data])
  useEffect(() => {
    if (!data || !el.current) return
    const onMsg = (m: ServerMsg) => {
      if (m.t === 'welcome') { setOnline(m.members); if (timerRef.current && !m.focus[data.me.userId]) announce(timerRef.current) } // a fresh welcome replaces local state; a timer that was running is re-announced
      else if (m.t === 'joined') setOnline((o) => [...o.filter((x) => x.userId !== m.member.userId), m.member])
      else if (m.t === 'left') setOnline((o) => o.filter((x) => x.userId !== m.userId))
      else if (m.t === 'log') setLog(m.items)
      else if (m.t === 'said' && m.text && m.userId !== data.me.userId) blip()
      else if (m.t === 'queued') for (const q of m.items) { const id = Math.random(); setToasts((t) => [...t, { id, text: `${q.name ?? 'Someone'}: ${q.text ?? ''}` }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 12000) }
      else if (m.t === 'error' && m.code === 'slow_down') { setNotice('Slow down a little'); setShake((n) => n + 1); setTalk({ text: lastText.current }); setTimeout(() => setNotice(''), 2500) } // the box comes back with what you wrote
    }
    const bridge = new Bridge(); bridgeRef.current = bridge
    const net = connect(data.village.id, { message: (m) => { onMsg(m); bridge.fromServer(m) }, status: setStatus })
    bridge.out = net.send; send.current = net.send
    // Even pixel size only: an odd-sized canvas puts tile edges on half pixels at zoom 3 and draws faint seams. (Registered before Phaser's own resize listener.)
    const box = el.current, fit = () => { box.style.width = `${innerWidth & ~1}px`; box.style.height = `${innerHeight & ~1}px` }
    fit(); window.addEventListener('resize', fit)
    let game: { destroy: (b: boolean) => void } | undefined, gone = false
    const name = data.members.find((m) => m.userId === data.me.userId)?.name ?? 'You'
    // the name tags use the pixel font, so it must be loaded before the first tag is drawn
    Promise.all([import('./game/start.ts'), document.fonts.load('7px VT323')]).then(([{ startGame }]) => { if (!gone) game = startGame(box, {
      userId: data.me.userId, name, colour: data.me.colour as Colour, bridge, onZone: setZone, onPresence: setPresence, libraryAutoFocus: data.village.libraryAutoFocus,
      desks: data.members.flatMap((m) => (m.deskSpotId ? [{ userId: m.userId, spotId: m.deskSpotId }] : [])), names: Object.fromEntries(data.members.map((m) => [m.userId, m.name])),
      claimDesk: (spotId) => claimDesk(slug, spotId).then(() => true, () => false),
      openBoard: () => setBoardOpen(true),
      focusKey: (atDesk) => { if (timerRef.current) { setAsk(true); return true } if (atDesk) { setPick(true); return true } return false },
    }) })
    return () => { gone = true; window.removeEventListener('resize', fit); net.close(); game?.destroy(true) }
  }, [data])
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLogOpen(false); setMembersOpen(false); setPick(false); setBoardOpen(false); return }
      if (e.key === 'Tab' && !isTyping()) { e.preventDefault(); setMembersOpen((o) => !o); return } // Tab = members (SPEC §5.1)
      if (actionOf(e.key, isTyping()) === 'board' && !e.ctrlKey && !e.metaKey && !e.altKey) { setBoardOpen((o) => !o); return } // B anywhere
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping() || actionOf(e.key) !== 'talk') return
      e.preventDefault(); setNotice(''); setTalk({ text: '' })
    }
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on)
  }, [])
  // Tell the room about my timer: the ring for friends, the activity icon, and quiet mode. Also after every reconnect, since the room forgets me when the connection drops.
  const announce = (t: Timer) => {
    send.current({ t: 'focus.start', plannedMin: Math.min(600, Math.max(1, Math.ceil((t.endsAt - (t.pausedAt ?? Date.now())) / 60000))), ...(t.taskId && { taskId: t.taskId.slice(0, 64) }) })
    send.current({ t: 'status', status: { activity: t.activity, ...(t.courseCode && { courseCode: t.courseCode.slice(0, 16) }), ...(t.taskId && { taskId: t.taskId.slice(0, 64) }), taskTitle: t.title.slice(0, 120), endsAt: new Date(t.endsAt).toISOString() } })
    if (t.pausedAt) send.current({ t: 'focus.pause' })
    bridgeRef.current?.timer(true)
  }
  const pauseTimer = () => { // freeze the countdown (and friends' ring); resuming pushes the end forward by however long it was paused
    const t = timerRef.current; if (!t) return
    if (!t.pausedAt) { send.current({ t: 'focus.pause' }); setTimer({ ...t, pausedAt: Date.now(), pauses: (t.pauses ?? 0) + 1 }) }
    else { const d = Date.now() - t.pausedAt; send.current({ t: 'focus.resume' }); setTimer({ ...t, pausedAt: undefined, endsAt: t.endsAt + d, pausedMs: (t.pausedMs ?? 0) + d }); setNow(Date.now()) }
  }
  const startTimer = async (p: Pick) => {
    setPick(false)
    try {
      const r = await focusStart(slug, p.minutes), at = Date.now()
      const t: Timer = { sessionId: r.sessionId, startedAt: at, endsAt: at + p.minutes * 60_000, plannedMin: p.minutes, pausedMs: 0, pauses: 0, taskId: p.taskId, title: p.title, courseCode: p.courseCode, activity: p.activity }
      chimed.current = false; setTimer(t); setNow(at); announce(t)
    } catch { toast("Couldn't start the timer. Try again.") }
  }
  const toast = (text: string) => { const id = Math.random(); setToasts((t) => [...t, { id, text }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000) }
  const endTimer = (done: boolean) => {
    const t = timerRef.current; if (!t) return
    send.current({ t: 'focus.stop' }); bridgeRef.current?.timer(false); setTimer(null); setAsk(false)
    const activeMin = Math.max(0, Math.round((Math.min(t.pausedAt ?? Date.now(), t.endsAt) - t.startedAt - (t.pausedMs ?? 0)) / 60000)) // paused time is not focus time
    time.current.focusMin += activeMin
    focusEnd(slug, { sessionId: t.sessionId, activeMin, plannedMin: t.plannedMin, pauses: t.pauses ?? 0, done, taskId: t.taskId }).then(
      (r) => toast(r.again ? 'Already saved.' : r.reason && r.reason !== 'no_outcome' ? `Logged ${activeMin} min in Desker. Too short or long to teach it your pace.` : `Logged ${activeMin} min in Desker${done && t.taskId ? '. Task done!' : '.'}`),
      () => toast("Couldn't save that session to Desker."))
  }
  useEffect(() => { // count down, chime once at zero and ask the one question
    if (!timer) return
    const tick = () => { setNow(Date.now()); if (!timer.pausedAt && Date.now() >= timer.endsAt && !chimed.current) { chimed.current = true; blip(523, 784); setAsk(true) } }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [timer])
  const names = [...new Set([...(data?.members ?? []), ...online].map((m) => m.name))]
  const say = (text: string) => { track(slug, 'bubble_sent', { zoneId: zone, length: [...text].length }); lastText.current = text; send.current({ t: 'say', text }); setTalk(null); setNotice('') }
  const openLog = () => { setLog(null); setLogOpen(true); send.current({ t: 'log' }) }
  if (err === 'not_member') return <main className="pad"><h1>You're not in this village</h1><p>You need a join link from a member. Ask a friend to send you one.</p><a href="/">Back to your villages</a></main>
  if (err) return <main className="pad"><p role="alert">Couldn't open the village ({err}).</p><a href="/">Back</a></main>
  if (!data) return <p className="pad">Loading the world…</p>
  return (
    <div className={touch ? 'world touch' : 'world'}>
      <div ref={el} className="canvas" />
      <Hud name={data.village.name} zone={zone} pill={PILL[status]} settingsExtra={<Privacy slug={slug} me={data.me} libraryAutoFocus={data.village.libraryAutoFocus} />}>
        <div className="hud-online" aria-label="Online now (debug)">Online: {online.map((m) => m.name).join(', ') || '—'}</div>
        <div className="toasts" aria-live="polite">{toasts.map((t) => <p key={t.id}>📌 {t.text}</p>)}</div>
        <div className="bar-actions">
          {more && touch && <>
            <button onClick={() => { setMembersOpen((o) => !o); setMore(false) }}><i aria-hidden>👥</i>Members</button>
            <button onClick={() => { openLog(); setMore(false) }}><i aria-hidden>🗒</i>Chat log</button>
          </>}
          <button onClick={() => { setNotice(''); setTalk({ text: '' }) }}><i aria-hidden>💬</i>Talk<kbd>T</kbd></button>
          <button onClick={() => bridgeRef.current?.interact()}><i aria-hidden>🪑</i>Sit<kbd>X</kbd></button>
          <button onClick={() => bridgeRef.current?.toggleFocus()} aria-pressed={presence === 'focusing'}><i aria-hidden>📖</i>{timer ? 'Timer' : presence === 'focusing' ? 'Focusing' : presence === 'away' ? 'Away' : 'Focus'}<kbd>F</kbd></button>
          <button onClick={() => setBoardOpen((o) => !o)}><i aria-hidden>📌</i>Board<kbd>B</kbd></button>
          {touch ? <button onClick={() => setMore((m) => !m)} aria-expanded={more} aria-label="More"><i aria-hidden>⋯</i>More</button> : <>
            <button onClick={() => setMembersOpen((o) => !o)}>Members<kbd>Tab</kbd></button>
            <button onClick={openLog}>Chat log</button>
          </>}
        </div>
        {timer && <TimerHud timer={timer} now={now} ask={ask} onStop={() => setAsk(true)} onPause={pauseTimer} onAnswer={endTimer} onKeep={() => setAsk(false)} />}
        {pick && <TaskPicker slug={slug} onPick={startTimer} onClose={() => setPick(false)} />}
        {boardOpen && <Board items={boardItems} members={data.members} onClose={() => setBoardOpen(false)} />}
        {talk && <BubbleBox names={names} me={data.members.find((m) => m.userId === data.me.userId)?.name ?? ''} initial={talk.text} shake={shake} notice={notice} onSend={say} onClose={() => { setTalk(null); setNotice('') }} />}
        {membersOpen && bridgeRef.current && <Members members={data.members} me={data.me.userId} roster={() => bridgeRef.current!.roster()} onLocate={(id) => bridgeRef.current?.locate(id)} onClose={() => setMembersOpen(false)} />}
        {logOpen && <ChatLog items={log} onClose={() => setLogOpen(false)} />}
      </Hud>
    </div>
  )
}
