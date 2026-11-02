// Build mode UI (Phase 2, CP3): the decor tray (bottom panel; a bottom sheet on phones), the menu for a placed item, undo/redo, and the owner's tools.
// The scene decides everything (ghost, green/red, edits); this only shows what it reports and sends the player's choices through the bridge.
import { useEffect, useMemo, useState } from 'react'
import { DECOR_CATEGORIES, DECOR_LIST, DECOR, SIGN_MAX_CHARS, type DecorCategory } from '@desker/shared'
import type { Bridge, BuildView } from './game/bridge.ts'
import { patchVillage } from './api.ts'
import { getLang, useLang } from './i18n.ts'

type Frame = { frame: { x: number; y: number; w: number; h: number } }
let atlas: Promise<Record<string, Frame>> | null = null
const loadAtlas = () => (atlas ??= fetch('/assets/decor/decor.json').then((r) => r.json()).then((j) => j.frames as Record<string, Frame>).catch(() => ({})))
const CAT: Record<DecorCategory | 'all', { en: string; th: string }> = {
  all: { en: 'All', th: 'ทั้งหมด' }, study: { en: 'Study', th: 'เรียน' }, cosy: { en: 'Cosy', th: 'อบอุ่น' }, nature: { en: 'Nature', th: 'ธรรมชาติ' }, lights: { en: 'Lights', th: 'แสงไฟ' }, signs: { en: 'Signs', th: 'ป้าย' }, seasonal: { en: 'Seasonal', th: 'ตามฤดู' },
}
export type Snapshot = { version: number; at: string; items: number }

function Icon({ id, frames }: { id: string; frames: Record<string, Frame> }) {
  const f = frames[`${id}:0:0`]?.frame; if (!f) return <span className="b-icon" />
  const z = Math.max(f.w, f.h) <= 19 ? 2 : 1
  return <span className="b-icon" aria-hidden><span style={{ width: f.w, height: f.h, background: `url(/assets/decor/decor.png) -${f.x}px -${f.y}px`, transform: `scale(${z})`, imageRendering: 'pixelated' }} /></span>
}

export default function Build({ view, bridge, slug, owner, villageName, who, onWho, snaps, mapOn }: {
  view: BuildView; bridge: Bridge; slug: string; owner: boolean; villageName: string; who: string; onWho: (w: 'owner' | 'admins' | 'everyone') => void; snaps: Snapshot[] | null; mapOn: boolean
}) {
  useLang()
  const th = getLang() === 'th'
  const [cat, setCat] = useState<DecorCategory | 'all'>('all'), [q, setQ] = useState(''), [frames, setFrames] = useState<Record<string, Frame>>({})
  const [text, setText] = useState(''), [editing, setEditing] = useState(false), [tools, setTools] = useState(false), [open, setOpen] = useState(true)
  useEffect(() => { loadAtlas().then(setFrames) }, [])
  useEffect(() => { setEditing(false); setText(view.sel?.text ?? '') }, [view.sel?.id])
  const items = useMemo(() => {
    const s = q.trim().toLowerCase()
    return DECOR_LIST.filter((d) => (cat === 'all' || d.cat === cat) && (!s || d.name.en.toLowerCase().includes(s) || d.name.th.includes(s)))
  }, [cat, q])
  if (!view.on) return null
  const sel = view.sel ? DECOR[view.sel.decorId] : null, name = (id: string) => (th ? DECOR[id].name.th : DECOR[id].name.en)
  return (
    <>
      <div className="b-top" role="toolbar" aria-label="Decorating">
        <b>🔨 {th ? 'กำลังตกแต่ง' : 'Decorating'}</b>
        <button onClick={() => bridge.build.undo()} disabled={!view.undo} title="Ctrl+Z" aria-label="Undo">↶</button>
        <button onClick={() => bridge.build.redo()} disabled={!view.redo} title="Ctrl+Shift+Z" aria-label="Redo">↷</button>
        {view.item && !view.moving && DECOR[view.item].rot.length > 1 && <button onClick={() => bridge.build.rotate()} title="R">⟳ R</button>}
        <button onClick={() => bridge.build.set(false)} title="Esc">{th ? 'เสร็จ' : 'Done'}</button>
      </div>
      {(view.reason || view.item) && <div className={`b-note ${view.item && !view.ok ? 'bad' : ''}`} role="status">{view.item ? `${view.moving ? (th ? 'ย้าย' : 'Moving') : name(view.item)}${view.reason ? ` · ${view.reason}` : view.ok ? '' : ''}` : view.reason}</div>}
      {sel && view.sel && (
        <div className="b-menu" role="toolbar" aria-label={name(view.sel.decorId)}>
          <b>{name(view.sel.decorId)}</b>
          <button onClick={() => bridge.build.act('move')}>{th ? 'ย้าย' : 'Move'}</button>
          {sel.rot.length > 1 && <button onClick={() => bridge.build.act('rotate')}>{th ? 'หมุน' : 'Rotate'}</button>}
          <button onClick={() => bridge.build.act('away')}>{th ? 'เก็บ' : 'Put away'}</button>
          {sel.interact === 'sign' && <button onClick={() => setEditing((e) => !e)}>{th ? 'แก้ข้อความ' : 'Edit text'}</button>}
          {editing && <form onSubmit={(e) => { e.preventDefault(); bridge.build.act('text', text); setEditing(false) }}>
            <input value={text} maxLength={SIGN_MAX_CHARS} onChange={(e) => setText(e.target.value)} aria-label="Sign text" autoFocus placeholder={th ? 'ข้อความบนป้าย' : 'What does it say?'} />
            <button type="submit">OK</button></form>}
        </div>
      )}
      <div className={`b-tray ${open ? '' : 'shut'} ${mapOn ? 'with-map' : ''}`}>
        <div className="b-head">
          <div className="b-tabs" role="tablist">{(['all', ...DECOR_CATEGORIES] as const).map((c) => <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)}>{th ? CAT[c].th : CAT[c].en}</button>)}</div>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={th ? 'ค้นหา' : 'Search'} aria-label="Search items" />
          {owner && <button onClick={() => setTools(true)}>{th ? 'เครื่องมือ' : 'Tools'}</button>}
          <button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Hide tray' : 'Show tray'} aria-expanded={open}>{open ? '▾' : '▴'}</button>
        </div>
        {open && <ul className="b-grid">{items.map((d) => (
          <li key={d.id}><button className={view.item === d.id && !view.moving ? 'on' : ''} onClick={() => bridge.build.pick(view.item === d.id && !view.moving ? null : d.id)} aria-pressed={view.item === d.id && !view.moving}>
            <Icon id={d.id} frames={frames} /><span>{th ? d.name.th : d.name.en}</span></button></li>))}
          {!items.length && <li className="b-none">{th ? 'ไม่พบสิ่งของ' : 'Nothing matches.'}</li>}
        </ul>}
      </div>
      {tools && <Tools slug={slug} bridge={bridge} villageName={villageName} who={who} onWho={onWho} snaps={snaps} onClose={() => setTools(false)} />}
    </>
  )
}

function Tools({ slug, bridge, villageName, who, onWho, snaps, onClose }: { slug: string; bridge: Bridge; villageName: string; who: string; onWho: (w: 'owner' | 'admins' | 'everyone') => void; snaps: Snapshot[] | null; onClose: () => void }) {
  const [sure, setSure] = useState<number | null>(null), [typed, setTyped] = useState(''), [err, setErr] = useState('')
  const ask = () => bridge.out({ t: 'map.snapshots' })
  useEffect(() => { ask() }, [])
  useEffect(() => { const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on) }, [])
  return (
    <div className="hud-modal" role="dialog" aria-label="Village decorating tools" onClick={onClose}>
      <div className="hud-panel manage" onClick={(e) => e.stopPropagation()}>
        <h2>Decorating tools</h2>
        <label>Who can decorate{' '}
          <select value={who} onChange={(e) => { const w = e.target.value as 'owner' | 'admins' | 'everyone'; patchVillage(slug, { whoCanBuild: w }).then(() => { onWho(w); setErr('') }, () => setErr('Could not change that.')) }}>
            <option value="owner">Only me</option><option value="admins">Me and admins</option><option value="everyone">Every member</option></select></label>
        {err && <p role="alert">{err}</p>}
        <h3>Snapshots</h3>
        <p><button onClick={() => { bridge.out({ t: 'map.snapshot' }); setTimeout(ask, 700) }}>Save a snapshot now</button> <small>One is also saved every 50 changes.</small></p>
        {!snaps ? <p>Loading…</p> : snaps.length === 0 ? <p>No snapshots yet.</p> : <ul>{snaps.map((s) => (
          <li key={s.version}>Version {s.version} <small>{new Date(s.at).toLocaleString()} · {s.items} items</small>
            <button onClick={() => { if (sure === s.version) { bridge.out({ t: 'map.restore', version: s.version }); setSure(null); onClose() } else setSure(s.version) }}>{sure === s.version ? 'Sure? Restore' : 'Restore'}</button></li>))}</ul>}
        <small>Restoring is itself a change, so you can undo it by restoring a later snapshot.</small>
        <h3>Reset to template</h3>
        <p><small>Removes every decoration. Type “{villageName}” to confirm.</small></p>
        <p className="row"><input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Village name" />
          <button disabled={typed.trim() !== villageName} onClick={() => { bridge.out({ t: 'map.reset' }); setTyped(''); onClose() }}>Reset</button></p>
        <p><button onClick={onClose}>Close (Esc)</button></p>
      </div>
    </div>
  )
}
