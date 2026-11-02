-- Kodama Village Phase 1, checkpoint 7: study together (group sessions). NOT applied automatically:
--   psql "$DATABASE_URL" -f db/migrations/010_village_group.sql      (try it on the Neon branch village-dev first)
-- Only adds village_ tables and indexes. village_focus_session.group_session_id already exists (migration 005); it just starts being filled. Safe to re-run.
create table if not exists village_group_session (
  id          uuid primary key default gen_random_uuid(),
  village_id  uuid not null references village(id) on delete cascade,
  started_by  text not null references "user"(id) on delete cascade,
  focus_min   int not null check (focus_min between 10 and 120),
  break_min   int not null check (break_min between 1 and 30),
  rounds      int not null check (rounds between 1 and 6),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  end_reason  text,            -- finished / ended_by_starter / empty
  summary     jsonb            -- the card shown at the end, saved
);
-- only one session per village at a time: the database says no to a second one
create unique index if not exists village_group_one_running on village_group_session (village_id) where ended_at is null;
create index if not exists village_group_session_starter on village_group_session (started_by);
create table if not exists village_group_participant (
  group_session_id uuid not null references village_group_session(id) on delete cascade,
  user_id          text not null references "user"(id) on delete cascade,
  joined_at        timestamptz not null default now(),
  left_at          timestamptz,
  task_title       text,
  course_code      text,
  primary key (group_session_id, user_id)
);
create index if not exists village_group_participant_user on village_group_participant (user_id);
create index if not exists village_focus_session_group on village_focus_session (group_session_id);
