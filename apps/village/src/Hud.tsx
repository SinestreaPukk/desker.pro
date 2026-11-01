// React HUD over the canvas: village name, zone, help overlay, first-visit hint, settings (sound). Panels live here, never in Phaser.
import { useEffect, useState } from 'react'
import { KEYBINDINGS, actionOf, type ZoneId } from '@desker/shared'

const ZONE: Record<ZoneId, string> = { plaza: 'Board Plaza', library: 'Library (quiet)', tables: 'Group Tables', lounge: 'Lounge', garden: 'Garden' }
const load = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? '') as T } catch { return d } }
export type SoundPrefs = { on: boolean; volume: number }

export function useSound() { // sound is off until the player turns it on (SPEC §4.3); the sounds themselves arrive with bubbles and chimes
  const [s, set] = useState<SoundPrefs>(() => load('village.sound', { on: false, volume: 0.5 }))
  useEffect(() => { localStorage.setItem('village.sound', JSON.stringify(s)) }, [s])
  return [s, set] as const
}

export default function Hud({ name, zone, pill, children }: { name: string; zone: ZoneId; pill: string; children?: React.ReactNode }) {
  const [help, setHelp] = useState(false), [settings, setSettings] = useState(false)
  const [hint, setHint] = useState(() => !load('village.hintDismissed', false))
  const [sound, setSound] = useSound()
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setHelp(false); setSettings(false); return }
      if (actionOf(e.key) === 'help') setHelp((h) => !h) // ignored while typing, like every game key
    }
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on)
  }, [])
  const dismiss = () => { setHint(false); localStorage.setItem('village.hintDismissed', 'true') }
  const phase0 = KEYBINDINGS.filter((k) => k.phase === 0)
  const rows = [...new Map(phase0.map((k) => [k.label, phase0.filter((x) => x.label === k.label).flatMap((x) => x.keys)])).entries()]
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-card"><b>{name}</b><span>{ZONE[zone]}</span>{pill && <em role="status">{pill}</em>}</div>
        <div className="hud-btns">
          <button aria-label="Help" title="Help (?)" onClick={() => setHelp(true)}>?</button>
          <button aria-label="Settings" title="Settings" onClick={() => setSettings(true)}>⚙</button>
        </div>
      </div>
      {children}
      {hint && <div className="hud-hint" role="note">WASD to walk · T to talk · X to sit · ? for help <button onClick={dismiss} aria-label="Dismiss hint">×</button></div>}
      {help && (
        <div className="hud-modal" role="dialog" aria-label="Keyboard help" onClick={() => setHelp(false)}>
          <div className="hud-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Keys</h2>
            <table><tbody>{rows.map(([label, keys]) => <tr key={label}><td>{label}</td><td>{keys.map((k) => <kbd key={k}>{k === 'ArrowUp' ? '↑' : k === 'ArrowDown' ? '↓' : k === 'ArrowLeft' ? '←' : k === 'ArrowRight' ? '→' : k}</kbd>)}</td></tr>)}</tbody></table>
            <p>Phones: tap a tile to walk. <button onClick={() => setHelp(false)}>Close (Esc)</button></p>
          </div>
        </div>
      )}
      {settings && (
        <div className="hud-modal" role="dialog" aria-label="Settings" onClick={() => setSettings(false)}>
          <div className="hud-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>
            <label><input type="checkbox" checked={sound.on} onChange={(e) => setSound({ ...sound, on: e.target.checked })} /> Cosy sounds</label>
            <label>Volume <input type="range" min={0} max={1} step={0.05} value={sound.volume} disabled={!sound.on} onChange={(e) => setSound({ ...sound, volume: Number(e.target.value) })} /></label>
            <p><button onClick={() => setSettings(false)}>Close (Esc)</button></p>
          </div>
        </div>
      )}
    </div>
  )
}
