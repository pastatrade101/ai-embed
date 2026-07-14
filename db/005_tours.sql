-- Migration 005 — tour departures (dates + per-date price + availability).
-- Idempotent; run after 004. Tours themselves stay as knowledge_items of
-- category 'tour' (already embedded + typed via metadata); this table adds the
-- structured date/pricing/availability the qualification agent needs.

create table if not exists tour_departures (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  item_id uuid not null references knowledge_items(id) on delete cascade,  -- the tour
  start_date date not null,
  end_date date,
  price_amount numeric(12,2),        -- per-departure price; falls back to the tour's base price
  currency text default 'USD',
  seats_available int,
  status text not null default 'open',   -- open | limited | sold_out
  created_at timestamptz not null default now()
);
create index if not exists tour_departures_idx on tour_departures (client_id, item_id, start_date);
alter table tour_departures enable row level security;   -- service_role only
