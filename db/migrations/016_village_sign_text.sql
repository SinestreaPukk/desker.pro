-- Village Phase 2, checkpoint 3: signs carry a short text (40 characters, filtered by the room like a bubble).
-- File only: apply by hand in the Neon SQL editor (never from dev).
alter table village_placement add column if not exists text text check (text is null or char_length(text) <= 40);
