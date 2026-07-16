-- Migration 015 — purchasable AI Credit packs + usage-alert de-dup state.
-- Pass 2 of the AI Credits billing system. Idempotent.

-- One row per purchased top-up. `budget` is the AI cost value (USD) the pack adds
-- to the tenant's allowance for the billing period it was bought in. `reference`
-- is unique so a redelivered webhook can't credit the same purchase twice.
create table if not exists ai_credit_packs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  pack_key text,
  budget numeric(12,4) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  currency text not null default 'USD',
  provider text default 'snippe',
  reference text unique,
  purchased_at timestamptz not null default now()
);
create index if not exists ai_credit_packs_client_idx on ai_credit_packs (client_id, purchased_at desc);
alter table ai_credit_packs enable row level security;   -- service_role only

-- Sum a tenant's active (this-period) purchased credit budget.
create or replace function tenant_pack_budget(p_client_id uuid, p_since timestamptz)
returns numeric language sql stable as $$
  select coalesce(sum(budget), 0)::numeric
  from ai_credit_packs
  where client_id = p_client_id and purchased_at >= p_since;
$$;

-- Tag a payment attempt as a plan upgrade or a credit-pack top-up, so the
-- self-verify fallback (missed webhook) knows which to complete.
alter table payment_attempts add column if not exists kind text not null default 'subscription';
alter table payment_attempts add column if not exists pack_key text;

-- Which usage-alert thresholds (80/95/100) have been emailed to a tenant this
-- period, so we notify once and never spam. { "period": "2026-07", "sent": [80] }
alter table clients add column if not exists ai_usage_alerts jsonb not null default '{}'::jsonb;
