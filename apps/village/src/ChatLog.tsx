// The last 24 hours of bubbles I was able to see, grouped by zone, with time and name.
import type { ServerMsg, ZoneId } from '@desker/shared'

type Item = Extract<ServerMsg, { t: 'log' }>['items'][number]
const ZONE: Record<ZoneId, string> = { plaza: 'Board Plaza', library: 'Library', tables: 'Group Tables', lounge: 'Lounge', garden: 'Garden' }
const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function ChatLog({ items, canRemove, onRemove, onClose }: { items: Item[] | null; canRemove?: boolean; onRemove?: (r: Item) => void; onClose: () => void }) {
  const byZone = new Map<ZoneId, Item[]>()
  for (const i of items ?? []) byZone.set(i.zoneId, [...(byZone.get(i.zoneId) ?? []), i])
  const groups = [...byZone]
  return (
    <div className="hud-modal" role="dialog" aria-label="Chat log" onClick={onClose}>
      <div className="hud-panel chatlog" onClick={(e) => e.stopPropagation()}>
        <h2>Chat log <small>last 24 hours</small></h2>
        {!items ? <p>Loading…</p> : !items.length ? <p>Nothing yet. Bubbles you can see will show up here.</p> : groups.map(([zone, rows]) => (
          <section key={zone}><h3>{ZONE[zone]}</h3>{rows.map((r, i) => <p key={i}><time>{time(r.at)}</time> <b>{r.name}</b> {r.text}{canRemove && <> <button type="button" onClick={() => onRemove?.(r)}>Remove</button></>}</p>)}</section>
        ))}
        <p><button onClick={onClose}>Close (Esc)</button></p>
      </div>
    </div>
  )
}
