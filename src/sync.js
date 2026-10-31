// Saving by change, not by whole document. Two tabs or two devices can edit the same account at once without losing each other's work.
//
//   diff(base, data)  -> a patch: only what this device changed since `base` (the last copy it got from the server)
//   apply(doc, patch) -> the document with that patch laid on top (used by the server, and by the client to re-apply its own pending edits
//                        on top of a newer server copy)
//
// Rules, per kind of data:
//   records (tasks, deadlines, goals, projects, hobbies): added, deleted and edited one field at a time. Edits to different records never
//     interact; edits to different fields of one record both survive; the same field edited twice: whichever change arrives last wins.
//   append-only lists (energy check-ins, timings, focus sessions, signals, wrap-up days): merged by identity, so nothing another device
//     added is ever dropped. A device can still remove an item it deliberately removed (it knows the item was in `base`).
//   everything else in the settings (name, scene, onboarding, ...): one value per path, last change wins. `xp` only ever goes up.
// Pure functions, no I/O, shared by the app and the API.

export const COLLECTIONS = ['goals', 'hobbies', 'projects', 'deadlines', 'tasks']
const MAX_DEPTH = 3

// Settings lists that only grow, with how to tell two entries apart and how many to keep (the same caps the rhythm module uses).
const LISTS = {
  energyLog: { key: (e) => e?.at, cap: 500 },
  'rhythm.outcomes': { key: (o) => `${o?.task}|${o?.src}|${o?.at}`, cap: 300 },
  'rhythm.sessions': { key: (s) => JSON.stringify([s?.start ?? s?.at ?? s?.id, s?.task]), cap: 150 },
  'rhythm.signals': { key: (s) => `${s?.k}|${s?.at}|${s?.task}`, cap: 150 },
  'kodama.rituals.morning': { key: String, cap: 120 },
  'kodama.rituals.evening': { key: String, cap: 120 },
}
const SKIP = new Set(['_rev']) // the server's own version counter is never part of a patch

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))

// ---- settings as flat paths -------------------------------------------------------------------------------------
function leaves(value, path, out) {
  if (LISTS[path]) { out[path] = Array.isArray(value) ? value : []; return }
  if (isObj(value) && path.split('.').length < MAX_DEPTH && Object.keys(value).length) {
    for (const [k, v] of Object.entries(value)) leaves(v, `${path}.${k}`, out)
    return
  }
  out[path] = value
}
const flat = (doc) => {
  const out = {}
  for (const [k, v] of Object.entries(doc || {})) if (!COLLECTIONS.includes(k) && !SKIP.has(k) && v !== undefined) leaves(v, k, out)
  for (const p of Object.keys(LISTS)) if (!(p in out) && getPath(doc, p) !== undefined) out[p] = getPath(doc, p)
  return out
}
const getPath = (doc, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), doc)
function setPath(doc, path, value) {
  const keys = path.split('.')
  const root = { ...doc }
  let o = root
  keys.forEach((k, i) => {
    if (i === keys.length - 1) { if (value === undefined) delete o[k]; else o[k] = value; return }
    o[k] = isObj(o[k]) ? { ...o[k] } : {}
    o = o[k]
  })
  return root
}

// ---- diff -------------------------------------------------------------------------------------------------------
export function diff(base = {}, data = {}) {
  const patch = { c: {}, s: { set: {}, add: {}, rem: {} } }
  for (const t of COLLECTIONS) {
    const was = new Map((base[t] || []).map((r) => [r.id, r])), now = data[t] || []
    const ch = {}
    const seen = new Set()
    for (const r of now) {
      if (!r || r.id === undefined || seen.has(r.id)) continue
      seen.add(r.id)
      const old = was.get(r.id)
      if (!old) { (ch.add ||= []).push(r); continue }
      const f = {}
      for (const k of new Set([...Object.keys(old), ...Object.keys(r)])) if (k !== 'id' && !same(old[k], r[k])) f[k] = r[k] === undefined ? null : r[k]
      if (Object.keys(f).length) (ch.up ||= {})[r.id] = f
    }
    const del = [...was.keys()].filter((id) => !seen.has(id))
    if (del.length) ch.del = del
    if (Object.keys(ch).length) patch.c[t] = ch
  }
  const a = flat(base), b = flat(data)
  for (const p of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const list = LISTS[p]
    if (list) {
      const was = new Map((a[p] || []).map((x) => [list.key(x), x])), now = new Map((b[p] || []).map((x) => [list.key(x), x]))
      const add = [...now].filter(([k]) => !was.has(k)).map(([, x]) => x), rem = [...was.keys()].filter((k) => !now.has(k))
      if (add.length) patch.s.add[p] = add
      if (rem.length) patch.s.rem[p] = rem
    } else if (!same(a[p], b[p])) patch.s.set[p] = b[p] === undefined ? null : b[p]
  }
  return patch
}

export const isEmpty = (p) => !p || (!Object.keys(p.c || {}).length && !Object.keys(p.s?.set || {}).length && !Object.keys(p.s?.add || {}).length && !Object.keys(p.s?.rem || {}).length)

// ---- apply ------------------------------------------------------------------------------------------------------
export function apply(doc = {}, patch) {
  if (isEmpty(patch)) return doc
  let out = { ...doc }
  for (const [t, ch] of Object.entries(patch.c || {})) {
    if (!COLLECTIONS.includes(t)) continue
    let list = [...(out[t] || [])]
    const gone = new Set(ch.del || [])
    if (gone.size) list = list.filter((r) => !gone.has(r.id))
    const at = new Map(list.map((r, i) => [r.id, i]))
    const edit = (id, fields) => {
      const i = at.get(id)
      if (i === undefined) return
      const next = { ...list[i] }
      for (const [k, v] of Object.entries(fields)) { if (k === 'id') continue; if (v === null) delete next[k]; else next[k] = v }
      list[i] = next
    }
    for (const r of ch.add || []) {
      if (gone.has(r.id)) continue
      if (at.has(r.id)) edit(r.id, r) // already there (the same add arriving twice, or from two devices): merge, never duplicate
      else { at.set(r.id, list.length); list.push(clone(r)) }
    }
    for (const [id, f] of Object.entries(ch.up || {})) edit(Number.isNaN(+id) ? id : +id, f)
    out[t] = list
  }
  for (const [p, value] of Object.entries(patch.s?.set || {})) {
    if (p === 'xp') { out = setPath(out, p, Math.max(+getPath(out, p) || 0, +value || 0)); continue }
    out = setPath(out, p, value === null ? undefined : clone(value))
  }
  for (const p of new Set([...Object.keys(patch.s?.add || {}), ...Object.keys(patch.s?.rem || {})])) {
    const list = LISTS[p]
    if (!list) continue
    const rem = new Set(patch.s.rem?.[p] || [])
    const cur = (Array.isArray(getPath(out, p)) ? getPath(out, p) : []).filter((x) => !rem.has(list.key(x)))
    const have = new Set(cur.map(list.key))
    for (const x of patch.s.add?.[p] || []) if (!have.has(list.key(x))) { have.add(list.key(x)); cur.push(clone(x)) }
    out = setPath(out, p, cur.slice(-list.cap))
  }
  return out
}
