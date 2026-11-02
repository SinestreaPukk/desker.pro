import { villageExport } from './village.js'
import { useState, useEffect, useRef } from 'react'
import { btn, BLUE, ghost, input, DANGER } from './ui.js'
import { migrate } from './storage.js'
import { dueReminders } from './reminders.js'
import { authClient, useSession } from './auth.js'
import { Icon } from './icons.jsx'
import { preference, setPreference } from './theme.js'
import { pushSupported, subscribe, unsubscribe } from './push.js'
import { nameOf } from './kodama.js'
import { QUIET } from './pushPlan.js'

const KEYS = ['goals', 'tasks', 'hobbies', 'deadlines', 'projects', 'busy', 'focus', 'pick', 'freeHours', 'freeToday', 'mood', 'sync', 'energyLog', 'rhythm', 'kodama', 'xp', 'scene', 'chat']
const store = {
  get: (k) => { try { return localStorage[k] } catch { return undefined } },
  set: (k, v) => { try { localStorage[k] = v } catch { /* storage blocked: the toggle just will not persist */ } },
}

// Gear menu: reminders, backup export/import. Also runs the reminder timer (it is always mounted).
// row: a labelled sidebar entry whose panel opens upward; otherwise a round icon button.
export default function Settings({ data, setData, row: inSidebar }) {
  const [open, setOpen] = useState(false)
  const user = useSession().data.user
  const [rem, setRem] = useState(() => store.get('reminders') === '1' && 'Notification' in window && Notification.permission === 'granted')
  const [msg, setMsg] = useState('')
  const [del, setDel] = useState(false)
  const [showKey, setShowKey] = useState(false)
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
  const exportData = async () => {
    const village = await villageExport() // Kodama Village data, if you have any (null if not, or if the village can't be reached)
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([JSON.stringify(village ? { ...data, village } : data, null, 2)], { type: 'application/json' })),
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
          <label className={row}>Appearance
            <select className={`${input} w-40`} defaultValue={preference()} onChange={(e) => setPreference(e.target.value)}>
              <option value="auto">Match my device</option><option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </label>
          <hr />
          <label className={row}>Reminders
            <input type="checkbox" checked={rem} onChange={(e) => toggle(e.target.checked)} />
          </label>
          <p className="text-xs text-slate-700">Notifies you at a task's start time, and 1 day and 1 hour before a deadline.</p>
          {pushSupported() && (
            <>
              <label className={row}>Notes from {nameOf(data)}
                <input type="checkbox" checked={!!data.push?.on} onChange={async (e) => {
                  setMsg('')
                  if (!e.target.checked) { await unsubscribe(); return setData((d) => ({ ...d, push: { ...d.push, on: false, sub: undefined } })) }
                  try { const got = await subscribe(); setData((d) => ({ ...d, push: { quiet: QUIET, ...d.push, ...got, on: true } })) } catch (err) { setMsg(err.message) }
                }} />
              </label>
              <p className="text-xs text-slate-700">At most two a day, a morning and an evening one, even when Desker is closed. None during quiet hours, and none if you have been away.</p>
              {data.push?.on && (
                <div className="flex items-center gap-2 text-base">Quiet from
                  <input type="time" className={`${input} w-28`} aria-label="Quiet hours start" value={data.push.quiet?.from || QUIET.from} onChange={(e) => setData((d) => ({ ...d, push: { ...d.push, quiet: { ...(d.push.quiet || QUIET), from: e.target.value || QUIET.from } } }))} />
                  to
                  <input type="time" className={`${input} w-28`} aria-label="Quiet hours end" value={data.push.quiet?.to || QUIET.to} onChange={(e) => setData((d) => ({ ...d, push: { ...d.push, quiet: { ...(d.push.quiet || QUIET), to: e.target.value || QUIET.to } } }))} />
                </div>
              )}
            </>
          )}
          <hr />
          <p className="text-xs text-slate-700">Signed in as {user.displayUsername || user.name} ({user.email}). Your data is saved to your account and follows you to any device. <a className="underline" href="/privacy">Privacy</a> · <a className="underline" href="/terms">Terms</a></p>
          <button className={`${btn} ${ghost}`} onClick={() => authClient.signOut().then(() => location.assign('/today'))}>Sign out</button>
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
          <details>
            <summary className="underline">Advanced</summary>
            <div className="mt-2 text-xs text-slate-700">
              <p>Developer API key. It lets scripts add and read your tasks, so keep it private.</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <input readOnly className={`${input} w-full text-xs`} aria-label="Your API key" value={showKey ? user.id : `••••-${user.id.slice(-5)}`} onFocus={(e) => e.target.select()} />
                <button className={`${btn} ${ghost}`} aria-pressed={showKey} onClick={() => setShowKey(!showKey)}>{showKey ? 'Hide' : 'Reveal'}</button>
                <button className={`${btn} ${ghost}`} onClick={() => navigator.clipboard?.writeText(user.id).then(() => setMsg('API key copied.'), () => setMsg('Could not copy. Reveal it and copy by hand.'))}>Copy</button>
              </div>
            </div>
          </details>
          <hr />
          <section className="border border-danger p-2" aria-label="Danger zone">
            <h3 className="text-base text-danger">Danger zone</h3>
            {del ? (
              <div role="alert" className="mt-1 text-base">
                Delete your account and everything in it (tasks, goals, projects)? We email you a link to confirm. This cannot be undone.
                <div className="mt-2 flex gap-2">
                  <button className={`${btn} ${DANGER}`} onClick={async () => {
                    const { error } = await authClient.deleteUser({ callbackURL: '/today' })
                    setDel(false); setMsg(error ? error.message || 'Could not start deletion.' : 'Check your email for the confirmation link.')
                  }}>Send link</button>
                  <button className={`${btn} ${ghost}`} onClick={() => setDel(false)}>Cancel</button>
                </div>
              </div>
            ) : <button className={`${btn} ${DANGER} mt-1`} onClick={() => setDel(true)}>Delete account</button>}
          </section>
          {msg && <p role="status" className="text-base">{msg}</p>}
        </div>
      )}
    </div>
  )
}
