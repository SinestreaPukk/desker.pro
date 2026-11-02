import { useState, useEffect, useRef, useCallback } from 'react'
import { stateUrl } from './api.js'
import { migrate } from './storage.js'
import { diff, apply, isEmpty } from './sync.js'

// Loads the account, keeps it saved and keeps it fresh. See src/sync.js for how changes are merged.
//   save:    after every edit (half a second later) only what changed since the last server copy is sent. The server lays it on top of
//            whatever is stored, so being "out of date" is never a reason to refuse an edit.
//   fresh:   other tabs get a BroadcastChannel nudge; other devices are noticed when this window gets focus again and by a cheap check every 30 s.
//            Anything new is merged in underneath the edits made here that have not been saved yet.
//   failing: an edit is never thrown away. It stays in the app (and in this browser's storage, in case the page is closed), a retry runs
//            with growing gaps and when the connection comes back, and the status says "offline" only after repeated failures.
// status: 'saved' | 'saving' | 'offline'
const clone = (x) => JSON.parse(JSON.stringify(x))
const json = { 'content-type': 'application/json' }

export function useSync(userId) {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState('saved')
  const base = useRef(null) // the last copy the server gave us
  const rev = useRef(0)
  const latest = useRef(null)
  const busy = useRef(false), again = useRef(false), fails = useRef(0)
  const timer = useRef(0), retry = useRef(0)
  const chan = useRef(null)
  const store = `desker.unsaved.${userId || 'me'}`
  const cache = `desker.cache.${userId || 'me'}`
  latest.current = data

  const keep = useCallback(() => { // unsaved edits survive closing the page
    try {
      if (!base.current || !latest.current || isEmpty(diff(base.current, latest.current))) localStorage.removeItem(store)
      else localStorage.setItem(store, JSON.stringify({ base: base.current, data: latest.current }))
    } catch { /* storage full or blocked: the edits are still in the app */ }
  }, [store])

  const remember = useCallback((doc) => { // last server copy, so the next visit shows the app at once while the real one loads
    try { localStorage.setItem(cache, JSON.stringify(doc)) } catch { /* storage full: next visit just waits for the network */ }
  }, [cache])

  const flush = useCallback(async () => {
    clearTimeout(retry.current)
    if (!base.current || !latest.current) return
    if (busy.current) { again.current = true; return }
    const patch = diff(base.current, latest.current)
    if (isEmpty(patch)) { setStatus('saved'); keep(); return }
    busy.current = true; setStatus('saving')
    const sent = clone(latest.current)
    try {
      keep()
      const r = await fetch(stateUrl, { method: 'PATCH', keepalive: true, headers: json, body: JSON.stringify({ patch }) })
      if (!r.ok) throw new Error(String(r.status))
      const out = await r.json()
      const fresh = migrate(out.doc)
      base.current = fresh; rev.current = out.rev ?? out.doc._rev ?? rev.current; fails.current = 0; remember(fresh)
      // what the server now holds beyond what we sent (another device's edits), plus edits made while this save was on its way
      setData((d) => (isEmpty(diff(sent, fresh)) && isEmpty(diff(sent, d)) ? d : apply(fresh, diff(sent, d))))
      chan.current?.postMessage({ rev: rev.current })
    } catch {
      fails.current += 1
      setStatus(fails.current >= 3 ? 'offline' : 'saving')
      retry.current = setTimeout(flush, Math.min(60_000, 2000 * 2 ** fails.current))
    }
    busy.current = false
    if (fails.current === 0) {
      if (again.current) { again.current = false; flush() } else { setStatus('saved'); keep() }
    } else again.current = false
  }, [keep, remember])

  const refresh = useCallback(async () => {
    if (!base.current || busy.current) return
    try {
      const r = await fetch(`${stateUrl}?rev=1`)
      if (!r.ok) return
      if ((await r.json()).rev === rev.current) return
      const full = await fetch(stateUrl)
      if (!full.ok || busy.current) return
      const doc = await full.json()
      const pending = diff(base.current, latest.current)
      const fresh = migrate(doc)
      base.current = fresh; rev.current = doc._rev || 0; remember(fresh)
      setData(apply(fresh, pending))
    } catch { /* offline: try again at the next check */ }
  }, [remember])

  // first load: show the cached copy (plus anything left unsaved) at once, then lay the server's copy under whatever was edited meanwhile
  useEffect(() => {
    let stop = false
    const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
    const cached = read(cache)
    const left = read(store)
    const withLeft = (doc) => (left?.base && left?.data ? apply(doc, diff(left.base, left.data)) : doc)
    if (cached) { const c = migrate(cached); base.current = c; rev.current = cached._rev || 0; setData(withLeft(c)) }
    fetch(stateUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load your data')))).then((doc) => {
      if (stop) return
      const fresh = migrate(doc)
      if (base.current && (doc._rev || 0) < rev.current) return // a save already brought something newer
      const pending = base.current && latest.current ? diff(base.current, latest.current) : null
      base.current = fresh; rev.current = doc._rev || 0; remember(fresh)
      setData(pending ? apply(fresh, pending) : withLeft(fresh))
    }).catch((e) => !stop && !base.current && setLoadError(e.message))
    return () => { stop = true }
  }, [store, cache, remember])

  // save after edits
  useEffect(() => {
    if (!data) return
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 500)
    return () => clearTimeout(timer.current)
  }, [data, flush])

  // keep fresh: other tabs, other devices, coming back online, closing the page
  useEffect(() => {
    const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel(`desker-sync-${userId || 'me'}`) : null
    chan.current = bc
    if (bc) bc.onmessage = (e) => { if (e.data?.rev !== rev.current) refresh() }
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    const online = () => { fails.current = 0; flush(); refresh() }
    const leave = () => { keep(); if (latest.current && base.current && !isEmpty(diff(base.current, latest.current))) flush() }
    document.addEventListener('visibilitychange', visible); addEventListener('focus', visible); addEventListener('online', online); addEventListener('pagehide', leave)
    const poll = setInterval(visible, 30_000)
    return () => { bc?.close(); chan.current = null; clearInterval(poll); document.removeEventListener('visibilitychange', visible); removeEventListener('focus', visible); removeEventListener('online', online); removeEventListener('pagehide', leave) }
  }, [userId, refresh, flush, keep])

  const save = useCallback(() => { fails.current = 0; return flush() }, [flush]) // the Save button: send now, don't wait for the half-second timer or a retry gap
  return { data, setData, loadError, status, save }
}
