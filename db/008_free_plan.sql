-- Migration 008 — a free default plan the admin fully controls. Idempotent; run after 002.

-- Which plan a brand-new client starts on. Exactly one plan should be the default;
-- the admin picks it in the Plans console.
alter table plans add column if not exists is_default boolean not null default false;

-- Seed a free tier. The admin can rename it and change its cap / benefits later —
-- on conflict we leave any existing 'free' plan (and the admin's edits) untouched.
insert into plans (key, name, price_amount, price_currency, monthly_conversation_cap, features, sort, is_active, is_default)
values (
  'free', 'Free', 0, 'USD', 30,
  '["Hosted AI page + QR code","30 conversations / month","WhatsApp lead handoff"]'::jsonb,
  0, true, true
)
on conflict (key) do nothing;

-- Make the free plan the default only if no default is set yet (so a later admin
-- choice is never overwritten by re-running this migration).
update plans set is_default = true
where key = 'free' and not exists (select 1 from plans where is_default = true);

-- Brand-new clients start on the free plan.
alter table clients alter column plan set default 'free';
