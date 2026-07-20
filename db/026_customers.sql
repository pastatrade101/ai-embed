-- 026_customers.sql — Customers (kept deliberately simple per the product philosophy:
-- WhatsApp number, name, notes, orders/invoices, total spent). One record per phone
-- per tenant (dedup — never a new customer per message). Tenant-isolated. Fail-open:
-- before this runs, order creation just skips the customer link.
create table if not exists customers (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references clients(id) on delete cascade,
	phone text not null,                 -- normalized WhatsApp number (digits only)
	name text,
	email text,
	notes text,
	status text not null default 'active',
	source text default 'whatsapp',
	tags jsonb not null default '[]'::jsonb,
	total_spent numeric not null default 0,   -- sum of completed/confirmed order totals
	order_count int not null default 0,
	last_interaction_at timestamptz,
	meta jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (client_id, phone)
);
create index if not exists customers_client_idx on customers (client_id, updated_at desc);
create index if not exists customers_client_name_idx on customers (client_id, name);

alter table customers enable row level security;
