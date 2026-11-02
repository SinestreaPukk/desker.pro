-- Kodama Village Phase 1, checkpoint 9: block and report. NOT applied automatically:
--   psql "$DATABASE_URL" -f db/migrations/012_village_safety.sql      (try it on the Neon branch village-dev first)
-- Only adds village_ tables. Safe to re-run. (Slow mode is a key in village.settings, not a column.)
create table if not exists village_block (
  blocker_id text not null references "user"(id) on delete cascade,
  blocked_id text not null references "user"(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists village_block_blocked on village_block (blocked_id);
create table if not exists village_report (
  id             uuid primary key default gen_random_uuid(),
  village_id     uuid not null references village(id) on delete cascade,
  reporter_id    text not null references "user"(id) on delete cascade,
  target_user_id text not null references "user"(id) on delete cascade,
  reason         text not null check (reason in ('harassment', 'spam', 'inappropriate', 'other')),
  context        jsonb not null default '{}',   -- note, what was reported, the last chat lines the reporter saw
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    text references "user"(id) on delete set null
);
create index if not exists village_report_village on village_report (village_id, created_at desc);
create index if not exists village_report_reporter on village_report (reporter_id);
create index if not exists village_report_target on village_report (target_user_id);
