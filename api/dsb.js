// Owner dashboard data: users, content counts and AI token usage / estimated cost. Password lives in the DSB_PASSWORD env var.
import { createHash, timingSafeEqual } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { limit } from './_rate.js'
import { auth } from './_auth.js'

const sql = neon(process.env.DATABASE_URL)
// $ per million tokens [input, output]. claude-haiku-5-5 list price for prompts up to 100K tokens.
const PRICES = { 'claude-haiku-5-5': [0.1, 0.5] }
const cost = (model, i, o) => { const [pi, po] = PRICES[model] || [0, 0]; return (i * pi + o * po) / 1e6 }
const digest = (s) => createHash('sha256').update(String(s)).digest()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  // The owner signed in with DSB_ADMIN_EMAIL (verified) gets in with no password; anyone else needs DSB_PASSWORD.
  const me = (await auth.api.getSession({ headers: new Headers(req.headers) }))?.user
  const owner = me?.emailVerified && process.env.DSB_ADMIN_EMAIL && me.email.toLowerCase() === process.env.DSB_ADMIN_EMAIL.trim().toLowerCase()
  if (!owner) {
    if (!process.env.DSB_PASSWORD) return res.status(503).json({ error: 'Dashboard is not configured' })
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    if (!(await limit(req, res, { scope: 'dsb', max: 30, id: ip }))) return // per visitor; 30 guesses an hour is nothing against 9 digits
    if (!timingSafeEqual(digest(req.body?.password ?? ''), digest(process.env.DSB_PASSWORD))) return res.status(401).json({ error: 'Wrong password' })
  }

  const [[u], [c], byKind, daily, [ai], active, [fun], [r]] = await Promise.all([
    sql`select count(*)::int users, count(*) filter (where "emailVerified")::int verified,
      count(*) filter (where last_seen_at > now() - interval '7 days')::int active7,
      count(*) filter (where exists (select 1 from tasks t where t.user_id = u.id) or exists (select 1 from goals g where g.user_id = u.id)
        or exists (select 1 from projects p where p.user_id = u.id) or exists (select 1 from deadlines d where d.user_id = u.id))::int with_data
      from "user" a left join users u on u.id = a.id`,
    sql`select (select count(*) from tasks)::int tasks, (select count(*) from tasks where done)::int "doneTasks", (select count(*) from projects)::int projects,
      (select count(*) from deadlines)::int deadlines, (select count(*) from goals)::int goals, (select count(*) from hobbies)::int hobbies`,
    sql`select kind, model, count(*)::int calls, sum(input_tokens)::bigint input, sum(output_tokens)::bigint output from ai_calls group by kind, model`,
    sql`select created_at::date::text as day, model, count(*)::int calls, sum(input_tokens)::bigint input, sum(output_tokens)::bigint output from ai_calls where created_at > now() - interval '14 days' group by 1, 2 order by 1`,
    sql`select count(*)::int calls, count(distinct user_id)::int users from ai_calls`,
    sql`select day::text as day, count(*)::int users from user_day where day > current_date - 14 group by 1 order by 1`,
    // Activation funnel, accounts only: how far each one got.
    sql`select count(*)::int signed,
      count(*) filter (where exists (select 1 from tasks t where t.user_id = a.id))::int added,
      count(*) filter (where exists (select 1 from tasks t where t.user_id = a.id and t.done))::int finished,
      count(*) filter (where (select count(*) from tasks t where t.user_id = a.id and t.done) >= 3)::int finished3,
      count(*) filter (where u.settings #>> '{guide,done}' = 'true')::int guide
      from "user" a left join users u on u.id = a.id`,
    // Accounts only. A person counts for a return once they are old enough to have had the chance: day 1 needs a full day since sign-up, day 7 a full week.
    // "Next day" = opened the app the UTC day after signing up; "a week later" = opened it 7 or more days after. Opens are logged in user_day from when it was deployed.
    sql`select count(*) filter (where a."createdAt"::date < current_date)::int eligible1,
      count(*) filter (where a."createdAt"::date < current_date and exists (select 1 from user_day d where d.user_id = a.id and d.day = a."createdAt"::date + 1))::int back1,
      count(*) filter (where a."createdAt"::date <= current_date - 7)::int eligible7,
      count(*) filter (where a."createdAt"::date <= current_date - 7 and exists (select 1 from user_day d where d.user_id = a.id and d.day >= a."createdAt"::date + 7))::int back7,
      count(*) filter (where u.settings ? 'guide')::int guide_started,
      count(*) filter (where u.settings #>> '{guide,done}' = 'true')::int guide_done
      from "user" a left join users u on u.id = a.id`,
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
    counts: { ...u, ...c },
    habit: r,
    funnel: fun,
    active,
    ai: { ...total, users: ai.users },
    kinds: Object.values(kinds).sort((a, b) => b.cost - a.cost),
    daily: Object.values(days),
    prices: PRICES,
  })
}
