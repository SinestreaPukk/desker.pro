// Pure helpers for the public tasks API: whitelist and validate fields, then apply create / update / delete to a task list.
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const FIELDS = {
  title: (v) => typeof v === 'string' && v.trim() && v.length <= 200 && v.trim(),
  important: (v) => typeof v === 'boolean',
  urgent: (v) => typeof v === 'boolean',
  done: (v) => typeof v === 'boolean',
  due: (v) => DATE.test(v),
  when: (v) => DATE.test(v),
  start: (v) => TIME.test(v),
  hours: (v) => typeof v === 'number' && v > 0 && v <= 100,
  projectId: (v) => Number.isSafeInteger(v),
  readiness: (v) => Number.isInteger(v) && v >= 0 && v <= 100,
}

// Returns the cleaned fields, or null if any is invalid. Unknown fields are ignored.
export function clean(body) {
  const out = {}
  for (const [k, ok] of Object.entries(FIELDS)) {
    if (body?.[k] === undefined) continue
    const r = ok(body[k])
    if (!r) return null
    out[k] = typeof r === 'string' ? r : body[k]
  }
  return out
}

// op: 'create' | 'update' | 'delete'. Returns { tasks, task } or { error, status }.
export function apply(tasks, op, id, body, now = Date.now()) {
  if (tasks.length >= 50 && op === 'create') return { error: 'Task limit (50) reached', status: 409 }
  if (op === 'create') {
    const f = clean(body)
    if (!f?.title) return { error: 'title is required; check field formats', status: 400 }
    const task = { id: now, ...f }
    return { tasks: [...tasks, task], task }
  }
  const t = tasks.find((x) => x.id === id)
  if (!t) return { error: 'Task not found', status: 404 }
  if (op === 'delete') return { tasks: tasks.filter((x) => x !== t), task: t }
  const f = clean(body)
  if (!f) return { error: 'Invalid field', status: 400 }
  const task = { ...t, ...f }
  return { tasks: tasks.map((x) => (x === t ? task : x)), task }
}
