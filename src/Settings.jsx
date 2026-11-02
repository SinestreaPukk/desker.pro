import { useState, useEffect, useRef } from 'react'
import { btn, BLUE, ghost } from './ui.js'
import { migrate } from './storage.js'
import { dueReminders } from './reminders.js'
import { uid } from './api.js'
import { importCalendar } from './shared.jsx'

const KEYS = ['goals', 'tasks', 'hobbies', 'deadlines', 'projects', 'busy', 'focus', 'pick', 'freeHours', 'freeToday', 'mood', 'sync', 'energyLog', 'guide', 'legacyDeadlines', 'checkGoalOrder', 'schema', 'events', 'finder']
const store = {
  get: (k) => { try { return localStorage[k] } catch { return undefined } },
  set: (k, v) => { try { localStorage[k] = v } catch { /* storage blocked: the toggle just will not persist */ } },
}

// Imported events only ever come in. Nothing is sent out to other calendars.
function CalendarImport({ data, setData }) {
  const [url, setUrl] = useState(data.sync?.url || '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const run = async (body) => {
    setLoading(true); setMsg('')
    try {
      const events = await importCalendar(body)
      setData((d) => ({ ...d, busy: events, sync: { url: body.url, at: Date.now() } }))
      setMsg(`Imported ${events.length} event${events.length === 1 ? '' : 's'} for the next 5 weeks.`)
    } catch (err) { setMsg(err.message) }
    setLoading(false)
  }
  const small = `${btn} ${ghost}`
  return (
    <section className="space-y-2 text-xs text-slate-600" aria-label="Your calendar">
      <p className="text-sm text-ink">Connect your calendar{data.sync ? ` (${(data.busy || []).length} events)` : ''}</p>
      <p>Show your classes and meetings here. Paste your calendar's private iCal link (in Google: Settings, your calendar, Integrate calendar, "Secret address in iCal format"), or upload an .ics file. Nothing is sent back.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) run({ url: url.trim() }) }}>
        <input className="min-w-0 flex-1 rounded-lg bg-panel px-2 py-1" aria-label="Calendar link" placeholder="https://… or webcal://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className={small} disabled={loading || !url.trim()}>{loading ? 'Reading…' : 'Import'}</button>
      </form>
      <div className="flex flex-wrap gap-2">
        <label className={`${small} inline-flex cursor-pointer items-center ${loading ? 'pointer-events-none opacity-50' : ''}`}>Upload .ics
          <input type="file" className="sr-only" accept=".ics,text/calendar" disabled={loading} onChange={async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) run({ text: await f.text() }) }} />
        </label>
        {data.sync?.url && <button className={small} disabled={loading} onClick={() => run({ url: data.sync.url })}>Refresh</button>}
        {data.sync && <button className={`${small} text-danger`} onClick={() => { setData((d) => ({ ...d, busy: [], sync: undefined })); setUrl(''); setMsg('Disconnected. Imported events removed.') }}>Disconnect</button>}
      </div>
      {msg && <p role="status" className="text-sm text-ink">{msg}</p>}
    </section>
  )
}

// Gear menu: reminders, the timer, your calendar, backup export/import. Also runs the reminder timer (it is always mounted).
export default function Settings({ data, setData, openReq }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (openReq) setOpen(true) }, [openReq])
  const [pomo, setPomo] = useState(() => store.get('pomoMode') === 'pomo')
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
      const due = dueReminders(Date.now(), latest.current.tasks, latest.current.projects || []).filter((r) => !fired.includes(r.key))
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
      <button className="flex h-11 items-center gap-2 rounded-full px-4 text-sm text-slate-700 hover:bg-panel" aria-label="Settings" aria-expanded={open} onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" /></svg>
        Settings
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 max-h-[80dvh] w-80 max-w-[calc(100vw-2rem)] space-y-3 overflow-y-auto rounded-2xl border border-control bg-white p-3 shadow-lg" role="dialog" aria-label="Settings">
          <label className={row}>Reminders
            <input type="checkbox" checked={rem} onChange={(e) => toggle(e.target.checked)} />
          </label>
          <p className="text-xs text-slate-600">Notifies you at a task's reminder time, and 1 day and 1 hour before something is due.</p>
          <hr className="border-black/5" />
          <label className={row}>Pomodoro timer
            <input type="checkbox" checked={pomo} onChange={(e) => { store.set('pomoMode', e.target.checked ? 'pomo' : ''); setPomo(e.target.checked) }} />
          </label>
          <p className="text-xs text-slate-600">Start opens a plain timer. Turn this on for focus and break rounds.</p>
          <hr className="border-black/5" />
          <CalendarImport data={data} setData={setData} />
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
