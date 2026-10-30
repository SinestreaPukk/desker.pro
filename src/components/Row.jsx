import { useState, useEffect } from 'react'
import { btn, input, rowCard, Q } from '../ui.js'
import { Cover } from '../art.jsx'
import { isMissed } from '../tasks.js'
import { fmtDuration } from '../format.js'
import { quadrant, REPEATS, Happy, fmtDate } from '../shared.jsx'

// One task: checkbox, title, one line of facts, a Start action and a menu for the rest.
export default function Row({ t, update, onEdit, onDelete, move, onStart, inBox, project }) {
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [sub, setSub] = useState('')
  const subs = t.subs || []
  const q = quadrant(t)
  const setSubs = (next) => update(t.id, { subs: next })
  useEffect(() => {
    if (!menu) return
    const off = () => setMenu(false)
    const id = setTimeout(() => document.addEventListener('click', off), 0)
    return () => { clearTimeout(id); document.removeEventListener('click', off) }
  }, [menu])
  // Core facts only, one muted line: when it is due, the planned slot, effort, project. Everything else lives in the task panel.
  const today = new Date().toLocaleDateString('sv')
  const facts = [
    t.due && <span key="d" className={t.due < today && !t.done ? 'font-medium text-danger' : ''}>{t.from ? `${fmtDate(t.from)} → ${fmtDate(t.due)}` : `Due ${fmtDate(t.due)}`}{t.repeat ? ' ↻' : ''}</span>,
    t.when && <span key="w">Plan {fmtDate(t.when)}{t.start ? ` ${t.start}` : ''}</span>,
    t.hours > 0 && <span key="h">{fmtDuration(t.hours)}</span>,
    q !== undefined && !inBox && !project && <span key="q">{Q[q].name}</span>,
    project && <span key="p">{project}</span>,
  ].filter(Boolean)
  const item = 'flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-slate-100'
  return (
    <li className={`${rowCard} px-3 py-2`}>
      {inBox && <Cover seed={t.id} className="-mx-3 -mt-2 mb-2 block h-14 w-[calc(100%+1.5rem)] rounded-t-[0.8125rem]" />}
      <div className="flex items-center gap-2">
        <span className="hidden shrink-0 cursor-grab text-slate-400 md:block" draggable title="Drag to another box" aria-hidden="true"
          onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.setDragImage(e.currentTarget.closest('li'), 0, 0) }}>
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor"><circle cx="5" cy="4" r="1.2" /><circle cx="11" cy="4" r="1.2" /><circle cx="5" cy="8" r="1.2" /><circle cx="11" cy="8" r="1.2" /><circle cx="5" cy="12" r="1.2" /><circle cx="11" cy="12" r="1.2" /></svg>
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <input type="checkbox" checked={!!t.done} onChange={() => update(t.id, { done: !t.done })} aria-label={`Mark ${t.title} done`} />
          <button className="min-h-11 min-w-0 flex-1 text-left" onClick={onEdit} aria-label={`Open ${t.title}`}>
            <span className={`block break-words ${t.done ? 'text-slate-500 line-through' : ''}`}>{t.title}{isMissed(t) && <span className="ml-2 rounded-full bg-[#f6d5cf] px-2 text-xs text-[#7a1a14]">missed</span>}</span>
          </button>
        </div>
        <span className="relative flex shrink-0 items-center gap-1">
          {!t.done && <button className={`${btn} text-accent hover:bg-pale`} onClick={() => onStart(t)} aria-label={`Start focus on ${t.title}`}>Start</button>}
          <button className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} aria-label={`More actions for ${t.title}`}>
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-line bg-white p-1 shadow-md" onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}>
              <button role="menuitem" className={item} onClick={() => { setOpen(!open); setMenu(false) }}>{open ? 'Hide details' : 'Details'}</button>
              <button role="menuitem" className={item} onClick={() => { onEdit(); setMenu(false) }}>Open</button>
              <button role="menuitem" className={`${item} text-danger`} onClick={() => { onDelete(); setMenu(false) }}>Delete</button>
            </div>
          )}
        </span>
      </div>
      {facts.length > 0 && <p className="flex flex-wrap gap-x-2 pb-1 pl-9 text-xs text-slate-600">{facts.flatMap((f, i) => (i ? [<span key={`s${i}`} aria-hidden="true">·</span>, f] : [f]))}</p>}
      {open && (
        <div className="space-y-3 pb-1 pl-9 pt-3 text-sm">
          <Happy value={t.happy} onChange={(happy) => update(t.id, { happy })} label="Feeling about it" />
          <p className="text-slate-600">{[Q[q]?.name, t.repeat && `Repeats ${t.repeat}`, subs.length > 0 && `${subs.filter((x) => x.done).length}/${subs.length} steps`, t.spent > 0 && `${t.spent < 1 / 120 ? '<1' : Math.round(t.spent * 60)} min focused`].filter(Boolean).join(' · ')}</p>
          <p><b className="font-medium">Why here?</b> {t.reason || (q === undefined ? 'Not ranked yet. Use Prioritise with AI, or move it yourself below.' : 'No reason saved.')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">Move to
              <select className={input} value={q ?? ''} onChange={(e) => move(t.id, e.target.value === '' ? '' : +e.target.value)}>
                <option value="">Let the AI decide</option>
                {Q.map((x, i) => <option key={x.name} value={i}>{x.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2">Repeat
              <select className={input} value={t.repeat || ''} onChange={(e) => update(t.id, { repeat: e.target.value || undefined })}>
                {REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <div>
            <p className="mb-1 font-medium">Steps</p>
            <ul className="space-y-1">
              {subs.map((x) => (
                <li key={x.id} className="flex items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-3">
                    <input type="checkbox" checked={x.done} onChange={() => setSubs(subs.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)))} />
                    <span className={`break-words ${x.done ? 'text-slate-500 line-through' : ''}`}>{x.title}</span>
                  </label>
                  <button className={`${btn} text-danger hover:bg-slate-100`} aria-label={`Remove step ${x.title}`} onClick={() => setSubs(subs.filter((y) => y.id !== x.id))}>Remove</button>
                </li>
              ))}
            </ul>
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (sub.trim()) { setSubs([...subs, { id: Date.now(), title: sub.trim(), done: false }]); setSub('') } }}>
              <input className={`${input} min-w-0 flex-1`} aria-label="New step" placeholder="Add a step" value={sub} onChange={(e) => setSub(e.target.value)} />
              <button className={`${btn} border border-control bg-white hover:bg-slate-100`}>Add</button>
            </form>
          </div>
        </div>
      )}
    </li>
  )
}
