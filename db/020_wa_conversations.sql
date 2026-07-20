-- 020_wa_conversations.sql — the WhatsApp Proposal Assistant conversation store.
-- One row per (customer number ↔ proposal) thread: the CRM history, AI memory,
-- 24-hour-window state and human-takeover/escalation state all live here. Proposal
-- VERSIONS are stored in proposals.meta.versions (no extra table).
--
-- Run manually in Supabase. The app FAILS OPEN before this migration: the WhatsApp
-- assistant just no-ops (logs) until the table exists.

create table if not exists wa_conversations (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references clients(id) on delete cascade,
	proposal_id uuid references proposals(id) on delete set null,
	lead_id uuid references leads(id) on delete set null,
	customer_phone text not null,            -- wa_id, E.164 without '+'
	phone_number_id text,                    -- the business number that owns the thread (multi-WABA)
	status text not null default 'active',   -- active | paused | escalated | closed
	ai_enabled boolean not null default true,-- false = a human has taken over
	assigned_to uuid,                        -- users.id of the human rep, if assigned
	window_expires_at timestamptz,           -- end of the 24h free-text window
	last_customer_at timestamptz,
	last_ai_at timestamptz,
	-- [{ role:'customer'|'ai'|'agent'|'system', text, at, kind, meta }]
	messages jsonb not null default '[]'::jsonb,
	-- { timeline:[{type,at,meta}], escalation:{reason,at}, negotiation:{...} }
	meta jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists wa_conversations_client_idx on wa_conversations (client_id, updated_at desc);
create index if not exists wa_conversations_phone_idx on wa_conversations (customer_phone);
create index if not exists wa_conversations_proposal_idx on wa_conversations (proposal_id);

comment on table wa_conversations is 'WhatsApp Proposal Assistant threads: CRM history + AI memory + 24h window + human takeover.';
