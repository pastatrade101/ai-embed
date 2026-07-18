-- 018: Proposal Engine — industry-agnostic proposals/quotes/estimates.
--
-- One reusable engine backs every document type (quotation, proposal, estimate,
-- offer, invoice, booking summary, contract draft…) across every industry. The
-- app never branches on doc_type or industry — it reads whatever the row and the
-- Industry Registry say. Line items, totals and a branding snapshot live on the
-- row; the timeline lives in proposal_events.
--
-- Run manually in the Supabase SQL editor. The app FAILS OPEN before this runs:
-- the proposals pages detect the missing table and show a "run migration 018"
-- state, and nothing else in the app is affected.

create table if not exists proposals (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references clients(id) on delete cascade,
	lead_id uuid references leads(id) on delete set null,
	conversation_id uuid,
	number text,                                  -- human ref, e.g. PRO-2026-0001
	doc_type text not null default 'quotation',   -- quotation/proposal/estimate/offer/invoice/...
	status text not null default 'draft',         -- draft/sent/viewed/accepted/declined/expired/converted
	title text,
	customer_name text,
	customer_email text,
	customer_phone text,
	currency text not null default 'USD',
	intro text,                                   -- AI/operator introduction
	summary text,                                 -- recommended solution / summary
	terms text,                                   -- terms & conditions
	notes text,                                   -- internal notes (not shown to customer)
	line_items jsonb not null default '[]'::jsonb,-- [{description, detail, qty, unit_price, amount}]
	subtotal numeric not null default 0,
	discount numeric not null default 0,          -- absolute amount in currency
	tax numeric not null default 0,               -- absolute amount in currency
	total numeric not null default 0,
	valid_until date,
	public_token text unique,                     -- hosted page /p/<token>
	version int not null default 1,
	meta jsonb not null default '{}'::jsonb,       -- branding snapshot, ai flags, cta config…
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	sent_at timestamptz,
	first_viewed_at timestamptz,
	viewed_count int not null default 0,
	accepted_at timestamptz,
	declined_at timestamptz
);

create index if not exists idx_proposals_client on proposals (client_id, created_at desc);
create index if not exists idx_proposals_lead on proposals (lead_id);
create index if not exists idx_proposals_token on proposals (public_token);
create index if not exists idx_proposals_status on proposals (client_id, status);

-- Full lifecycle timeline: created, generated, edited, sent, delivered, viewed,
-- accepted, declined, expired, payment_started, payment_completed, note.
create table if not exists proposal_events (
	id uuid primary key default gen_random_uuid(),
	proposal_id uuid not null references proposals(id) on delete cascade,
	client_id uuid not null references clients(id) on delete cascade,
	type text not null,
	at timestamptz not null default now(),
	meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_proposal_events_proposal on proposal_events (proposal_id, at desc);
create index if not exists idx_proposal_events_client on proposal_events (client_id, at desc);
