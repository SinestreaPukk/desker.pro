// E: a radial wheel of 8 emotes. Keys 1-8, mouse or touch pick one; Esc or a click outside closes it.
import { useEffect } from 'react'
import { EMOTES } from '@desker/shared'

export default function EmoteWheel({ onPick, onClose }: { onPick: (id: number) => void; onClose: () => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') { onClose(); return }
      const n = Number(e.key); if (n >= 1 && n <= 8) { e.preventDefault(); onPick(n) }
    }
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on)
  }, [onPick, onClose])
  return (
    <div className="hud-modal wheel-back" role="dialog" aria-label="Emotes" onClick={onClose}>
      <div className="wheel" onClick={(e) => e.stopPropagation()}>
        {EMOTES.map((e, i) => { const a = (i / 8) * Math.PI * 2 - Math.PI / 2; return (
          <button key={e.id} aria-label={`${e.label} (${e.id})`} title={`${e.label} (${e.id})`} onClick={() => onPick(e.id)} style={{ left: `calc(50% + ${Math.cos(a) * 84}px)`, top: `calc(50% + ${Math.sin(a) * 84}px)` }}>
            <span>{e.glyph}</span><small>{e.id}</small></button>) })}
      </div>
    </div>
  )
}
