// Owner dashboard data: users, content counts and AI token usage / estimated cost. Password lives in the DSB_PASSWORD env var.
import { createHash, timingSafeEqual } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { limit } from './_rate.js'

const sql = neon(process.env.DATABASE_URL)
// $ per million tokens [input, output]. claude-haiku-5-5 list price for prompts up to 100K tokens.
const PRICES = { 'claude-haiku-5-5': [0.1, 0.5] }
const cost = (model, i, o) => { const [pi, po] = PRICES[model] || [0, 0]; return (i * pi + o * po) / 1e6 }
const digest = (s) => createHash('sha256').update(String(s)).digest()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!process.env.DSB_PASSWORD) return res.status(503).json({ error: 'Dashboard is not configured' })
  if (!(await limit(req, res, { scope: 'dsb', max: 10 }))) return // 9-digit password: slow down guessing
  if (!timingSafeEqual(digest(req.body?.password ?? ''), digest(process.env.DSB_PASSWORD))) return res.status(401).json({ error: 'Wrong password' })

  await sql`create table if not exists usage (uid text, kind text, model text, input_tokens int, output_tokens int, ts timestamptz default now())`
  const [[c], [done], byKind, daily, [ai]] = await Promise.all([
    sql`select count(*)::int users,
      count(*) filter (where updated_at > now() - interval '7 days')::int active7,
      count(*) filter (where jsonb_array_length(coalesce(data->'tasks','[]'::jsonb)) + jsonb_array_length(coalesce(data->'goals','[]'::jsonb)) + jsonb_array_length(coalesce(data->'projects','[]'::jsonb)) > 0)::int with_data,
      coalesce(sum(jsonb_array_length(coalesce(data->'tasks','[]'::jsonb))), 0)::int tasks,
      coalesce(sum(jsonb_array_length(coalesce(data->'projects','[]'::jsonb))), 0)::int projects,
      coalesce(sum(jsonb_array_length(coalesce(data->'deadlines','[]'::jsonb))), 0)::int deadlines,
      coalesce(sum(jsonb_array_length(coalesce(data->'goals','[]'::jsonb))), 0)::int goals,
      coalesce(sum(jsonb_array_length(coalesce(data->'hobbies','[]'::jsonb))), 0)::int hobbies
      from workspaces`,
    sql`select count(*)::int n from workspaces w, jsonb_array_elements(coalesce(w.data->'tasks','[]'::jsonb)) t where t->>'done' = 'true'`,
    sql`select kind, model, count(*)::int calls, sum(input_tokens)::bigint input, sum(output_tokens)::bigint output from usage group by kind, model`,
    sql`select ts::date::text as day, model, count(*)::int calls, sum(input_tokens)::bigint input, sum(output_tokens)::bigint output from usage where ts > now() - interval '14 days' group by 1, 2 order by 1`,
    sql`select count(*)::int calls, count(distinct uid)::int users from usage`,
  ])
  const kinds = {}
  for (const r of byKind) {
    const k = (kinds[r.kind] ||= { kind: r.kind, calls: 0, input: 0, output: 0, cost: 0 })
    k.calls += r.calls; k.input += Number(r.input); k.output += Number(r.output); k.cost += cost(r.model, Number(r.input), Number(r.output))
  }
  const days = {}
  for (const r of daily) {
    const d = (days[r.day] ||= { day: r.day, calls: 0, tokens: 0, cost: 0 })
    d.calls += r.calls; d.tokens += Number(r.input) + Number(r.output); d.cost += cost(r.model, Number(r.input), Number(r.output))
  }
  const total = Object.values(kinds).reduce((t, k) => ({ calls: t.calls + k.calls, input: t.input + k.input, output: t.output + k.output, cost: t.cost + k.cost }), { calls: 0, input: 0, output: 0, cost: 0 })
  res.json({
    counts: { ...c, doneTasks: done.n },
    ai: { ...total, users: ai.users },
    kinds: Object.values(kinds).sort((a, b) => b.cost - a.cost),
    daily: Object.values(days),
    prices: PRICES,
  })
}
