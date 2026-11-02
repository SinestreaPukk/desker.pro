import { useEffect, useRef, useState } from 'react'
import { actionOf, isTyping, urgency, type Presence, type Colour, type Member, type ServerMsg, type ZoneId } from '@desker/shared'
import BubbleBox from './BubbleBox.tsx'
import ChatLog from './ChatLog.tsx'
import { track, board as fetchBoard, questions as fetchQuestions, claimDesk, endGroup, finishGroup, focusEnd, focusStart, getGroup, info, joinGroup, leaveGroup, startGroup, type GroupState, type GroupSummary, type Announcement, type BoardItem, type Info } from './api.ts'
import Board from './Board.tsx'
import { AskBox } from './Questions.tsx'
import { NudgeCard, shouldAsk } from './Notifications.tsx'
import { GroupBar, GroupStart, GroupSummaryCard } from './Group.tsx'
import { TaskPicker, TimerHud, type Pick, type Timer } from './Focus.tsx'
import Privacy from './Privacy.tsx'
import Members, { type Act } from './Members.tsx'
import EmoteWheel from './EmoteWheel.tsx'
import Minimap from './Minimap.tsx'
import { zoneNote, phaseAt, minutesLeft } from '@desker/shared'
import { connect, type Status } from './net/connection.ts'
import Hud from './Hud.tsx'
import InvitePanel from './InvitePanel.tsx'
import Manage from './Manage.tsx'
import Install from './Install.tsx'
import { can } from '@desker/shared'
import { leaveVillage, closeVillage, blocks as fetchBlocks } from './api.ts'
import { Bridge } from './game/bridge.ts'
import { isTouchUi } from './game/touch.ts'

const PILL: Record<Status, string> = {
  connecting: 'Connecting…', online: '', reconnecting: 'Reconnecting…', failed: "Can't reach the village right now.",
  refresh: 'Kodama Village was updated. Please refresh the page.', elsewhere: 'Opened in another tab. Close that one or refresh here.', removed: 'You are no longer in this village.',
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
  const [pick, setPick] = useState(false), [ask, setAsk] = useState(false), [qOpen, setQOpen] = useState(false), [nudge, setNudge] = useState(false), [openQ, setOpenQ] = useState<string | null>(null), [qRev, setQRev] = useState(0), [now, setNow] = useState(Date.now())
  const timerRef = useRef<Timer | null>(timer), chimed = useRef(false)
  const setTimer = (t: Timer | null) => { timerRef.current = t; setTimerState(t); if (t) localStorage.setItem(timerKey, JSON.stringify(t)); else localStorage.removeItem(timerKey) }
  const [boardOpen, setBoardOpen] = useState(false), [boardItems, setBoardItems] = useState<BoardItem[] | null>(null), [news, setNews] = useState<Announcement[]>([])
  const redPin = useRef(false), qPin = useRef(false)
  // Study together: the session record, my clock offset to the server's, who I am in it, and the little prompts
  const [group, setGroup] = useState<GroupState | null>(null), [offset, setOffset] = useState(0), [gnow, setGnow] = useState(Date.now()), [summary, setSummary] = useState<GroupSummary | null>(null)
  const [gStart, setGStart] = useState(false), [gErr, setGErr] = useState(''), [gPick, setGPick] = useState(false), [deskPrompt, setDeskPrompt] = useState(false)
  const gTask = useRef<Pick | null>(null), seenGroup = useRef<string | null>(null)
  const joined = !!group?.participants.some((x) => x.userId === data?.me.userId)
  const srvNow = () => Date.now() + offset
  const loadGroup = () => getGroup(slug).then((r) => {
    setOffset(r.serverNow - Date.now()); setGroup(r.group)
    if (r.group && seenGroup.current !== r.group.id) { blip(660, 990); seenGroup.current = r.group.id } // a soft bell for a session that is new to this screen
    if (r.summary && !localStorage.getItem(`village.group.seen.${r.summary.id}`)) setSummary(r.summary)
  }, () => {})
  const loadGroupRef = useRef<() => void>(() => {})
  loadGroupRef.current = loadGroup
  const zoneAt = useRef<Partial<Record<ZoneId, number>>>({}), noteTimer = useRef<ReturnType<typeof setTimeout>>()
  const touch = isTouchUi(), [more, setMore] = useState(false), [panel, setPanel] = useState<'invite' | 'manage' | 'leave' | 'close' | null>(null)
  const [wheel, setWheel] = useState(false), [mapOn, setMapOn] = useState(() => !isTouchUi()), [note, setNote] = useState(''), [knock, setKnock] = useState<{ from: string; name: string } | null>(null), [awayCard, setAwayCard] = useState<Extract<ServerMsg, { t: 'away' }>['items'] | null>(null), [following, setFollowing] = useState<string | null>(null), [actFor, setActFor] = useState<string | null>(null)
  const time = useRef({ since: Date.now() as number | null, focusMin: 0 }) // minutes present and focused, reported when the tab hides or closes
  const bridgeRef = useRef<Bridge | null>(null), [blocked, setBlockedSet] = useState<Set<string>>(new Set())
  const setBlocked = (id: string, on: boolean) => setBlockedSet((b) => { const n = new Set(b); on ? n.add(id) : n.delete(id); if (bridgeRef.current) bridgeRef.current.blocked = n; return n })
  const send = useRef<(m: object) => void>(() => {}), lastText = useRef('')
  const pins = () => bridgeRef.current?.boardPin(redPin.current, qPin.current)
  const loadBoardRef = useRef<() => void>(() => {})
  const loadBoard = () => fetchBoard(slug).then((r) => { setBoardItems(r.items); setNews(r.announcements); redPin.current = r.items.some((i) => urgency(i.dueAt, Date.now()) === 'red' && i.dueAt > Date.now()); pins() }, () => {})
  loadBoardRef.current = loadBoard
  const loadQPin = () => fetchQuestions(slug).then((r) => { qPin.current = r.questions.some((q) => !q.resolved && q.answers === 0); pins() }, () => {}) // a "?" on the Board in the world while a question waits for its first answer
  useEffect(() => { if (data) loadQPin() }, [data, qRev])
  useEffect(() => { if (data) loadGroup() }, [data])
  useEffect(() => { if (!group) return; const t = setInterval(() => setGnow(Date.now()), 1000); return () => clearInterval(t) }, [group?.id])
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
  useEffect(() => { const on = (e: KeyboardEvent) => e.key === 'Escape' && setPanel(null); window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on) }, [])
  useEffect(() => { // a tapped notification lands here with ?q=<question id> (the thread) or ?board=1 (the Board)
    const q = new URLSearchParams(location.search)
    if (!data || !(q.has('q') || q.has('board'))) return
    if (q.get('q')) setOpenQ(q.get('q')); setBoardOpen(true); history.replaceState(null, '', location.pathname)
  }, [data])
  useEffect(() => { // just created: say hello once (the Kodama's line, as a toast until the NPC sprite exists)
    const q = new URLSearchParams(location.search)
    if (!data || !(q.has('new') || q.has('first'))) return
    history.replaceState(null, '', location.pathname)
    toast(q.has('new') ? 'Welcome to your village! Invite friends from the ⋯ menu.' : 'This is the Board. Your desk is waiting in the Library.')
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
      else if (m.t === 'qupdate' && m.qid === 'group') loadGroupRef.current() // the group changed: someone started, joined, left or it ended
      else if (m.t === 'qupdate' && m.qid === 'board') { loadBoardRef.current(); bridgeRef.current?.boardPulse() } // the API sends qid 'board' when something changes on the Board
      else if (m.t === 'qupdate' || m.t === 'asked') setQRev((n) => n + 1)
      else if (m.t === 'answered') { setQRev((n) => n + 1); toast(`${m.name} answered your question`); blip() }
      else if (m.t === 'knocked') { setKnock({ from: m.fromUserId, name: m.name }); blip(240, 180) }
      else if (m.t === 'away') setAwayCard(m.items)
      else if (m.t === 'error' && m.code.startsWith('knock_')) toast(m.message)
      else if (m.t === 'error' && (m.code === 'slow_mode' || m.code === 'muted' || m.code === 'removed')) { setNotice(m.message); setTalk({ text: lastText.current }); setTimeout(() => setNotice(''), 3500) }
      else if (m.t === 'error' && m.code === 'slow_down') { setNotice('Slow down a little'); setShake((n) => n + 1); setTalk({ text: lastText.current }); setTimeout(() => setNotice(''), 2500) } // the box comes back with what you wrote
    }
    const bridge = new Bridge(); bridgeRef.current = bridge
    fetchBlocks(slug).then((r) => { const n = new Set(r.blocks.map((x) => x.userId)); bridge.blocked = n; setBlockedSet(n) }, () => {})
    const net = connect(data.village.id, { message: (m) => { onMsg(m); bridge.fromServer(m) }, status: setStatus })
    bridge.out = net.send; send.current = net.send
    // Even pixel size only: an odd-sized canvas puts tile edges on half pixels at zoom 3 and draws faint seams. (Registered before Phaser's own resize listener.)
    const box = el.current, fit = () => { box.style.width = `${innerWidth & ~1}px`; box.style.height = `${innerHeight & ~1}px` }
    fit(); window.addEventListener('resize', fit)
    let game: { destroy: (b: boolean) => void } | undefined, gone = false
    const name = data.members.find((m) => m.userId === data.me.userId)?.name ?? 'You'
    // the name tags use the pixel font, so it must be loaded before the first tag is drawn
    Promise.all([import('./game/start.ts'), document.fonts.load('7px VT323')]).then(([{ startGame }]) => { if (!gone) game = startGame(box, {
      userId: data.me.userId, name, colour: data.me.colour as Colour, bridge, onZone: (z) => { setZone(z); const t = zoneNote(zoneAt.current, z, Date.now()); if (t) { setNote(t); clearTimeout(noteTimer.current); noteTimer.current = setTimeout(() => setNote(''), 2500) } }, onPresence: setPresence, libraryAutoFocus: data.village.libraryAutoFocus,
      desks: data.members.flatMap((m) => (m.deskSpotId ? [{ userId: m.userId, spotId: m.deskSpotId }] : [])), names: Object.fromEntries(data.members.map((m) => [m.userId, m.name])),
      claimDesk: (spotId) => claimDesk(slug, spotId).then(() => true, () => false),
      openBoard: () => setBoardOpen(true),
      onEmoteKey: () => setWheel(true), onFollow: setFollowing, onNote: (t) => toast(t), onAvatar: (id) => { setActFor(id); setMembersOpen(true) },
      focusKey: (atDesk) => { if (timerRef.current) { setAsk(true); return true } if (atDesk) { setPick(true); return true } return false },
    }) })
    return () => { gone = true; window.removeEventListener('resize', fit); net.close(); game?.destroy(true) }
  }, [data])
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setQOpen(false); setLogOpen(false); setMembersOpen(false); setPick(false); setBoardOpen(false); return }
      if ((e.key === 'm' || e.key === 'M') && !isTyping() && !e.ctrlKey && !e.metaKey && !e.altKey) { setMapOn((o) => !o); return } // M = minimap
      if (e.key === 'Tab' && !isTyping()) { e.preventDefault(); setMembersOpen((o) => !o); return } // Tab = members (SPEC §5.1)
      if (actionOf(e.key, isTyping(), 1) === 'join' && !e.ctrlKey && !e.metaKey && !e.altKey) { document.dispatchEvent(new CustomEvent('village:join')); return }
      if (actionOf(e.key, isTyping(), 1) === 'ask' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setQOpen(true); return } // Q = ask the village
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
  const act = (a: Act, id: string) => {
    const b = bridgeRef.current; if (!b) return
    if (a === 'walk') b.follow(id, true); else if (a === 'follow') b.follow(id, false)
    else if (a === 'wave') send.current({ t: 'emote', id: 1, to: id })
    else if (a === 'knock') send.current({ t: 'knock', userId: id })
    if (a === 'walk' || a === 'follow') setMembersOpen(false)
  }
  const toast = (text: string) => { const id = Math.random(); setToasts((t) => [...t, { id, text }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000) }
  const askLater = () => { shouldAsk().then((ok) => ok && setNudge(true)) } // a good moment: right after a first question or a finished focus
  const endTimer = (done: boolean) => {
    const t = timerRef.current; if (!t) return
    send.current({ t: 'focus.stop' }); bridgeRef.current?.timer(false); setTimer(null); setAsk(false)
    const activeMin = Math.max(0, Math.round((Math.min(t.pausedAt ?? Date.now(), t.endsAt) - t.startedAt - (t.pausedMs ?? 0)) / 60000)) // paused time is not focus time
    time.current.focusMin += activeMin
    focusEnd(slug, { sessionId: t.sessionId, activeMin, plannedMin: t.plannedMin, pauses: t.pauses ?? 0, done, taskId: t.taskId }).then(
      (r) => { askLater(); toast(r.again ? 'Already saved.' : r.reason && r.reason !== 'no_outcome' ? `Logged ${activeMin} min in Desker. Too short or long to teach it your pace.` : `Logged ${activeMin} min in Desker${done && t.taskId ? '. Task done!' : '.'}`) },
      () => toast("Couldn't save that session to Desker."))
  }
  useEffect(() => { // count down, chime once at zero and ask the one question
    if (!timer) return
    const tick = () => { setNow(Date.now()); if (!timer.pausedAt && Date.now() >= timer.endsAt && !chimed.current && !timer.groupId) { chimed.current = true; blip(523, 784); setAsk(true) } }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [timer])
  useEffect(() => { const on = () => { if (group && !joined) setGPick(true) }; document.addEventListener('village:join', on); return () => document.removeEventListener('village:join', on) }, [group, joined])
  // ---- Study together: every client derives the same phase from the session record; my timer follows it ----
  const gp = group ? phaseAt(group, gnow + offset) : null
  const starting = useRef(false), prevPhase = useRef('')
  const startGroupTimer = async (g: GroupState, p: NonNullable<typeof gp>) => {
    if (starting.current) return
    starting.current = true
    const task = gTask.current ?? (() => { try { return JSON.parse(localStorage.getItem(`village.group.task.${g.id}`) ?? 'null') as Pick | null } catch { return null } })() ?? { title: 'Studying together', activity: 'reading' as const, minutes: 25 }
    try {
      const mins = minutesLeft(p, srvNow()), r = await focusStart(slug, mins, g.id), at = Date.now()
      const t: Timer = { sessionId: r.sessionId, startedAt: at, endsAt: p.endsAt - offset, plannedMin: mins, pausedMs: 0, pauses: 0, taskId: task.taskId, title: task.title, courseCode: task.courseCode, activity: task.activity, groupId: g.id, round: p.round }
      chimed.current = false; setTimer(t); setNow(at); announce(t)
    } catch { toast("Couldn't start your timer for this round.") }
    starting.current = false
  }
  useEffect(() => {
    const t = timerRef.current
    if (!group || !gp) { bridgeRef.current?.groupBreak(false); prevPhase.current = ''; if (t?.groupId) endTimer(false); return }
    if (gp.kind === 'done') finishGroup(slug).catch(() => {}) // time is up: the first client to say so ends it and the summary card follows
    if (t?.groupId && (!joined || gp.kind !== 'focus' || t.groupId !== group.id || t.round !== gp.round)) endTimer(false) // a break (or leaving) ends this round's Desker sitting
    if (joined && gp.kind === 'focus' && !timerRef.current) startGroupTimer(group, gp)
    const was = prevPhase.current.startsWith(group.id) ? prevPhase.current.split(':')[1] : '', now = `${group.id}:${gp.kind}`
    if (was && was !== gp.kind && joined) {
      if (gp.kind === 'break') { blip(784, 523); toast(`Break · ${group.breakMin} min · the Lounge is open`) }
      else if (gp.kind === 'focus') { blip(523, 784); if (data?.me.deskSpotId) setDeskPrompt(true) }
    }
    bridgeRef.current?.groupBreak(gp.kind === 'break' && joined)
    prevPhase.current = now
  }, [group?.id, gp?.kind, gp?.round, joined])
  const doJoin = (p: Pick) => {
    setGPick(false); gTask.current = p
    if (group) localStorage.setItem(`village.group.task.${group.id}`, JSON.stringify(p))
    joinGroup(slug, { taskTitle: p.title, ...(p.courseCode && { courseCode: p.courseCode }) }).then(loadGroup, () => toast("Couldn't join. Try again."))
  }
  const doStart = (b: { focusMin: number; breakMin: number; rounds: number }) => startGroup(slug, b).then(() => { setGStart(false); setGErr(''); loadGroup().then(() => setGPick(true)) }, (e: { code?: string }) => { if (e.code === 'running') { setGErr('A study session is already running. Join it with J.'); loadGroup() } else setGErr("That didn't work. Try again.") })
  const openGroup = () => { setMore(false); if (!group) setGStart(true); else if (!joined) setGPick(true); else toast('You are in the study session.') }
  const names = [...new Set([...(data?.members ?? []), ...online].map((m) => m.name))]
  const say = (text: string) => { track(slug, 'bubble_sent', { zoneId: zone, length: [...text].length }); lastText.current = text; send.current({ t: 'say', text }); setTalk(null); setNotice('') }
  const openLog = () => { setLog(null); setLogOpen(true); send.current({ t: 'log' }) }
  if (err === 'not_member') return <main className="pad"><h1>You're not in this village</h1><p>You need an invite link from a member. Ask a friend to send you one.</p><a href="/">Back to your villages</a></main>
  if (err === 'closed') return <main className="pad"><h1>This village was closed</h1><p>The owner closed it.</p><a href="/">Back to your villages</a></main>
  if (err) return <main className="pad"><p role="alert">Couldn't open the village ({err}).</p><a href="/">Back</a></main>
  if (!data) return <p className="pad">Loading the world…</p>
  return (
    <div className={`${touch ? 'world touch' : 'world'}${mapOn ? ' mm' : ''}`}>
      <div ref={el} className="canvas" />
      <Hud name={data.village.name} zone={zone} pill={PILL[status]} settingsExtra={<Privacy slug={slug} onBlocked={setBlocked} me={data.me} libraryAutoFocus={data.village.libraryAutoFocus} />}>
        <div className="hud-online" aria-label="Online now (debug)">Online: {online.map((m) => m.name).join(', ') || '—'}</div>
        <div className="toasts" aria-live="polite">{toasts.map((t) => <p key={t.id}>📌 {t.text}</p>)}</div>
        <div className="bar-actions">
          {more && <>
            <button onClick={() => { setMapOn((o) => !o); setMore(false) }} aria-pressed={mapOn}><i aria-hidden>🗺</i>Map<kbd>M</kbd></button>
            <button onClick={openGroup}><i aria-hidden>📚</i>{group ? (joined ? 'In session' : 'Join session') : 'Study together'}<kbd>J</kbd></button>
            <button onClick={() => { setWheel(true); setMore(false) }}><i aria-hidden>😊</i>Emote<kbd>E</kbd></button>
            <button onClick={() => { bridgeRef.current?.toggleDnd(); setMore(false) }} aria-pressed={presence === 'dnd'}><i aria-hidden>🎧</i>{presence === 'dnd' ? 'DND on' : 'DND'}<kbd>G</kbd></button>
            {can(data.me.role, 'invite', data.village.whoCanInvite) && <button onClick={() => { setPanel('invite'); setMore(false) }}><i aria-hidden>✉</i>Invite</button>}
            {can(data.me.role, 'moderate') && <button onClick={() => { setPanel('manage'); setMore(false) }}><i aria-hidden>🛠</i>Manage</button>}
            {data.me.role !== 'owner' ? <button onClick={() => { setPanel('leave'); setMore(false) }}><i aria-hidden>🚪</i>Leave</button> : <button onClick={() => { setPanel('close'); setMore(false) }}><i aria-hidden>🗑</i>Close village</button>}
          </>}
          {more && touch && <>
            <button onClick={() => { setMembersOpen((o) => !o); setMore(false) }}><i aria-hidden>👥</i>Members</button>
            <button onClick={() => { openLog(); setMore(false) }}><i aria-hidden>🗒</i>Chat log</button>
          </>}
          <button onClick={() => { setNotice(''); setTalk({ text: '' }) }}><i aria-hidden>💬</i>Talk<kbd>T</kbd></button>
          <button onClick={() => bridgeRef.current?.interact()}><i aria-hidden>🪑</i>Sit<kbd>X</kbd></button>
          <button onClick={() => bridgeRef.current?.toggleFocus()} aria-pressed={presence === 'focusing'}><i aria-hidden>📖</i>{timer ? 'Timer' : presence === 'focusing' ? 'Focusing' : presence === 'away' ? 'Away' : 'Focus'}<kbd>F</kbd></button>
          <button onClick={() => setQOpen(true)}><i aria-hidden>❓</i>Ask<kbd>Q</kbd></button>
          <button onClick={() => setBoardOpen((o) => !o)}><i aria-hidden>📌</i>Board<kbd>B</kbd></button>
          {touch ? <button onClick={() => setMore((m) => !m)} aria-expanded={more} aria-label="More"><i aria-hidden>⋯</i>More</button> : <>
            <button onClick={() => setMembersOpen((o) => !o)}>Members<kbd>Tab</kbd></button>
            <button onClick={openLog}>Chat log</button>
            <button onClick={() => setMore((m) => !m)} aria-expanded={more} aria-label="More">⋯</button>
          </>}
        </div>
        {touch && <Install />}
        {timer && <TimerHud timer={timer} now={now} ask={ask} onStop={() => setAsk(true)} onPause={pauseTimer} onAnswer={endTimer} onKeep={() => setAsk(false)} />}
        {pick && <TaskPicker slug={slug} onPick={startTimer} onClose={() => setPick(false)} />}
        {boardOpen && <Board items={boardItems} news={news} members={data.members} slug={slug} me={data.me.userId} role={data.me.role} courseTags={data.village.courseTags} rev={qRev} openQ={openQ} onChanged={loadBoard} onClose={() => setBoardOpen(false)} />}
        {group && <GroupBar g={group} now={gnow + offset} joined={joined} canEnd={group.startedBy === data.me.userId || can(data.me.role, 'moderate')} onJoin={() => setGPick(true)} onLeave={() => leaveGroup(slug).then(loadGroup, () => toast("Couldn't leave. Try again."))} onEnd={() => endGroup(slug).then(loadGroup, () => toast("Couldn't end it. Try again."))} />}
        {gStart && <GroupStart onStart={doStart} onClose={() => { setGStart(false); setGErr('') }} error={gErr} />}
        {gPick && <TaskPicker slug={slug} group onPick={doJoin} onClose={() => setGPick(false)} />}
        {deskPrompt && data.me.deskSpotId && <div className="knock-card" role="alert"><span>Back to your desk?</span><span className="row"><button onClick={() => { bridgeRef.current?.walkToDesk(data.me.deskSpotId!); setDeskPrompt(false) }}>Walk to my desk</button><button onClick={() => setDeskPrompt(false)}>Not now</button></span></div>}
        {summary && !group && <GroupSummaryCard s={summary} me={data.me.userId} onClose={() => { localStorage.setItem(`village.group.seen.${summary.id}`, '1'); setSummary(null) }} />}
        {nudge && <NudgeCard onClose={() => setNudge(false)} />}
        {qOpen && <AskBox slug={slug} courses={data.village.courseTags} course={timerRef.current?.courseCode} onDone={() => { setQOpen(false); toast('Question sent. Find it on the Board.'); askLater() }} onClose={() => setQOpen(false)} />}
        {talk && <BubbleBox names={names} me={data.members.find((m) => m.userId === data.me.userId)?.name ?? ''} initial={talk.text} shake={shake} notice={notice} onSend={say} onClose={() => { setTalk(null); setNotice('') }} />}
        {membersOpen && bridgeRef.current && <Members slug={slug} blocked={blocked} onBlocked={setBlocked} log={log} needLog={() => send.current({ t: 'log' })} members={data.members} me={data.me.userId} roster={() => bridgeRef.current!.roster()} onLocate={(id) => bridgeRef.current?.locate(id)} open={actFor} onAct={act} onClose={() => { setMembersOpen(false); setActFor(null) }} />}
        {mapOn && !boardOpen && <Minimap positions={() => bridgeRef.current?.positions() ?? []} colours={Object.fromEntries([...data.members, ...online].map((m) => [m.userId, m.colour]))} me={data.me.userId} onGo={(x, y) => bridgeRef.current?.walkToTile(x, y)} />}
        {note && <div className="zone-note" role="status">{note}</div>}
        {wheel && <EmoteWheel onPick={(id) => { send.current({ t: 'emote', id }); setWheel(false) }} onClose={() => setWheel(false)} />}
        {knock && <div className="knock-card" role="alert"><span><b>{knock.name}</b> knocked: chat when you're free?</span><span className="row"><button onClick={() => { bridgeRef.current?.follow(knock.from, true); setKnock(null) }}>Walk over</button><button onClick={() => setKnock(null)}>Later</button></span></div>}
        {awayCard && <div className="away-card" role="dialog" aria-label="While you were away"><b>While you were away</b>{awayCard.length ? awayCard.map((q, i) => <span key={i}>{q.name ?? 'Someone'}: {q.text}</span>) : <span>Nothing missed.</span>}<span className="row"><button onClick={() => setAwayCard(null)}>OK</button></span></div>}
        {following && <div className="follow-pill" role="status">Following {following} · Esc to stop <button onClick={() => bridgeRef.current?.stopFollow()}>Stop</button></div>}
        {panel === 'invite' && <InvitePanel slug={slug} name={data.village.name} canGuest={can(data.me.role, 'moderate')} onClose={() => setPanel(null)} />}
        {panel === 'manage' && <Manage slow={!!data.village.slowMode} slug={slug} villageName={data.village.name} myRole={data.me.role} me={data.me.userId} onClose={() => setPanel(null)} />}
        {(panel === 'leave' || panel === 'close') && (
          <div className="hud-modal" role="dialog" aria-label={panel === 'leave' ? 'Leave village' : 'Close village'} onClick={() => setPanel(null)}>
            <div className="hud-panel" onClick={(e) => e.stopPropagation()}>
              <h2>{panel === 'leave' ? `Leave ${data.village.name}?` : `Close ${data.village.name}?`}</h2>
              <p>{panel === 'leave' ? 'You can come back with a new invite. Your desk is released.' : 'Everyone is sent out. You can undo this from your village list for 7 days.'}</p>
              <p><button onClick={() => (panel === 'leave' ? leaveVillage(slug) : closeVillage(slug)).then(() => location.assign('/'), () => toast('That did not work. Try again.'))}>{panel === 'leave' ? 'Leave' : 'Close village'}</button> <button onClick={() => setPanel(null)}>Cancel</button></p>
            </div>
          </div>
        )}
        {logOpen && <ChatLog items={log} canRemove={can(data.me.role, 'moderate')} onRemove={(r) => { send.current({ t: 'mod.remove', userId: r.userId, at: r.at }); setLog((l) => l && l.filter((x) => x !== r)); track(slug, 'mod_remove_bubble') }} onClose={() => setLogOpen(false)} />}
      </Hud>
    </div>
  )
}
