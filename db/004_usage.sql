-- Migration 004 — usage / token metering. Idempotent; run after 003.
-- One row per AI turn: tokens + estimated cost, scoped by tenant. Feeds the
-- cost dashboard and (later) overage billing.

create table if not exists usage_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  model text,
  input_tokens int not null default 0,
  cached_tokens int not null default 0,
  output_tokens int not null default 0,
  tool_calls int not null default 0,
  estimated_cost numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists usage_records_client_idx on usage_records (client_id, created_at desc);
alter table usage_records enable row level security;   -- service_role only
