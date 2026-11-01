// The Board panel (SPEC §7, read-only in Phase 0): a side panel, a bottom sheet on phones. Items come from deadlines members chose to share.
import { OUTFIT_TINTS, urgency, type Colour } from '@desker/shared'
import type { BoardItem, Info } from './api.ts'
import Questions from './Questions.tsx'

const hex = (c: string) => '#' + (OUTFIT_TINTS[c as Colour] ?? 0xf2f5fa).toString(16).padStart(6, '0')
const when = (ms: number, now: number) => {
  const d = ms - now, h = Math.round(d / 3_600_000)
  if (d < 0) return 'just passed'
  if (h < 1) return 'in under an hour'
  if (h < 24) return `in ${h} h`
  const days = Math.round(d / 86_400_000); return days === 1 ? 'tomorrow' : `in ${days} days`
}
const day = (ms: number) => new Date(ms).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })

export default function Board({ items, members, slug, me, role, rev, onClose }: { items: BoardItem[] | null; members: Info['members']; slug: string; me: string; role: string; rev: number; onClose: () => void }) {
  const now = Date.now(), by = new Map(members.map((m) => [m.userId, m]))
  const col = (kind: 'due' | 'exam', title: string) => {
    const list = (items ?? []).filter((i) => i.kind === kind)
    return (
      <section>
        <h3>{title}</h3>
        {list.length === 0 && <p className="none">Nothing yet</p>}
        <ul>{list.map((i) => (
          <li key={i.key} className={`u-${urgency(i.dueAt, now)}`}>
            <span className="chip">{i.courseCode}</span> <b>{i.title}</b>
            <div className="meta">{day(i.dueAt)} · {when(i.dueAt, now)}</div>
            <div className="who">{i.userIds.map((u) => <i key={u} title={by.get(u)?.name} style={{ background: hex(by.get(u)?.colour ?? 'snow') }}>{[...(by.get(u)?.name ?? '?')][0]}</i>)}</div>
          </li>
        ))}</ul>
      </section>
    )
  }
  return (
    <aside className="board" role="dialog" aria-label="Board">
      <h2>Board <button className="x" onClick={onClose} aria-label="Close">×</button></h2>
      {items === null && <p>Reading the Board…</p>}
      {items && items.length === 0 && <p className="hint">Share your deadlines in Settings so the village can see what's coming.</p>}
      {items && <div className="cols">{col('due', 'Due this week')}{col('exam', 'Exams')}</div>}
      <Questions slug={slug} me={me} role={role} rev={rev} />
    </aside>
  )
}
