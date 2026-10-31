import { useState, useEffect, useRef } from 'react'
import { btn, ghost, input, BLUE } from '../ui.js'
import { post } from '../api.js'
import { track } from '../analytics.js'

const KINDS = [['bug', 'Something broke'], ['idea', 'An idea'], ['love', 'Something I like'], ['other', 'Other']]

// A small button that stays in the corner on every screen; it opens a short form that is emailed to the owner (api/_feedback.js).
// The screen and device go along automatically, so people only have to say what happened.
export default function Feedback({ page }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('')
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState(true)
  const [state, setState] = useState({ busy: false, error: '', sent: false })
  const opener = useRef(null)

  const close = () => { setOpen(false); opener.current?.focus() }
  useEffect(() => {
    if (!open) return
    const esc = (e) => e.key === 'Escape' && close()
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [open])

  const send = async (e) => {
    e.preventDefault()
    if (state.busy || !kind || message.trim().length < 3) return
    setState({ busy: true, error: '', sent: false })
    try {
      await post('/api/state?feedback=1', { kind, message, reply, page, device: `${navigator.userAgent.slice(0, 120)} · ${innerWidth}x${innerHeight}` })
      track('feedback_sent', { kind })
      setKind(''); setMessage(''); setState({ busy: false, error: '', sent: true })
    } catch (err) { setState({ busy: false, error: err.message, sent: false }) } // the text stays, nothing is lost
  }

  return (
    <>
      <button ref={opener} className={`${btn} ${ghost} fixed bottom-20 right-3 z-20 bg-white md:bottom-4 md:right-4`} onClick={() => { setState({ busy: false, error: '', sent: false }); setOpen(true) }}>Feedback</button>
      {open && (
        <div className="px-backdrop fixed inset-0 z-40 flex items-end justify-center sm:items-center" onClick={close}>
          <form role="dialog" aria-modal="true" aria-label="Send feedback" className="px-panel w-full max-w-md bg-yuki-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()} onSubmit={send}>
            {state.sent ? (
              <>
                <p className="text-2xl">Thank you. It reached me, and I read every one.</p>
                <div className="mt-4 flex gap-2"><button type="button" autoFocus className={`${btn} ${BLUE}`} onClick={close}>Close</button>
                  <button type="button" className={`${btn} ${ghost}`} onClick={() => setState({ busy: false, error: '', sent: false })}>Send another</button></div>
              </>
            ) : (
              <>
                <h2 className="text-2xl">Tell me what you think</h2>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="What is it about?">
                  {KINDS.map(([k, label]) => <button key={k} type="button" aria-pressed={kind === k} className={`${btn} ${kind === k ? BLUE : ghost}`} onClick={() => setKind(k)}>{label}</button>)}
                </div>
                <textarea autoFocus className={`${input} mt-3 h-32 w-full`} aria-label="Your feedback" maxLength={2000} placeholder={kind === 'bug' ? 'What did you do, and what happened instead?' : 'Say it in your own words.'} value={message} onChange={(e) => setMessage(e.target.value)} />
                <label className="mt-2 flex items-center gap-2 text-base"><input type="checkbox" checked={reply} onChange={(e) => setReply(e.target.checked)} />You may email me back about this</label>
                <p className="mt-1 text-xs text-slate-700">Sent with the screen you are on ({page}) and your browser and screen size. Nothing else from your account.</p>
                {state.error && <p role="alert" className="mt-2 text-base text-danger">{state.error}</p>}
                <div className="mt-3 flex gap-2">
                  <button className={`${btn} ${BLUE}`} disabled={state.busy || !kind || message.trim().length < 3}>{state.busy ? 'Sending…' : 'Send'}</button>
                  <button type="button" className={`${btn} ${ghost}`} onClick={close}>Cancel</button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </>
  )
}
