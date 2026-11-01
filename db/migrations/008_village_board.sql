-- Kodama Village Phase 1, checkpoint 6: the full Board (items added by hand, confirmations, announcements). NOT applied automatically:
--   psql "$DATABASE_URL" -f db/migrations/008_village_board.sql      (try it on the Neon branch village-dev first)
-- Only adds village_ tables; nothing that exists is changed. Safe to re-run.
-- Deadlines that members share (share_deadlines) are NOT copied here: they are read live from Desker's own deadlines, so turning sharing off removes them at once.
create table if not exists village_board_item (
  id          uuid primary key default gen_random_uuid(),
  village_id  uuid not null references village(id) on delete cascade,
  kind        text not null check (kind in ('due', 'exam', 'announcement')),
  course_code text,
  title       text not null check (char_length(title) between 1 and 120),
  title_norm  text not null,
  body        text check (char_length(body) <= 500),  -- announcements
  pinned      boolean not null default false,          -- announcements
  due_at      timestamptz,                             -- null for announcements
  created_by  text not null references "user"(id) on delete cascade,
  source      text not null default 'manual' check (source in ('manual', 'auto')),
  source_ref  text,
  merged_into uuid references village_board_item(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists village_board_item_due on village_board_item (village_id, due_at);
create index if not exists village_board_item_creator on village_board_item (created_by);
create table if not exists village_board_confirm (
  item_id    uuid not null references village_board_item(id) on delete cascade,
  user_id    text not null references "user"(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
create index if not exists village_board_confirm_user on village_board_confirm (user_id);
