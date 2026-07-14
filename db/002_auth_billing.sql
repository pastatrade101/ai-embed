-- Migration 002 — auth, roles, plans & subscriptions.
-- Idempotent: safe to run on an existing Makutano database (run in the Supabase
-- SQL editor after db/schema.sql).

-- ---- Users (login accounts) ------------------------------------------------
-- Two roles: super_admin (you — sees all tenants) and operator (one client).
-- Passwords are scrypt-hashed by the app; never store plaintext.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text,
  role text not null default 'operator' check (role in ('super_admin', 'operator')),
  client_id uuid references clients(id) on delete cascade,   -- null for super_admin
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists users_client_idx on users (client_id);
alter table users enable row level security;   -- service_role only

-- ---- Plans (subscription tiers) --------------------------------------------
create table if not exists plans (
  key text primary key,
  name text not null,
  price_amount numeric(12,2) not null default 0,
  price_currency text not null default 'USD',
  monthly_conversation_cap int not null default 200,
  features jsonb not null default '[]'::jsonb,
  sort int not null default 0,
  is_active boolean not null default true
);
alter table plans enable row level security;   -- service_role only

-- ---- Subscription state on each client -------------------------------------
alter table clients
  add column if not exists subscription_status text not null default 'active';
do $$ begin
  alter table clients add constraint clients_sub_status_chk
    check (subscription_status in ('active', 'trialing', 'past_due', 'canceled'));
exception when duplicate_object then null; end $$;
alter table clients add column if not exists plan_renews_at timestamptz;

-- ---- Seed default plans ----------------------------------------------------
insert into plans (key, name, price_amount, monthly_conversation_cap, features, sort) values
  ('starter', 'Starter', 20, 200,
    '["1 website","200 conversations / mo","WhatsApp lead handoff","Email lead alerts"]'::jsonb, 1),
  ('growth', 'Growth', 49, 1000,
    '["Everything in Starter","1,000 conversations / mo","Priority responses"]'::jsonb, 2),
  ('pro', 'Pro', 99, 5000,
    '["Everything in Growth","5,000 conversations / mo","Sonnet model tier"]'::jsonb, 3)
on conflict (key) do nothing;
