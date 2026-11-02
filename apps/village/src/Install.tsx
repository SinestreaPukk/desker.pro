// "Add to Home Screen" help for iPhone and iPad Safari (it has no install button of its own). Shown from the second visit, once.
import { useState } from 'react'

const iosSafari = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(navigator as { standalone?: boolean }).standalone && !matchMedia('(display-mode: standalone)').matches
const due = () => {
  if (!iosSafari() || localStorage.getItem('village.install.seen')) return false
  if (!sessionStorage.getItem('village.visit')) { sessionStorage.setItem('village.visit', '1'); localStorage.setItem('village.visits', String(+(localStorage.getItem('village.visits') ?? 0) + 1)) } // one per browser session
  return +(localStorage.getItem('village.visits') ?? 0) >= 2
}

export default function Install() {
  const [show, setShow] = useState(due)
  if (!show) return null
  const done = () => { localStorage.setItem('village.install.seen', '1'); setShow(false) }
  return (
    <div className="knock-card install" role="dialog" aria-label="Add to Home Screen">
      <b>Open Kodama Village like an app</b>
      <ol>
        <li>Tap <span aria-hidden className="ico">⬆︎</span> <b>Share</b> at the bottom of Safari</li>
        <li>Scroll and tap <span aria-hidden className="ico">＋</span> <b>Add to Home Screen</b></li>
        <li>Tap <b>Add</b>. Kodama is now on your Home Screen.</li>
      </ol>
      <span className="row"><button onClick={done}>Got it</button></span>
    </div>
  )
}
