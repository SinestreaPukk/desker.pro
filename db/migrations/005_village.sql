-- Kodama Village, Phase 0 tables (docs/village/SPEC.md §9). NOT applied automatically: run it yourself, on a Neon branch first:
--   psql "$DATABASE_URL" -f db/migrations/005_village.sql
-- Only creates new village_ tables; nothing that exists is changed. Safe to re-run.
-- User ids reference "user"(id) (Better Auth), not users(id): the users row is only made on a first save, a village member may not have one yet.
-- Deleting an account cascades into all of these, so Desker's delete-account flow covers village data (PDPA).

create table if not exists village (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  owner_id    text not null references "user"(id) on delete cascade,
  template    text not null default 'snowy_campus',
  course_tags text[] not null default '{}',
  settings    jsonb not null default '{}',   -- library_auto_focus, who_can_invite, who_can_build, join_key_hash (temporary, replaced by village_invite in Phase 1)
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists village_owner on village (owner_id);

create table if not exists village_member (
  village_id     uuid not null references village(id) on delete cascade,
  user_id        text not null references "user"(id) on delete cascade,
  role           text not null default 'member' check (role in ('owner', 'admin', 'member', 'guest')),
  desk_spot_id   text,
  status_sharing text not null default 'basic' check (status_sharing in ('full', 'basic', 'off')),
  share_deadlines boolean not null default false,
  settings       jsonb not null default '{}',  -- kodama colour for now ({"colour":"moss"}); Phase 2 moves it to village_kodama_appearance
  joined_at      timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  banned_at      timestamptz,
  primary key (village_id, user_id)
);
create index if not exists village_member_user on village_member (user_id);

create table if not exists village_chat_log (
  id         uuid primary key default gen_random_uuid(),
  village_id uuid not null references village(id) on delete cascade,
  zone_id    text not null,
  sender_id  text not null references "user"(id) on delete cascade,
  text       text not null,
  mentions   text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists village_chat_log_time on village_chat_log (village_id, created_at);
create index if not exists village_chat_log_sender on village_chat_log (sender_id);

create table if not exists village_focus_session (
  id               uuid primary key default gen_random_uuid(),
  village_id       uuid not null references village(id) on delete cascade,
  user_id          text not null references "user"(id) on delete cascade,
  desker_session_id text,           -- id of the record written to the account document (settings.rhythm.sessions); no FK, it lives in JSON
  group_session_id uuid,            -- Phase 1
  started_at       timestamptz not null,
  ended_at         timestamptz
);
create index if not exists village_focus_session_village on village_focus_session (village_id, started_at);
create index if not exists village_focus_session_user on village_focus_session (user_id);

-- Analytics. Desker's own `events` table only accepts a fixed allow-list without ids, so village events live here. Never message text.
create table if not exists village_event (
  id         uuid primary key default gen_random_uuid(),
  village_id uuid references village(id) on delete cascade,
  user_id    text not null references "user"(id) on delete cascade,
  name       text not null,
  props      jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists village_event_village on village_event (village_id, created_at);
create index if not exists village_event_user on village_event (user_id);
