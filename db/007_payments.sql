-- Migration 007 — payments (Snippe hosted checkout). Idempotent; run after 002.
-- Same technique as the Pastatrade backend: a provider-agnostic audit trail
-- (payment_events) + attempt tracking (payment_attempts) for subscription
-- checkouts. Subscriptions are per-CLIENT (the business), initiated by an operator.

create table if not exists payment_events (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references clients(id) on delete set null,
  user_id       uuid references users(id) on delete set null,
  provider      text,
  event_type    text,
  status        text,
  event_payload jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_payment_events_client on payment_events (client_id, created_at desc);

create table if not exists payment_attempts (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references clients(id) on delete set null,
  user_id          uuid references users(id) on delete set null,
  provider         text,
  reference        text,               -- provider session reference
  plan_key         text,
  billing_interval text default 'monthly',
  amount           numeric,
  currency         text,
  status           text not null default 'pending'
                     check (status in ('pending', 'completed', 'failed', 'cancelled', 'expired')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_payment_attempts_client on payment_attempts (client_id, created_at desc);
create index if not exists idx_payment_attempts_ref on payment_attempts (reference);

-- service_role only (app uses the service key; no client-side access).
alter table payment_events enable row level security;
alter table payment_attempts enable row level security;
