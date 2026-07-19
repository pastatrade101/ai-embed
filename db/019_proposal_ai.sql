-- 019_proposal_ai.sql — per-tenant Proposal AI Settings.
-- One jsonb blob holds the whole "Proposal AI control center" config (generation
-- style, knowledge-source toggles, brand voice, recommendation rules, required-info
-- rules, explainability toggles, light approval flags). Everything reads through
-- getProposalSettings() which fills in defaults, so the app fails open before this
-- migration runs (empty {} => all defaults).
--
-- Run manually in the Supabase SQL editor (idempotent).

alter table clients add column if not exists proposal_ai jsonb not null default '{}'::jsonb;

comment on column clients.proposal_ai is 'Proposal AI Settings (see src/lib/server/proposal-settings.js). Merged over defaults at read time.';
