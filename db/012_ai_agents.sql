-- AI agents (data analyst, deep researcher, structured lead extraction).
-- Everything degrades gracefully until this runs: per-tier quotas fail open
-- (unmetered) and structured lead details fall back to regex extraction.

-- Tag each AI call with the feature it served, so monthly per-tier quotas can be
-- counted from usage_records (no new table needed).
alter table usage_records add column if not exists feature text;
create index if not exists usage_records_feature_idx
  on usage_records (client_id, feature, created_at desc);

-- Structured lead fields extracted by the AI at capture time (falls back to the
-- regex extractor when absent).
alter table leads add column if not exists details jsonb;
