-- Kodama Village Phase 1, checkpoint 5: questions and answers. NOT applied automatically:
--   psql "$DATABASE_URL" -f db/migrations/009_village_qa.sql      (try it on the Neon branch village-dev first)
-- Only adds village_ tables; nothing that exists is changed. Safe to re-run.
create table if not exists village_question (
  id          uuid primary key default gen_random_uuid(),
  village_id  uuid not null references village(id) on delete cascade,
  asker_id    text not null references "user"(id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 200),
  course_code text,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists village_question_list on village_question (village_id, created_at desc);
create table if not exists village_answer (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references village_question(id) on delete cascade,
  user_id     text not null references "user"(id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 500),
  helpful     boolean not null default false,   -- the asker pressed "This helped"
  created_at  timestamptz not null default now()
);
create index if not exists village_answer_q on village_answer (question_id, created_at);
