-- Kodama Village Phase 1, checkpoint 2: real invites (replaces the temporary join key). NOT applied automatically:
--   psql "$DATABASE_URL" -f db/migrations/007_village_invite.sql      (try it on the Neon branch village-dev first)
-- Only adds a village_ table; nothing that exists is changed. Safe to re-run.
create table if not exists village_invite (
  code        text primary key check (char_length(code) = 10),
  village_id  uuid not null references village(id) on delete cascade,
  created_by  text not null references "user"(id) on delete cascade,
  expires_at  timestamptz,                       -- null = never
  max_uses    int check (max_uses > 0),          -- null = unlimited
  uses        int not null default 0,
  as_guest    boolean not null default false,    -- people who join with this link become guests
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists village_invite_village on village_invite (village_id);
create index if not exists village_invite_creator on village_invite (created_by);
