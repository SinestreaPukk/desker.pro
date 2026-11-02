-- Rotatable secrets for the developer API ('api') and the calendar feed ('feed'), replacing the account id that used to double as both.
-- Only a SHA-256 hash is stored; the token itself is shown once, when it is made. Making a new one replaces the old one.
-- Safe to run more than once. Not applied automatically: run it yourself (psql or the Neon SQL editor) BEFORE deploying this version.
create table if not exists api_token (
  user_id    text not null references users(id) on delete cascade,
  kind       text not null check (kind in ('api', 'feed')),
  hash       text not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id, kind)
);
