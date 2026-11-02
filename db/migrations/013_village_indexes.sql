-- Kodama Village Phase 1, checkpoint 13: the last foreign keys without an index (SPEC §9). NOT applied automatically. Safe to re-run.
create index if not exists village_answer_user on village_answer (user_id);
create index if not exists village_report_resolver on village_report (resolved_by);
create index if not exists village_invite_expiry on village_invite (expires_at);
