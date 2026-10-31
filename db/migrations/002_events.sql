-- Product analytics events (Phase 8). NOT applied automatically. Without this table the app and the dashboard keep working:
-- the events endpoint swallows the insert error, and the dashboard shows the event-based numbers as "no data yet".
--   psql "$DATABASE_URL" -f db/migrations/002_events.sql
-- Rows hold a user id, an event name from src/analytics.js and numbers or fixed words. Never titles, notes or other free text (sanitize() enforces it).
create table if not exists events (
  id      bigint generated always as identity primary key,
  user_id text   not null references users(id) on delete cascade,   -- deleting the account deletes its events
  name    text   not null,
  at      timestamptz not null default now(),
  props   jsonb  not null default '{}'
);
create index if not exists events_by_name_time on events (name, at);
create index if not exists events_by_user_time on events (user_id, at);
