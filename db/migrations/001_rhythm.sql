-- Rhythm engine (Phase 4). NOT applied automatically and never run by the app or by scripts/migrate.mjs.
-- Until you run this by hand, everything below lives in the account document (users.settings -> 'rhythm' and 'energyLog'),
-- which is capped and compacted by src/rhythm.js. Apply it to a branch or staging database first:
--   psql "$DATABASE_URL" -f db/migrations/001_rhythm.sql
-- It only creates new tables; it changes nothing that exists. Safe to re-run.

-- One row per focus-timer session. active_min is focused minutes (breaks and pauses excluded).
create table if not exists focus_sessions (
  user_id    text   not null references users(id) on delete cascade,
  id         bigint not null,                         -- client-generated (start time in ms)
  task_id    bigint,                                  -- no foreign key: the task may be deleted later, the session still counts
  task_type  text,
  started_at timestamptz not null,
  ended_at   timestamptz not null,
  active_min numeric not null,
  pauses     int not null default 0,
  result     text not null check (result in ('finished', 'abandoned')),
  start_lag_min int,                                  -- minutes after the planned start (negative = early); null if it was not planned
  primary key (user_id, id)
);
create index if not exists focus_sessions_by_time on focus_sessions (user_id, started_at desc);

-- Energy taps (low / medium / high). Unprompted asks are limited to about two a day by the client.
create table if not exists energy_logs (
  user_id   text   not null references users(id) on delete cascade,
  at        timestamptz not null,
  level     text   not null check (level in ('low', 'medium', 'high')),
  prompted  boolean not null default false,
  primary key (user_id, at)
);

-- One row per finished task whose real duration is known: the estimate against what it took.
create table if not exists task_outcomes (
  user_id   text   not null references users(id) on delete cascade,
  task_id   bigint not null,
  finished_at timestamptz not null,
  task_type text   not null,
  est_hours numeric not null,
  actual_hours numeric not null,
  predicted_hours numeric,                            -- what Desker had reserved, for the accuracy trend
  source    text   not null check (source in ('timer', 'tap')),
  primary key (user_id, task_id, source)
);
create index if not exists task_outcomes_by_time on task_outcomes (user_id, finished_at desc);

-- Cached model output per user (multipliers, energy grid, focus length). Rebuildable from the three tables above at any time.
create table if not exists rhythm_profile (
  user_id    text primary key references users(id) on delete cascade,
  profile    jsonb not null,
  updated_at timestamptz not null default now()
);
