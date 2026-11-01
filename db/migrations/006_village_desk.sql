-- One member per desk in a village (the API also checks, this is the backstop for two people claiming the same desk at the same moment).
create unique index if not exists village_member_desk on village_member (village_id, desk_spot_id) where desk_spot_id is not null;
