import { btn, rowCard } from '../ui.js'

// One suggestion: a tick to finish without starting, its title and short label, and Start. Tapping it opens its side sheet.
export default function Row({ row, n, onDone, onStart, onOpen, onDragStart }) {
  const { task: t, short } = row
  return (
    <li className={`${rowCard} flex items-center gap-1 pr-1`} draggable={!!onDragStart} onDragStart={onDragStart}>
      <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
        <input type="checkbox" className="tick" checked={false} onChange={() => onDone(t)} aria-label={`Mark ${t.title} done`} />
      </label>
      {n !== undefined && <span className="w-5 shrink-0 text-center text-sm tabular-nums text-slate-500" aria-hidden="true">{n}</span>}
      <button className="flex min-h-11 min-w-0 flex-1 flex-wrap items-baseline gap-x-3 py-1 pl-1 text-left" onClick={() => onOpen(t)}>
        <span className="min-w-0 break-words">{t.title}</span>
        <span className="text-xs text-slate-600">{short}</span>
      </button>
      <button className={`${btn} shrink-0 text-accent hover:bg-pale`} onClick={() => onStart(t)} aria-label={`Start ${t.title}`}>Start</button>
    </li>
  )
}
