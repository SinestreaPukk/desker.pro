// First-visit tour, led by the Kodama: three short steps, skippable, never shown again once done or skipped.
import { useState } from 'react'
import { t, useLang, type Key } from './i18n.ts'

export default function Tour({ touch }: { touch: boolean }) {
  useLang()
  const [i, setI] = useState(() => (localStorage.getItem('village.tour') ? -1 : 0))
  if (i < 0) return null
  const end = () => { localStorage.setItem('village.tour', '1'); setI(-1) }
  const key = (['tour.1', touch ? 'tour.2t' : 'tour.2', touch ? 'tour.3t' : 'tour.3'] as Key[])[i]
  return (
    <div className="tour" role="dialog" aria-label="Tour" onKeyDown={(e) => e.key === 'Escape' && end()}>
      <b>🌳 {t('tour.who')}</b> <small>{i + 1}/3</small>
      <p>{t(key)}</p>
      <span className="row"><button onClick={end}>{t('tour.skip')}</button><button autoFocus onClick={() => (i === 2 ? end() : setI(i + 1))}>{i === 2 ? t('tour.done') : t('tour.next')}</button></span>
    </div>
  )
}
