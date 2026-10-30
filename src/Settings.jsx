import { useState, useEffect, useRef } from 'react'
import { btn, BLUE, ghost, input } from './ui.js'
import { migrate } from './storage.js'
import { dueReminders } from './reminders.js'
import { uid } from './api.js'
import { Avatar, AVATARS, DEFAULT_AVATAR } from './px.jsx'
import { Icon } from './icons.jsx'

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
  const row = 'flex items-center justify-between gap-3 text-base'
  return (
    <div className="relative shrink-0">
      <button className={`${btn} gap-2 ${inSidebar ? 'w-full justify-start' : ''}`} aria-label="Settings" aria-expanded={open} onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
        <Icon name="Settings" />
        Settings
      </button>
      {open && (
        <div className={`px-panel absolute z-40 w-72 ${inSidebar ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2'} space-y-3 p-3`} role="dialog" aria-label="Settings">
          <label className={row}>Reminders
            <input type="checkbox" checked={rem} onChange={(e) => toggle(e.target.checked)} />
          </label>
          <p className="text-xs text-slate-700">Notifies you at a task's start time, and 1 day and 1 hour before a deadline.</p>
          <fieldset>
            <legend>Your avatar</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {AVATARS.map(([id, name]) => (
                <label key={id} className="px-sunk flex cursor-pointer justify-center py-1 has-checked:outline-2 has-checked:outline-ink has-focus-visible:outline-2 has-focus-visible:outline-ink">
                  <input type="radio" name="avatar" className="sr-only" checked={(data.avatar || DEFAULT_AVATAR) === id} onChange={() => setData((d) => ({ ...d, avatar: id }))} />
                  <Avatar id={id} label={name} />
                </label>
              ))}
            </div>
          </fieldset>
          <hr />
          <p className="text-xs text-slate-700">Your data lives on our server under an anonymous id tied to this browser. Export a backup to keep it safe or to move it.</p>
          <div className="text-xs text-slate-700">
            <p>Sync code (also your API key, see README). Keep it private; paste it on another device to open this workspace there.</p>
            <input readOnly className={`${input} mt-1 w-full font-mono text-xs`} aria-label="Your sync code" value={uid} onFocus={(e) => e.target.select()} />
            <form className="mt-2 flex gap-2" onSubmit={(e) => {
              e.preventDefault()
              const c = e.target.code.value.trim()
              if (!/^[0-9a-f-]{36}$/.test(c)) return setMsg('That is not a sync code.')
              if (c !== uid && confirm('Switch to this workspace? Export a backup first if this device has data you want to keep.')) { localStorage.uid = c; location.reload() }
            }}>
              <input name="code" className={`${input} min-w-0 flex-1 font-mono text-xs`} placeholder="Paste a sync code" aria-label="Sync code to use" />
              <button className={`${btn} ${ghost}`}>Use code</button>
            </form>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={`${btn} ${ghost}`} onClick={exportData}>Export JSON</button>
            <label className={`${btn} inline-flex cursor-pointer items-center ${ghost}`}>Import JSON
              <input type="file" className="sr-only" accept="application/json,.json" onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) readFile(f) }} />
            </label>
          </div>
          {incoming && (
            <div role="alert" className=" bg-yuki-1 p-2 text-base">
              Replace everything with this file ({incoming.tasks.length} tasks, {incoming.goals.length} goals)? This cannot be undone.
              <div className="mt-2 flex gap-2">
                <button className={`${btn} ${BLUE}`} onClick={() => { setData(migrate(incoming)); setIncoming(null); setMsg('Backup restored.') }}>Replace</button>
                <button className={`${btn} ${ghost}`} onClick={() => setIncoming(null)}>Cancel</button>
              </div>
            </div>
          )}
          {msg && <p role="status" className="text-base">{msg}</p>}
        </div>
      )}
    </div>
  )
}
