import { useState } from 'react'
import { lanes } from './layout.js'
import { dropMinutes } from './events.js'

const H0 = 6, H1 = 23, PX = 44 // visible hours and pixels per hour
const DRAG = 'application/x-desker-item'
const hourLabel = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })

// One thing on the grid. Things to do get a ring to tick; meetings are one solid button. Anything with a `drag` id can be moved.
function Item({ x, className, style }) {
  const drag = x.drag ? { draggable: true, onDragStart: (e) => { e.dataTransfer.setData(DRAG, x.drag); e.dataTransfer.effectAllowed = 'move' } } : {}
  const text = 'chip min-w-0 flex-1 truncate text-left text-xs leading-tight'
  const tall = x.e - x.s >= 60 // short marks centre their tap targets, which are taller than the mark; tall blocks start at the top
  if (x.ring) return (
    <div {...drag} style={style} title={x.title} className={`flex ${tall ? 'items-start' : 'items-center'} rounded border ${x.future ? 'border-dashed' : ''} ${x.cls} ${className} ${x.drag ? 'cursor-grab' : ''}`}>
      <button type="button" className="chip flex h-11 w-9 shrink-0 items-center justify-center md:h-6 md:w-6" disabled={!x.onTick} aria-label={x.onTick ? `Mark ${x.label} done` : x.future ? `${x.label} repeats, and this one is still to come` : `${x.label} is finished`} onClick={x.onTick}>
        <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${x.ring} text-[0.625rem] leading-none ${x.future ? 'border-dashed' : x.onTick ? '' : 'bg-accent text-white'}`} aria-hidden="true">{x.onTick || x.future ? '' : '✓'}</span>
      </button>
      <button type="button" className={`${text} min-h-11 pr-1 md:min-h-6 ${x.future ? 'text-slate-600' : x.onTick ? '' : 'text-slate-500 line-through'}`} aria-label={`Open ${x.label}`} onClick={x.onClick}>{x.label}</button>
    </div>
  )
  return <button {...drag} type="button" title={x.title || x.label} onClick={x.onClick} disabled={!x.onClick} style={style} className={`chip overflow-hidden rounded border px-1 text-left text-xs leading-tight ${x.cls} ${className} ${x.drag ? 'cursor-grab' : ''}`}>{x.label}</button>
}

// Day and week view. Tapping an hour calls onSlot(day, hour), and a drop calls onDrop(id, day, minute), with minute null for the all-day row.
// cols: [{ key, head, today, allDay: [item], blocks: [item with s, e] }]; s/e are minutes since midnight.
export default function TimeGrid({ cols, onHead, onSlot, onDrop }) {
  const [over, setOver] = useState(null) // where a drag would land: { key, minute }
  const n = cols.length
  const grid = { gridTemplateColumns: `2.75rem repeat(${n}, minmax(0, 1fr))` }
  const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i)
  const canDrop = (e) => e.dataTransfer.types.includes(DRAG)
  const minuteAt = (e) => dropMinutes(e.clientY - e.currentTarget.getBoundingClientRect().top, PX, H0, H1)
  const land = (e, key, minute) => { e.preventDefault(); setOver(null); onDrop?.(e.dataTransfer.getData(DRAG), key, minute) }
  return (
    <div className="overflow-x-auto rounded-2xl bg-white border border-line">
      <div style={{ minWidth: n > 1 ? '40rem' : undefined }}>
        <div className="grid border-b border-line" style={grid}>
          <span />
          {cols.map((c) => (
            <button key={c.key} className={`chip py-1 text-center text-sm ${c.today ? 'font-semibold text-accent' : 'text-slate-700'}`} onClick={() => onHead?.(c.key)}>{c.head}</button>
          ))}
        </div>
        <div className="grid border-b border-line" style={grid}>
          <span className="py-1 pr-1 text-right text-[0.625rem] text-slate-500">All day</span>
          {cols.map((c) => (
            <div key={c.key} aria-label={`All day, ${c.head}`} className={`min-h-7 space-y-0.5 border-l border-line p-0.5 ${over?.key === c.key && over.minute === null ? 'bg-pale' : ''}`}
              onDragOver={(e) => { if (canDrop(e)) { e.preventDefault(); setOver({ key: c.key, minute: null }) } }} onDragLeave={() => setOver(null)} onDrop={(e) => land(e, c.key, null)}>
              {c.allDay.map((x) => <Item key={x.id} x={x} className="w-full" />)}
            </div>
          ))}
        </div>
        <div className="grid" style={grid}>
          <div className="relative" style={{ height: (H1 - H0) * PX }}>
            {hours.map((h) => <span key={h} className="absolute right-1 -translate-y-1/2 text-[0.625rem] text-slate-500" style={{ top: (h - H0) * PX }}>{h > H0 ? hourLabel(h) : ''}</span>)}
          </div>
          {cols.map((c) => (
            <div key={c.key} data-day={c.key} className={`hour-lines relative border-l border-line ${c.today ? 'bg-accent/5' : ''}`}
              style={{ height: (H1 - H0) * PX, '--px': `${PX}px` }}
              onDragOver={(e) => { if (canDrop(e)) { e.preventDefault(); setOver({ key: c.key, minute: minuteAt(e) }) } }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null) }} onDrop={(e) => land(e, c.key, minuteAt(e))}>
              {hours.map((h) => <button key={h} type="button" className="chip absolute inset-x-0 hover:bg-pale/60" style={{ top: (h - H0) * PX, height: PX }} aria-label={`Add a meeting or reminder, ${c.head}, ${hourLabel(h)}`} onClick={() => onSlot?.(c.key, h)} />)}
              {lanes(c.blocks).filter((b) => b.e > H0 * 60 && b.s < H1 * 60).map((b) => {
                const s = Math.max(b.s, H0 * 60), e = Math.min(b.e, H1 * 60)
                return <Item key={b.id} x={b} className="absolute z-10" style={{ top: ((s - H0 * 60) / 60) * PX, height: Math.max(22, ((e - s) / 60) * PX - 1), width: `calc(${100 / b.lanes}% - 2px)`, left: `${(b.lane * 100) / b.lanes}%` }} />
              })}
              {over?.key === c.key && over.minute !== null && <div className="pointer-events-none absolute inset-x-0 z-20 rounded bg-accent/25" style={{ top: ((over.minute - H0 * 60) / 60) * PX, height: PX / 2 }} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
