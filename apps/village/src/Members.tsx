// The member list (Tab): online first, then offline with "last seen". Clicking a name pans the camera to them for 2 s (locate only).
import { useEffect, useState } from 'react'
import type { ServerMsg } from '@desker/shared'
import { OUTFIT_TINTS, type Colour, type ZoneId } from '@desker/shared'
import type { RosterItem } from './game/bridge.ts'
import { blockUser, fileReport, unblockUser, type Info } from './api.ts'
import { plain } from './Focus.tsx'

const ZONE: Record<ZoneId, string> = { plaza: 'in the Plaza', library: 'in the Library', tables: 'at the Group Tables', lounge: 'in the Lounge', garden: 'in the Garden' }
const ICON = { available: '●', focusing: '📖', dnd: '⛔', away: '💤' }
const hex = (c: string) => '#' + (OUTFIT_TINTS[c as Colour] ?? 0xf2f5fa).toString(16).padStart(6, '0')
const doing = (r: RosterItem) => { // what they are studying, as far as their sharing choice lets friends see
  const s = r.status; if (!s) return ''
  const left = r.endsAt ? ` · ${Math.max(0, Math.ceil((r.endsAt - Date.now()) / 60000))} min left` : ''
  return (s.taskTitle ? `${s.courseCode ? s.courseCode + ' · ' : ''}${plain(s.taskTitle, s.courseCode)}` : 'Studying') + left
}
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 2 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago` }

export type Act = 'locate' | 'walk' | 'follow' | 'wave' | 'knock'
type LogItem = Extract<ServerMsg, { t: 'log' }>['items'][number]
export default function Members({ slug, members, me, roster, blocked, onBlocked, log, needLog, onLocate, onAct, open, onClose }: { slug: string; blocked: Set<string>; onBlocked: (id: string, on: boolean) => void; log: LogItem[] | null; needLog: () => void; members: Info['members']; me: string; roster: () => RosterItem[]; onLocate: (id: string) => void; onAct: (a: Act, id: string) => void; open?: string | null; onClose: () => void }) {
  const [acts, setActs] = useState<string | null>(open ?? null), [rep, setRep] = useState<{ id: string; reason: string; note: string } | null>(null), [msg, setMsg] = useState('')
  useEffect(() => { if (open) setActs(open) }, [open])
  const [now, setNow] = useState<RosterItem[]>(roster)
  useEffect(() => { const t = setInterval(() => setNow(roster()), 1000); return () => clearInterval(t) }, [roster])
  const here = new Map(now.map((r) => [r.userId, r]))
  const online = members.filter((m) => here.has(m.userId)).sort((a, b) => a.name.localeCompare(b.name))
  const offline = members.filter((m) => !here.has(m.userId)).sort((a, b) => +new Date(b.lastSeenAt) - +new Date(a.lastSeenAt))
  const row = (m: Info['members'][number]) => {
    const r = here.get(m.userId)
    return (
      <li key={m.userId} className={r ? '' : 'off'}>
        <i style={{ background: hex(m.colour) }} aria-hidden />
        <button disabled={!r || m.userId === me} onClick={() => setActs(acts === m.userId ? null : m.userId)} title={r && m.userId !== me ? 'Do something: find, walk to, follow, wave, knock' : ''}>{m.name}{m.userId === me ? ' (you)' : ''}</button>
        <span className="pres" title={r?.presence ?? 'offline'}>{r ? ICON[r.presence] : ''}</span>
        <span className="where">{r ? (r.atDesk ? 'at their desk' : ZONE[r.zone]) : `last seen ${ago(m.lastSeenAt)}`}</span>
        {r && doing(r) && <span className="what">{doing(r)}</span>}
        {r && acts === m.userId && m.userId !== me && <span className="acts">
          <button onClick={() => onLocate(m.userId)}>Locate</button><button onClick={() => onAct('walk', m.userId)}>Walk to</button><button onClick={() => onAct('follow', m.userId)}>Follow</button>
          <button onClick={() => onAct('wave', m.userId)}>Wave</button><button onClick={() => onAct('knock', m.userId)}>Knock</button></span>}
        {acts === m.userId && m.userId !== me && <span className="acts">
          {blocked.has(m.userId) ? <button onClick={() => unblockUser(slug, m.userId).then(() => onBlocked(m.userId, false), () => setMsg("Couldn't do that."))}>Unblock</button> : <button onClick={() => blockUser(slug, m.userId).then(() => { onBlocked(m.userId, true); setMsg('Blocked. They are not told.') }, (e) => setMsg(e.code === 'too_many_blocks' ? 'You can block up to 20 people.' : "Couldn't do that."))}>Block</button>}
          <button onClick={() => { needLog(); setRep({ id: m.userId, reason: 'harassment', note: '' }) }}>Report…</button></span>}
        {rep?.id === m.userId && <span className="acts">
          <select aria-label="Reason" value={rep.reason} onChange={(e) => setRep({ ...rep, reason: e.target.value })}><option value="harassment">Harassment</option><option value="spam">Spam</option><option value="inappropriate">Inappropriate</option><option value="other">Other</option></select>
          <input aria-label="What happened (optional)" placeholder="What happened? (optional)" maxLength={300} value={rep.note} onChange={(e) => setRep({ ...rep, note: e.target.value })} onKeyDown={(e) => e.nativeEvent.stopPropagation()} />
          <button onClick={() => fileReport(slug, { targetUserId: m.userId, reason: rep.reason, note: rep.note, kind: 'person', context: (log ?? []).filter((l) => l.userId === m.userId).slice(-10).map((l) => ({ name: l.name, text: l.text, at: l.at, zone: l.zoneId })) }).then(() => { setRep(null); setMsg('Reported. Village admins will see it.') }, () => setMsg("Couldn't send the report."))}>Send report</button></span>}
      </li>
    )
  }
  return (
    <div className="members" role="dialog" aria-label="Members">
      <h2>Members <small>{online.length} here</small> <button className="x" onClick={onClose} aria-label="Close">×</button></h2>
      {msg && <p role="status">{msg}</p>}
      <ul>{online.map(row)}{offline.length > 0 && <li className="sep">Offline</li>}{offline.map(row)}</ul>
    </div>
  )
}
