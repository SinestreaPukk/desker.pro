-- Lets the owner mark accounts as test accounts in the /dsb dashboard. Test accounts are left out of every number there (users, retention, funnel, AI users).
-- Safe to run more than once. Not applied automatically: run it yourself (psql or the Neon SQL editor). Until then the dashboard works and simply has no test accounts.
alter table users add column if not exists is_test boolean not null default false;
