import { useState, useEffect, useRef } from 'react'
import { btn, BLUE, ghost } from './ui.js'
import { migrate } from './storage.js'
import { dueReminders } from './reminders.js'
import { uid } from './api.js'

const KEYS = ['goals', 'tasks', 'hobbies', 'deadlines', 'projects', 'busy', 'focus', 'pick', 'freeHours', 'freeToday', 'mood', 'sync', 'energyLog']
const store = {
  get: (k) => { try { return localStorage[k] } catch { return undefined } },
  set: (k, v) => { try { localStorage[k] = v } catch { /* storage blocked: the toggle just will not persist */ } },
}

// Gear menu: reminders, backup export/import. Also runs the reminder timer (it is always mounted).
// row: a labelled sidebar entry whose panel opens upward; otherwise a round icon button.
export default function Settings({ data, setData, row: inSidebar }) {
  const [open, setOpen] = useState(false)
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
  const row = 'flex items-center justify-between gap-3 text-sm'
  return (
    <div className="relative shrink-0">
      <button className={inSidebar ? 'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-slate-700 hover:bg-panel' : 'flex h-11 items-center gap-2 rounded-full px-4 text-sm text-slate-700 hover:bg-panel'} aria-label="Settings" aria-expanded={open} onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" /></svg>
        Settings
      </button>
      {open && (
        <div className={`absolute z-40 w-72 ${inSidebar ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2'} space-y-3 rounded-2xl bg-white p-3 shadow-lg border border-control`} role="dialog" aria-label="Settings">
          <label className={row}>Reminders
            <input type="checkbox" checked={rem} onChange={(e) => toggle(e.target.checked)} />
          </label>
          <p className="text-xs text-slate-600">Notifies you at a task's start time, and 1 day and 1 hour before a deadline.</p>
          <hr className="border-black/5" />
          <p className="text-xs text-slate-600">Your data lives on our server under an anonymous id tied to this browser. Export a backup to keep it safe or to move it.</p>
          <div className="text-xs text-slate-600">
            <p>Sync code (also your API key, see README). Keep it private; paste it on another device to open this workspace there.</p>
            <input readOnly className="mt-1 w-full rounded-lg bg-panel px-2 py-1 font-mono" aria-label="Your sync code" value={uid} onFocus={(e) => e.target.select()} />
            <form className="mt-2 flex gap-2" onSubmit={(e) => {
              e.preventDefault()
              const c = e.target.code.value.trim()
              if (!/^[0-9a-f-]{36}$/.test(c)) return setMsg('That is not a sync code.')
              if (c !== uid && confirm('Switch to this workspace? Export a backup first if this device has data you want to keep.')) { localStorage.uid = c; location.reload() }
            }}>
              <input name="code" className="min-w-0 flex-1 rounded-lg bg-panel px-2 py-1 font-mono" placeholder="Paste a sync code" aria-label="Sync code to use" />
              <button className={`${btn} ${ghost}`}>Use</button>
            </form>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={`${btn} ${ghost}`} onClick={exportData}>Export JSON</button>
            <label className={`${btn} inline-flex cursor-pointer items-center ${ghost}`}>Import JSON
              <input type="file" className="sr-only" accept="application/json,.json" onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) readFile(f) }} />
            </label>
          </div>
          {incoming && (
            <div role="alert" className="rounded-xl bg-amber/15 p-2 text-sm">
              Replace everything with this file ({incoming.tasks.length} tasks, {incoming.goals.length} goals)? This cannot be undone.
              <div className="mt-2 flex gap-2">
                <button className={`${btn} ${BLUE}`} onClick={() => { setData(migrate(incoming)); setIncoming(null); setMsg('Backup restored.') }}>Replace</button>
                <button className={`${btn} ${ghost}`} onClick={() => setIncoming(null)}>Cancel</button>
              </div>
            </div>
          )}
          {msg && <p role="status" className="text-sm">{msg}</p>}
        </div>
      )}
    </div>
  )
}
