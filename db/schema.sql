-- Desker relational schema. Idempotent: scripts/migrate.mjs applies it, then copies old data in.
-- Every row belongs to a user; links between rows are real foreign keys, so nothing can point at something that is gone.
-- Fields the app adds later land in each table's `extra` jsonb until they deserve a column.

create table if not exists users (
  id           text primary key,                 -- today the anonymous browser id; becomes an account id when logins arrive
  email        text unique,                      -- null until the user signs up
  auth_id      text unique,                      -- id from the auth provider, null until then
  settings     jsonb not null default '{}',      -- calendar busy events, energy log, free hours, mood, focus/pick state
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists goals (
  user_id    text   not null references users(id) on delete cascade,
  id         bigint not null,
  pos        int    not null default 0,
  title      text   not null,
  level      int    not null default 3,          -- 0 Vision .. 3 Short-term
  happiness  boolean not null default false,
  extra      jsonb  not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists hobbies (
  user_id    text   not null references users(id) on delete cascade,
  id         bigint not null,
  pos        int    not null default 0,
  title      text   not null,
  extra      jsonb  not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists projects (
  user_id    text   not null references users(id) on delete cascade,
  id         bigint not null,
  pos        int    not null default 0,
  title      text   not null,
  kind       text,
  end_date   date,
  hours      numeric,
  context    text,
  goal_id    bigint,
  extra      jsonb  not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, goal_id) references goals (user_id, id) on delete set null (goal_id)
);

create table if not exists deadlines (
  user_id    text   not null references users(id) on delete cascade,
  id         bigint not null,
  pos        int    not null default 0,
  title      text   not null,
  due_date   date   not null,
  due_time   text,
  hours      numeric,
  context    text,
  project_id bigint,
  extra      jsonb  not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
-- upgrade for databases made before deadlines belonged to projects
alter table deadlines add column if not exists project_id bigint;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'deadlines_project_fk') then alter table deadlines add constraint deadlines_project_fk foreign key (user_id, project_id) references projects (user_id, id) on delete set null (project_id); end if; end $$;

create table if not exists tasks (
  user_id     text   not null references users(id) on delete cascade,
  id          bigint not null,
  pos         int    not null default 0,
  title       text   not null,
  done        boolean,
  done_at     bigint,                            -- ms since epoch, as the app stamps it
  fun         boolean,                           -- a hobby session
  due_date    date,
  plan_date   date,                              -- the day it is planned for
  start_time  text,                              -- HH:MM
  hours       numeric,
  spent       numeric,                           -- focused hours logged by the timer
  readiness   int,
  important   boolean,                           -- null = not ranked yet
  urgent      boolean,
  manual      boolean,
  reason      text,
  happy       int,
  repeat_rule text,
  subs        jsonb,                             -- checklist steps
  goal_id     bigint,
  project_id  bigint,
  deadline_id bigint,
  extra       jsonb  not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, goal_id)     references goals (user_id, id)     on delete set null (goal_id),
  foreign key (user_id, project_id)  references projects (user_id, id)  on delete set null (project_id),
  foreign key (user_id, deadline_id) references deadlines (user_id, id) on delete set null (deadline_id)
);
create index if not exists tasks_due      on tasks (user_id, due_date);
create index if not exists tasks_open     on tasks (user_id, done);
create index if not exists tasks_project  on tasks (user_id, project_id);
create index if not exists tasks_deadline on tasks (user_id, deadline_id);

create table if not exists ai_calls (
  id            bigserial primary key,
  user_id       text references users(id) on delete cascade,
  kind          text not null,                   -- chat, deadline, project, prioritise, replan, ...
  model         text not null,
  input_tokens  int  not null default 0,
  output_tokens int  not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists ai_calls_user on ai_calls (user_id, created_at);
create index if not exists ai_calls_kind on ai_calls (kind, created_at);
create index if not exists users_seen    on users (last_seen_at);

-- Accounts (Better Auth, api/_auth.js). "user".id is the same value as users.id: the app row is created on the first save.
-- Passwords live only in account.password, as a salted scrypt hash.
create table if not exists "user" (
  id              text primary key,
  name            text not null,
  email           text not null unique,
  "emailVerified" boolean not null default false,
  image           text,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);
create table if not exists session (
  id          text primary key,
  "expiresAt" timestamptz not null,
  token       text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId"    text not null references "user"(id) on delete cascade
);
create index if not exists session_by_user on session ("userId");
create table if not exists account (
  id                      text primary key,
  "accountId"             text not null,
  "providerId"            text not null,
  "userId"                text not null references "user"(id) on delete cascade,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope                   text,
  password                text,
  "createdAt"             timestamptz not null default now(),
  "updatedAt"             timestamptz not null default now()
);
create index if not exists account_by_user on account ("userId");
create table if not exists verification (
  id          text primary key,
  identifier  text not null,
  value       text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists verification_identifier on verification (identifier);
create table if not exists "rateLimit" (
  id            text primary key,
  key           text,
  count         integer,
  "lastRequest" bigint
);

-- Per-email attempt log behind the account-level rate limits in api/_auth.js (pruned daily by the code).
create table if not exists auth_hit (
  key text not null,
  at  timestamptz not null default now()
);
create index if not exists auth_hit_key on auth_hit (key, at);
