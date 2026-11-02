-- Kodama Village Phase 1, checkpoint 8: web push. NOT applied automatically:
--   psql "$DATABASE_URL" -f db/migrations/011_village_push.sql      (try it on the Neon branch village-dev first)
-- Only adds village_ tables. Desker's own push subscription (users.settings.push) is not touched: a subscription belongs to one web address, and the village runs on its own (village.desker.dev), so it needs its own. Safe to re-run.
create table if not exists village_push_sub (
  user_id    text primary key references "user"(id) on delete cascade,
  sub        jsonb not null,                  -- the browser's PushSubscription (endpoint + keys)
  prefs      jsonb not null default '{}',     -- which types are on, quiet hours
  tz         text not null default 'UTC',     -- for quiet hours, on the person's own clock
  updated_at timestamptz not null default now()
);
-- what was sent, for the daily caps and "once per item". Old rows are purged by the daily job.
create table if not exists village_push_log (
  user_id    text not null references "user"(id) on delete cascade,
  kind       text not null,
  village_id uuid references village(id) on delete cascade,
  ref        text,
  sent_at    timestamptz not null default now()
);
create index if not exists village_push_log_user on village_push_log (user_id, kind, sent_at);
create index if not exists village_push_log_village on village_push_log (village_id);
