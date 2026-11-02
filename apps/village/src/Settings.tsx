// The settings panel's own sections: Controls (remap), Sound, Accessibility, Language. Privacy, Blocked and Notifications come from Privacy.tsx.
import { useState } from 'react'
import { KEYBINDINGS, REMAPPABLE, keysOf, remapCheck, type Action } from '@desker/shared'
import { a11y, keyChoices, saveA11y, saveKeys } from './prefs.ts'
import { getLang, setLang, t, useLang, type Lang } from './i18n.ts'
import type { SoundPrefs } from './Hud.tsx'

const label = (a: Action) => KEYBINDINGS.find((b) => b.action === a)!.label
const show = (k: string) => (k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k)

export default function SettingsSections({ sound, setSound }: { sound: SoundPrefs; setSound: (s: SoundPrefs) => void }) {
  useLang()
  const [A, setA] = useState(a11y), [keys, setKeys] = useState(keyChoices), [listen, setListen] = useState<Action | null>(null), [err, setErr] = useState(''), [note, setNote] = useState(false)
  const flip = (k: keyof typeof A) => { const n = { ...A, [k]: !A[k] }; setA(n); saveA11y(n); setNote(true) }
  const pick = (e: React.KeyboardEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!listen) return
    if (e.key === 'Escape') { setListen(null); return }
    const why = remapCheck(listen, e.key)
    if (why) { setErr(why === 'reserved' ? t('set.controls.reserved') : `${t('set.controls.taken')} “${label(why.slice(6) as Action)}”`); return }
    const n = { ...keys, [listen]: e.key.length === 1 ? e.key.toLowerCase() : e.key }; setKeys(n); saveKeys(n); setListen(null); setErr('')
  }
  return (<>
    <fieldset className="privacy"><legend>{t('set.sound')}</legend>
      <label><input type="checkbox" checked={sound.on} onChange={(e) => setSound({ ...sound, on: e.target.checked })} /> {t('set.sound.on')}</label>
      {(['volume', 'effects', 'ambience'] as const).map((k) => <label key={k}>{t(k === 'volume' ? 'set.sound.master' : k === 'effects' ? 'set.sound.effects' : 'set.sound.ambience')} <input type="range" min={0} max={1} step={0.05} value={sound[k] ?? 0.5} disabled={!sound.on} onChange={(e) => setSound({ ...sound, [k]: Number(e.target.value) })} /></label>)}
    </fieldset>
    <fieldset className="privacy"><legend>{t('set.controls')}</legend>
      <ul className="keymap">{REMAPPABLE.map((a) => <li key={a}>{label(a)} <button type="button" aria-label={`${label(a)}: ${show(keysOf(a)[0])}`} onKeyDown={listen === a ? pick : undefined} onClick={() => { setListen(a); setErr('') }}>{listen === a ? t('set.controls.press') : <kbd>{show(keysOf(a)[0])}</kbd>}</button></li>)}</ul>
      {err && <p role="alert">{err}</p>}
      <button type="button" onClick={() => { setKeys({}); saveKeys({}); setErr('') }}>{t('set.controls.reset')}</button>
    </fieldset>
    <fieldset className="privacy"><legend>{t('set.a11y')}</legend>
      <label><input type="checkbox" checked={A.reduceMotion} onChange={() => flip('reduceMotion')} /> {t('set.a11y.motion')}</label>
      <label><input type="checkbox" checked={A.bigBubbles} onChange={() => flip('bigBubbles')} /> {t('set.a11y.big')}</label>
      <label><input type="checkbox" checked={A.contrast} onChange={() => flip('contrast')} /> {t('set.a11y.contrast')}</label>
      <label><input type="checkbox" checked={A.cbSafe} onChange={() => flip('cbSafe')} /> {t('set.a11y.cb')}</label>
      {note && <p>{t('set.next')}</p>}
    </fieldset>
    <fieldset className="privacy"><legend>{t('set.lang')}</legend>
      <select aria-label={t('set.lang')} value={getLang()} onChange={(e) => setLang(e.target.value as Lang)}><option value="en">English</option><option value="th">ไทย</option></select>
    </fieldset>
  </>)
}
