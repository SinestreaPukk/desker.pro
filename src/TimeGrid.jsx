import { lanes } from './layout.js'

const H0 = 6, H1 = 23, PX = 44 // visible hours and pixels per hour
const hourLabel = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })

// Week/day view. cols: [{ key, head, today, allDay: [{id,label,cls,title,onClick}], blocks: [{id,label,s,e,cls,title,onClick}] }]; s/e are minutes since midnight.
export default function TimeGrid({ cols, onHead }) {
  const n = cols.length
  const grid = { gridTemplateColumns: `2.75rem repeat(${n}, minmax(0, 1fr))` }
  const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i)
  const chip = (x) => (
    <button key={x.id} title={x.title || x.label} onClick={x.onClick} disabled={!x.onClick}
      className={`chip block w-full truncate rounded px-1 text-left text-xs ring-1 ring-black/10 ${x.cls}`}>{x.label}</button>
  )
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5">
      <div style={{ minWidth: n > 1 ? '40rem' : undefined }}>
        <div className="grid border-b border-black/5" style={grid}>
          <span />
          {cols.map((c) => (
            <button key={c.key} className={`chip py-1 text-center text-sm ${c.today ? 'font-semibold text-[#007aff]' : 'text-slate-700'}`} onClick={() => onHead?.(c.key)}>{c.head}</button>
          ))}
        </div>
        <div className="grid border-b border-black/5" style={grid}>
          <span className="py-1 pr-1 text-right text-[0.625rem] text-slate-500">Anytime</span>
          {cols.map((c) => <div key={c.key} className="min-h-7 space-y-0.5 border-l border-black/5 p-0.5">{c.allDay.map(chip)}</div>)}
        </div>
        <div className="grid" style={grid}>
          <div className="relative" style={{ height: (H1 - H0) * PX }}>
            {hours.map((h) => <span key={h} className="absolute right-1 -translate-y-1/2 text-[0.625rem] text-slate-500" style={{ top: (h - H0) * PX }}>{h > H0 ? hourLabel(h) : ''}</span>)}
          </div>
          {cols.map((c) => (
            <div key={c.key} className={`relative border-l border-black/5 ${c.today ? 'bg-[#007aff]/5' : ''}`}
              style={{ height: (H1 - H0) * PX, backgroundImage: `repeating-linear-gradient(to bottom, rgba(0,0,0,0.06) 0 1px, transparent 1px ${PX}px)` }}>
              {lanes(c.blocks).filter((b) => b.e > H0 * 60 && b.s < H1 * 60).map((b) => {
                const s = Math.max(b.s, H0 * 60), e = Math.min(b.e, H1 * 60)
                return (
                  <button key={b.id} title={b.title || b.label} onClick={b.onClick} disabled={!b.onClick}
                    className={`chip absolute overflow-hidden rounded px-1 text-left text-xs leading-tight ring-1 ring-black/10 ${b.cls}`}
                    style={{ top: ((s - H0 * 60) / 60) * PX, height: Math.max(18, ((e - s) / 60) * PX - 1), width: `calc(${100 / b.lanes}% - 2px)`, left: `${(b.lane * 100) / b.lanes}%` }}>
                    {b.label}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
