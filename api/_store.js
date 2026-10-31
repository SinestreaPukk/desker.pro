// Relational store behind /api/state, /api/v1 and the calendar feed. The app still speaks one document
// ({ goals, tasks, projects, ... }); this file maps it to the tables in db/schema.sql and back.
// Unknown fields survive in each row's `extra` jsonb, so a new client field never needs a migration to keep working.
import { neon } from '@neondatabase/serverless'

export const sql = neon(process.env.DATABASE_URL)

// [clientKey, column, type]. Types: id (bigint reference), int, num, bool, text, date, json.
export const SPEC = {
  goals: [['title', 'title', 'text'], ['level', 'level', 'int'], ['happiness', 'happiness', 'bool']],
  hobbies: [['title', 'title', 'text']],
  projects: [['title', 'title', 'text'], ['kind', 'kind', 'text'], ['date', 'end_date', 'date'], ['hours', 'hours', 'num'], ['context', 'context', 'text'], ['goalId', 'goal_id', 'id']],
  deadlines: [['title', 'title', 'text'], ['date', 'due_date', 'date'], ['time', 'due_time', 'text'], ['hours', 'hours', 'num'], ['context', 'context', 'text'], ['projectId', 'project_id', 'id']],
  tasks: [['title', 'title', 'text'], ['done', 'done', 'bool'], ['doneAt', 'done_at', 'int'], ['fun', 'fun', 'bool'], ['due', 'due_date', 'date'], ['when', 'plan_date', 'date'],
    ['start', 'start_time', 'text'], ['hours', 'hours', 'num'], ['spent', 'spent', 'num'], ['readiness', 'readiness', 'int'], ['important', 'important', 'bool'], ['urgent', 'urgent', 'bool'],
    ['manual', 'manual', 'bool'], ['reason', 'reason', 'text'], ['happy', 'happy', 'int'], ['repeat', 'repeat_rule', 'text'], ['subs', 'subs', 'json'],
    ['goalId', 'goal_id', 'id'], ['projectId', 'project_id', 'id'], ['deadlineId', 'deadline_id', 'id']],
}
const ORDER = ['goals', 'hobbies', 'projects', 'deadlines', 'tasks'] // parents before children
const SQLTYPE = { id: 'bigint', int: 'bigint', num: 'numeric', bool: 'boolean', text: 'text', date: 'date', json: 'jsonb' }
export const SETTINGS = ['onboarding', 'busy', 'focus', 'pick', 'freeHours', 'freeToday', 'mood', 'sync', 'energyLog', 'guide', 'xp']

const coerce = {
  id: (v) => (Number.isSafeInteger(v) ? v : null),
  int: (v) => (Number.isFinite(v) ? Math.round(v) : null),
  num: (v) => (Number.isFinite(v) ? v : null),
  bool: (v) => (typeof v === 'boolean' ? v : null),
  text: (v) => (typeof v === 'string' ? v.slice(0, 5000) : null),
  date: (v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null),
  json: (v) => (v && typeof v === 'object' ? v : null),
}

export const hasContent = (doc) => ORDER.some((t) => Array.isArray(doc[t]) && doc[t].length > 0)

// Document -> rows for every table, with links to rows that do not exist nulled out (so foreign keys always hold).
export function toRows(doc) {
  const rows = {}, ids = {}
  for (const t of ORDER) {
    const byId = new Map()
    ;(Array.isArray(doc[t]) ? doc[t] : []).forEach((item, pos) => {
      if (!item || !Number.isSafeInteger(item.id)) return
      const row = { id: item.id, pos }
      const known = new Set(['id'])
      for (const [key, col, type] of SPEC[t]) {
        known.add(key)
        row[col] = coerce[type](item[key])
      }
      if (t === 'goals') { row.level ??= 3; row.happiness ??= false }
      if ((t === 'deadlines' ? ['title', 'due_date'] : ['title']).some((c) => row[c] === null || row[c] === '')) return // required columns
      row.extra = Object.fromEntries(Object.entries(item).filter(([k]) => !known.has(k)))
      byId.set(item.id, row)
    })
    rows[t] = [...byId.values()]
    ids[t] = new Set(byId.keys())
  }
  const links = { goal_id: 'goals', project_id: 'projects', deadline_id: 'deadlines' }
  for (const t of ['deadlines', 'projects', 'tasks']) for (const r of rows[t]) for (const [col, parent] of Object.entries(links)) if (col in r && r[col] !== null && !ids[parent].has(r[col])) r[col] = null
  return rows
}

// Database row -> the object the app expects. Null columns are left out, as "not set" and "undefined" mean the same to the app.
export function fromRow(t, row) {
  const item = { id: Number(row.id) }
  for (const [key, col, type] of SPEC[t]) {
    const v = row[col]
    if (v === null || v === undefined) continue
    item[key] = type === 'id' || type === 'int' || type === 'num' ? Number(v) : v
  }
  return Object.assign(item, row.extra)
}

const cols = (t) => SPEC[t].map(([, c]) => c)
const upsert = (t, uid, list) => {
  const c = ['id', 'pos', ...cols(t), 'extra']
  const defs = ['id bigint', 'pos int', ...SPEC[t].map(([, col, type]) => `${col} ${SQLTYPE[type]}`), 'extra jsonb']
  const set = c.filter((x) => x !== 'id').map((x) => `${x} = excluded.${x}`).join(', ')
  const mine = c.filter((x) => x !== 'id').map((x) => `t.${x}`).join(', '), theirs = c.filter((x) => x !== 'id').map((x) => `excluded.${x}`).join(', ')
  // rows that did not change are not rewritten, so a save costs by what changed, not by the size of the workspace
  return [`insert into ${t} as t (user_id, ${c.join(', ')}) select $1::text, x.* from jsonb_to_recordset($2::jsonb) as x(${defs.join(', ')})
           on conflict (user_id, id) do update set ${set}, updated_at = now() where (${mine}) is distinct from (${theirs})`, [uid, JSON.stringify(list)]]
}

// `rev` is the version the client last saw (users.settings._rev). Pass it and a save from a stale copy throws Error('conflict')
// instead of overwriting newer data; omit it (API keys, first-sign-in claim) to save unconditionally. Every save bumps the version.
// The check row-locks the user, so two saves racing for the same user serialise. Returns the new version.
export async function saveDoc(uid, doc, rev = null) {
  const rows = toRows(doc)
  const settings = JSON.stringify(Object.fromEntries(SETTINGS.filter((k) => doc[k] !== undefined).map((k) => [k, doc[k]])))
  const next = `$2::jsonb || jsonb_build_object('_rev', coalesce((select (settings->>'_rev')::bigint from users where id = $1), 0) + 1)`
  const q = [
    [`select 1 / (case when $2::bigint is null or coalesce((select (settings->>'_rev')::bigint from users where id = $1 for update), 0) = $2::bigint then 1 else 0 end)`, [uid, rev]], // 22012 when stale
    hasContent(doc)
      ? [`insert into users (id, settings) values ($1, ${next}) on conflict (id) do update set settings = excluded.settings, last_seen_at = now() returning (settings->>'_rev')::bigint as rev`, [uid, settings]]
      : [`update users set settings = ${next}, last_seen_at = now() where id = $1 returning (settings->>'_rev')::bigint as rev`, [uid, settings]], // an empty visitor never gets a row
  ]
  for (const t of ORDER) if (rows[t].length) q.push(upsert(t, uid, rows[t]))
  for (const t of [...ORDER].reverse()) q.push([`delete from ${t} where user_id = $1 and not (id = any($2::bigint[]))`, [uid, rows[t].map((r) => r.id)]])
  try {
    const out = await sql.transaction((txn) => q.map(([text, params]) => txn.query(text, params)))
    return Number(out[1][0]?.rev ?? 0)
  } catch (e) {
    if (e?.code === '22012') throw Object.assign(new Error('conflict'), { conflict: true })
    throw e
  }
}

const DATES = new Set(['date'])
const pick = (t) => ['id', 'extra', ...SPEC[t].map(([, c, type]) => (DATES.has(type) ? `to_char(${c}, 'YYYY-MM-DD') as ${c}` : c))].join(', ')

export async function loadDoc(uid) {
  const out = await sql.transaction((txn) => [
    txn.query('update users set last_seen_at = now() where id = $1 returning settings', [uid]),
    ...ORDER.map((t) => txn.query(`select ${pick(t)} from ${t} where user_id = $1 order by pos, id`, [uid])),
  ])
  const [[user], ...lists] = out
  const doc = { ...(user?.settings ?? {}) }
  ORDER.forEach((t, i) => { doc[t] = lists[i].map((r) => fromRow(t, r)) })
  return doc
}
