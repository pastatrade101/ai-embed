-- 023_orders.sql — Order Management module (Phase 1 of the AI Business OS).
-- One order per customer request. Items are stored as a jsonb array (like proposals'
-- line_items) so Phase 1 needs no separate products table — the AI extracts free-text
-- items and the operator confirms; a later Inventory module can link them to SKUs.
-- Tenant-isolated by client_id. FAILS OPEN before this runs: the Orders pages show a
-- "run 023" state and the WhatsApp auto-draft silently no-ops (src/lib/server/orders.js).

create table if not exists orders (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references clients(id) on delete cascade,
	lead_id uuid references leads(id) on delete set null,
	conversation_id uuid,
	number text,
	status text not null default 'new',           -- see ORDER_STATUSES in orders.js
	source text not null default 'manual',         -- whatsapp | manual | website | api | instagram | email
	customer_name text,
	customer_phone text,
	customer_email text,
	currency text not null default 'USD',
	items jsonb not null default '[]'::jsonb,      -- [{ description, detail, qty, unit_price, amount }]
	subtotal numeric not null default 0,
	discount numeric not null default 0,
	tax numeric not null default 0,
	total numeric not null default 0,
	delivery_date date,
	delivery_address text,
	notes text,                                    -- customer-facing / special instructions
	internal_notes text,                           -- staff-only
	confidence integer,                            -- 0-100 from AI extraction (null for manual)
	assigned_to uuid references users(id) on delete set null,
	meta jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	confirmed_at timestamptz,
	delivered_at timestamptz,
	completed_at timestamptz
);

create index if not exists orders_client_created_idx on orders (client_id, created_at desc);
create index if not exists orders_client_status_idx on orders (client_id, status);
create index if not exists orders_lead_idx on orders (lead_id);

-- Append-only timeline (created, ai_parsed, confirmed, status changes, delivered…).
create table if not exists order_events (
	id uuid primary key default gen_random_uuid(),
	order_id uuid not null references orders(id) on delete cascade,
	client_id uuid not null references clients(id) on delete cascade,
	type text not null,
	meta jsonb not null default '{}'::jsonb,
	at timestamptz not null default now()
);

create index if not exists order_events_order_idx on order_events (order_id, at);

alter table orders enable row level security;
alter table order_events enable row level security;
