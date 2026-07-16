-- Sales pipeline stage per lead, driven by the operator.
-- Nullable; a NULL status is treated as 'new' in code. Stages:
--   new · contacted · quoted · won · lost
alter table leads add column if not exists status text;
