-- Village Phase 2, checkpoint 1: decorating. Placements are the only editable layer; the template map file stays read-only (version 0).
-- File only: apply by hand in the Neon SQL editor (never from dev).
create table if not exists village_placement (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references village(id) on delete cascade,
  decor_id text not null,
  x int not null, y int not null,
  rotation int not null default 0 check (rotation in (0, 90, 180, 270)),
  placed_by text references "user"(id) on delete set null,
  v int not null,                 -- the map version that last touched this row (create, move, rotate or remove)
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
-- the current map version of a village = max(v) of its rows (0 if none); no counter to drift
create index if not exists village_placement_village_v on village_placement (village_id, v);
create index if not exists village_placement_live on village_placement (village_id) where removed_at is null;

create table if not exists village_map_version (
  village_id uuid not null references village(id) on delete cascade,
  version int not null,
  layers jsonb not null,          -- the live placements at that version: [{id, decorId, x, y, rotation, by}]
  created_by text references "user"(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (village_id, version)
);
