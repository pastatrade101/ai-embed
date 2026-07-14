-- Migration 009 — sensible catalogue features on the four built-in plans, so plan
-- gating enforces meaningfully once you set FEATURE_GATING=on. This OVERWRITES the
-- feature list on free/starter/growth/pro only; re-tick anytime in the Plans console.
-- Custom plans you created are left untouched.
--
-- Gating summary (with FEATURE_GATING=on): free = hosted AI page only (no embeddable
-- widget); starter adds the website widget, email alerts, summaries & tour tools;
-- growth adds bulk import, branding + "remove Powered-by" + multi-site; pro adds the
-- Advanced (Sonnet) model.

update plans set features =
	'["Hosted AI page + QR code","WhatsApp lead handoff","AI-qualified leads"]'::jsonb
where key = 'free';

update plans set features =
	'["Hosted AI page + QR code","Website chat widget","WhatsApp lead handoff","Email lead alerts","AI-qualified leads","Conversation history & summaries","Structured tours & pricing"]'::jsonb
where key = 'starter';

update plans set features =
	'["Hosted AI page + QR code","Website chat widget","WhatsApp lead handoff","Email lead alerts","AI-qualified leads","Conversation history & summaries","Structured tours & pricing","Bulk knowledge import (CSV/JSON)","Remove \"Powered by Makutano\" badge"]'::jsonb
where key = 'growth';

update plans set features =
	'["Hosted AI page + QR code","Website chat widget","WhatsApp lead handoff","Email lead alerts","AI-qualified leads","Conversation history & summaries","Structured tours & pricing","Bulk knowledge import (CSV/JSON)","Remove \"Powered by Makutano\" badge","Advanced (Sonnet) AI model","Dedicated support"]'::jsonb
where key = 'pro';
