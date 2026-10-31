// Beta health numbers for the owner dashboard (/dsb): retention, "moat health" (is the rhythm engine getting better?) and "companion health".
// Everything that can be worked out from data the app already stores is (user_day, tasks, and the rhythm and kodama parts of users.settings), so those
// numbers work without the events table. Only the morning-plan and notification rates need events (db/migrations/002_events.sql) and say so when it is missing.
// Each query is separate: one failing (say, a missing table) shows as an error on its own tile and does not take the page down. Accounts only, in UTC days.
// Several numbers are approximations of what the brief asks for and say so in the dashboard (e.g. "wrap-ups per active day").

const run = async (fn) => { try { return { ok: true, v: await fn() } } catch (e) { return { ok: false, error: String(e.message || e).slice(0, 160) } } }

// T = ids of the accounts the owner marked as test accounts: left out of everything here.
export default async function beta(sql, T = []) {
  const [signups, wau, ret, perActive, durations, energy, accuracy, rituals, ritualRet, events] = await Promise.all([
    run(() => sql`select date_trunc('week', "createdAt")::date::text as week, count(*)::int as n from "user" where "createdAt" > now() - interval '12 weeks' and id <> all(${T}::text[]) group by 1 order by 1`),
    run(() => sql`select date_trunc('week', day)::date::text as week, count(distinct user_id)::int as n from user_day where day > current_date - 56 and user_id <> all(${T}::text[]) group by 1 order by 1`),
    // D1 = opened the app the day after signing up; D7 = opened on day 7 or 8; W4 = opened on any of days 28-34. A person counts once their window has fully passed.
    run(() => sql`select
      count(*) filter (where a."createdAt"::date < current_date)::int as e1,
      count(*) filter (where a."createdAt"::date < current_date and exists (select 1 from user_day d where d.user_id = a.id and d.day = a."createdAt"::date + 1))::int as b1,
      count(*) filter (where a."createdAt"::date <= current_date - 8)::int as e7,
      count(*) filter (where a."createdAt"::date <= current_date - 8 and exists (select 1 from user_day d where d.user_id = a.id and d.day between a."createdAt"::date + 7 and a."createdAt"::date + 8))::int as b7,
      count(*) filter (where a."createdAt"::date <= current_date - 35)::int as e28,
      count(*) filter (where a."createdAt"::date <= current_date - 35 and exists (select 1 from user_day d where d.user_id = a.id and d.day between a."createdAt"::date + 28 and a."createdAt"::date + 34))::int as b28
      from "user" a where a.id <> all(${T}::text[])`),
    run(() => sql`select (select count(distinct user_id) from user_day where day > current_date - 7 and user_id <> all(${T}::text[]))::int as active7,
      (select count(*) from tasks where done and user_id <> all(${T}::text[]) and done_at > (extract(epoch from now()) - 604800) * 1000)::int as done7`),
    // real duration = finished with the timer (spent > 0) or told to the chips (rhythm outcomes with src tap)
    run(() => sql`select (select count(*) from tasks where done and user_id <> all(${T}::text[]))::int as done, (select count(*) from tasks where done and spent > 0 and user_id <> all(${T}::text[]))::int as timed,
      (select count(*) from users u, jsonb_array_elements(coalesce(u.settings #> '{rhythm,outcomes}', '[]'::jsonb)) o where o->>'src' = 'tap' and u.id <> all(${T}::text[]))::int as chip`),
    run(() => sql`select count(*)::int as n from users u, jsonb_array_elements(coalesce(u.settings -> 'energyLog', '[]'::jsonb)) e where u.id <> all(${T}::text[]) and (e->>'at')::bigint > (extract(epoch from now()) - 604800) * 1000`),
    // the main proof the engine works: median error of the user's own estimate, and of Desker's plan, by how many weeks they have been using it
    run(() => sql`select greatest(0, least(12, floor(((o->>'at')::numeric / 1000 - extract(epoch from a."createdAt")) / 604800)))::int as week, count(*)::int as n,
      (percentile_cont(0.5) within group (order by abs((o->>'est')::numeric - (o->>'actual')::numeric) / (o->>'actual')::numeric))::float as est_err,
      (percentile_cont(0.5) within group (order by abs((o->>'pred')::numeric - (o->>'actual')::numeric) / (o->>'actual')::numeric) filter (where jsonb_exists(o, 'pred')))::float as plan_err
      from "user" a join users u on u.id = a.id, jsonb_array_elements(coalesce(u.settings #> '{rhythm,outcomes}', '[]'::jsonb)) o
      where a.id <> all(${T}::text[]) and (o->>'actual')::numeric > 0 and (o->>'est')::numeric > 0 group by 1 order by 1`),
    run(() => sql`select (select count(*) from users u, jsonb_array_elements_text(coalesce(u.settings #> '{kodama,rituals,evening}', '[]'::jsonb)) d where u.id <> all(${T}::text[]) and d::date > current_date - 28)::int as wrapups,
      (select count(*) from users u, jsonb_array_elements_text(coalesce(u.settings #> '{kodama,rituals,morning}', '[]'::jsonb)) d where u.id <> all(${T}::text[]) and d::date > current_date - 28)::int as morning_done,
      (select count(*) from user_day where day > current_date - 28 and user_id <> all(${T}::text[]))::int as active_days`),
    // people who did 3+ rituals in their first two weeks against everyone else: did they come back in week 4?
    run(() => sql`with s as (select a.id, a."createdAt"::date as c,
        (select count(*) from users x, jsonb_array_elements_text(coalesce(x.settings #> '{kodama,rituals,morning}', '[]'::jsonb) || coalesce(x.settings #> '{kodama,rituals,evening}', '[]'::jsonb)) d
          where x.id = a.id and d::date between a."createdAt"::date and a."createdAt"::date + 14) as r
      from "user" a where a.id <> all(${T}::text[]) and a."createdAt"::date <= current_date - 35)
      select count(*) filter (where r >= 3)::int as ritual_n,
        count(*) filter (where r >= 3 and exists (select 1 from user_day d where d.user_id = s.id and d.day between s.c + 28 and s.c + 34))::int as ritual_back,
        count(*) filter (where r < 3)::int as other_n,
        count(*) filter (where r < 3 and exists (select 1 from user_day d where d.user_id = s.id and d.day between s.c + 28 and s.c + 34))::int as other_back
      from s`),
    run(() => sql`select count(*) filter (where name = 'morning_plan_opened')::int as morning_opened, count(*) filter (where name = 'notification_sent')::int as sent,
      count(*) filter (where name = 'notification_opened')::int as opened, count(*)::int as total from events where at > now() - interval '28 days' and user_id <> all(${T}::text[])`),
  ])
  return { signups, wau, ret, perActive, durations, energy, accuracy, rituals, ritualRet, events }
}
