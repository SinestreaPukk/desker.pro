import { useState, useEffect, useRef } from 'react'
import { btn, ghost } from './ui.js'
import { migrate } from './storage.js'
import { dueReminders } from './reminders.js'
import { uid } from './api.js'
import { Button, PrivateWarning } from './components/ui.jsx'

const KEYS = ['goals', 'tasks', 'hobbies', 'deadlines', 'projects', 'busy', 'focus', 'pick', 'freeHours', 'freeToday', 'mood', 'sync', 'energyLog']
const store = {
  get: (k) => { try { return localStorage[k] } catch { return undefined } },
  set: (k, v) => { try { localStorage[k] = v } catch { /* storage blocked: the toggle just will not persist */ } },
}

// Gear menu: reminders, backup export/import. Also runs the reminder timer (it is always mounted).
// row: a labelled sidebar entry whose panel opens upward; otherwise a round icon button.
export default function Settings({ data, setData }) {
  const dlg = useRef(null)
  const [show, setShow] = useState(false) // sync code revealed
  const [rem, setRem] = useState(() => store.get('reminders') === '1' && 'Notification' in window && Notification.permission === 'granted')
  const [msg, setMsg] = useState('')
  const [incoming, setIncoming] = useState(null)
  const latest = useRef(data)
  latest.current = data

  useEffect(() => {
    const tick = () => {
      if (store.get('reminders') !== '1' || !('Notification' in window) || Notification.permission !== 'granted') return
      let fired = []
      try { fired = JSON.parse(store.get('fired') || '[]') } catch { /* start fresh */ }
      const due = dueReminders(Date.now(), latest.current.tasks, latest.current.deadlines || []).filter((r) => !fired.includes(r.key))
      due.forEach((r) => new Notification(r.title, { body: r.body, tag: r.key }))
      if (due.length) store.set('fired', JSON.stringify([...fired, ...due.map((r) => r.key)].slice(-200)))
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  const toggle = async (on) => {
    setMsg('')
    if (!on) { store.set('reminders', ''); setRem(false); return }
    if (!('Notification' in window)) return setMsg('This browser does not support notifications.')
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission() // asked only now
    if (p !== 'granted') return setMsg('Notifications are blocked. Allow them in your browser settings, then try again.')
    store.set('reminders', '1'); setRem(true)
    setMsg('Reminders are on. They only fire while Desker is open in a tab.')
  }
  const exportData = () => {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })),
      download: `desker-backup-${new Date().toLocaleDateString('sv')}.json`,
    })
    a.click(); URL.revokeObjectURL(a.href)
  }
  const readFile = async (f) => {
    setMsg('')
    try {
      if (f.size > 200_000) throw new Error()
      const d = JSON.parse(await f.text())
      if (!d || !Array.isArray(d.goals) || !Array.isArray(d.tasks)) throw new Error()
      setIncoming(Object.fromEntries(KEYS.filter((k) => d[k] !== undefined).map((k) => [k, d[k]])))
    } catch { setMsg('That file is not a Desker backup. Your data was not changed.') }
  }
  const copy = () => navigator.clipboard?.writeText(uid).then(() => setMsg('Sync code copied.'), () => setMsg('Could not copy. Reveal the code and copy it by hand.'))
  const section = 'space-y-2 border-t border-line pt-4'
  return (
    <>
      <button className="flex h-11 items-center gap-2 rounded-full px-3 text-sm text-slate-700 hover:bg-panel md:px-4" onClick={() => dlg.current.showModal()}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" /></svg>
        <span className="max-md:sr-only">Settings</span>
      </button>
      {/* Native dialog: focus trap, Escape and backdrop come free. */}
      <dialog ref={dlg} aria-labelledby="settings-title" className="m-auto max-h-[90dvh] w-[min(32rem,calc(100vw-1.5rem))] overflow-y-auto rounded-3xl border border-control bg-white p-5 text-ink shadow-lg backdrop:bg-ink/40"
        onClose={() => setShow(false)} onClick={(e) => e.target === dlg.current && dlg.current.close()}>
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="text-lg font-semibold">Settings</h2>
          <Button variant="secondary" onClick={() => dlg.current.close()}>Close</Button>
        </div>

        <div className="mt-4 space-y-4">
          <section className="space-y-2" aria-labelledby="s-rem">
            <h3 id="s-rem" className="font-medium">Reminders</h3>
            <label className="flex items-center justify-between gap-3 text-sm">Notify me
              <input type="checkbox" checked={rem} onChange={(e) => toggle(e.target.checked)} />
            </label>
            <p className="text-sm text-slate-600">At a task’s start time, and 1 day and 1 hour before a deadline. They only fire while Desker is open in a tab.</p>
          </section>

          <section className={section} aria-labelledby="s-sync">
            <h3 id="s-sync" className="font-medium">Account &amp; sync</h3>
            <p className="text-sm text-slate-700">There is no sign-up. Your workspace is saved on our server under an anonymous sync code, and that code lives in this browser. Clear this browser’s data without a backup and you lose access, so export a backup or keep your code somewhere safe.</p>
            <label className="block text-sm text-slate-600" htmlFor="sync-code">Your sync code</label>
            <div className="flex gap-2">
              <input id="sync-code" readOnly className="min-w-0 flex-1 rounded-lg bg-panel px-3 py-2 font-mono text-sm" type={show ? 'text' : 'password'} value={uid} />
              <Button variant="secondary" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Hide' : 'Reveal'}</Button>
              <Button variant="secondary" onClick={copy}>Copy</Button>
            </div>
            <PrivateWarning>Anyone with this code can open and change your workspace. It is also your API key (see the README).</PrivateWarning>
            <form className="flex gap-2 pt-1" onSubmit={(e) => {
              e.preventDefault()
              const c = e.target.code.value.trim()
              if (!/^[0-9a-f-]{36}$/.test(c)) return setMsg('That is not a sync code.')
              if (c !== uid && confirm('Switch to this workspace? Export a backup first if this device has data you want to keep.')) { localStorage.uid = c; location.reload() }
            }}>
              <input name="code" className="min-w-0 flex-1 rounded-lg bg-panel px-3 py-2 font-mono text-sm" placeholder="Paste a sync code to open another workspace" aria-label="Sync code to use" />
              <Button variant="secondary" type="submit">Use code</Button>
            </form>
            {/* TODO(roadmap: Sign in with Google): sits here, above the sync code, once accounts exist */}
            {/* TODO(roadmap: Reset sync code): issue a new code and revoke the old one, next to Copy */}
          </section>

          <section className={section} aria-labelledby="s-backup">
            <h3 id="s-backup" className="font-medium">Backup</h3>
            <p className="text-sm text-slate-600">Export downloads everything as one JSON file. Import replaces everything in this workspace with the file.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={exportData}>Export JSON</Button>
              <label className={`${btn} ${ghost} inline-flex cursor-pointer items-center`}>Import JSON
                <input type="file" className="sr-only" accept="application/json,.json" onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) readFile(f) }} />
              </label>
            </div>
            {incoming && (
              <div role="alert" className="rounded-xl bg-danger-tint p-3 text-sm">
                Replace everything with this file ({incoming.tasks.length} tasks, {incoming.goals.length} goals)? This cannot be undone.
                <div className="mt-2 flex gap-2">
                  <Button variant="destructive" onClick={() => { setData(migrate(incoming)); setIncoming(null); setMsg('Backup restored.') }}>Replace</Button>
                  <Button variant="secondary" onClick={() => setIncoming(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </section>
        </div>
        {msg && <p role="status" className="mt-4 text-sm">{msg}</p>}
      </dialog>
    </>
  )
}
