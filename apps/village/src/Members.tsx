// The member list (Tab): online first, then offline with "last seen". Clicking a name pans the camera to them for 2 s (locate only).
import { useEffect, useState } from 'react'
import { OUTFIT_TINTS, type Colour, type ZoneId } from '@desker/shared'
import type { RosterItem } from './game/bridge.ts'
import type { Info } from './api.ts'
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

export default function Members({ members, me, roster, onLocate, onClose }: { members: Info['members']; me: string; roster: () => RosterItem[]; onLocate: (id: string) => void; onClose: () => void }) {
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
        <button disabled={!r || m.userId === me} onClick={() => onLocate(m.userId)} title={r && m.userId !== me ? 'Find them' : ''}>{m.name}{m.userId === me ? ' (you)' : ''}</button>
        <span className="pres" title={r?.presence ?? 'offline'}>{r ? ICON[r.presence] : ''}</span>
        <span className="where">{r ? (r.atDesk ? 'at their desk' : ZONE[r.zone]) : `last seen ${ago(m.lastSeenAt)}`}</span>
        {r && doing(r) && <span className="what">{doing(r)}</span>}
      </li>
    )
  }
  return (
    <div className="members" role="dialog" aria-label="Members">
      <h2>Members <small>{online.length} here</small> <button className="x" onClick={onClose} aria-label="Close">×</button></h2>
      <ul>{online.map(row)}{offline.length > 0 && <li className="sep">Offline</li>}{offline.map(row)}</ul>
    </div>
  )
}
