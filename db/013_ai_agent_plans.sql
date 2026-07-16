-- Migration 013 — grant the two premium AI agents (data analyst, research
-- assistant) to the growth and pro plans, so that with FEATURE_GATING=on the
-- access gate (gating.js planAllows) actually lets those tiers in. Without this,
-- no plan's feature set contains these labels and gating-on would deny EVERY plan
-- (a dead-end upsell for all), while the per-plan monthly quotas in
-- src/lib/server/ai.js already only fund growth + pro.
--
-- Idempotent: the `@>` guard means re-running adds nothing and never duplicates.
-- To change which tiers get the agents, edit the `key in (...)` lists — but keep
-- them in sync with the QUOTAS table in src/lib/server/ai.js (a tier with the
-- feature but 0 quota sees an enabled form it can never use).

update plans set features = features || '["AI data analyst"]'::jsonb
where key in ('growth', 'pro') and not (features @> '["AI data analyst"]');

update plans set features = features || '["AI research assistant"]'::jsonb
where key in ('growth', 'pro') and not (features @> '["AI research assistant"]');
