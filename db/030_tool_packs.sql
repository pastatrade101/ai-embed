-- Per-client institution tool-pack assignment (super-admin controlled).
-- A { packKey: boolean } map on each client: true = assigned/on, false = shut down.
-- Absent packs follow the industry default (the `tausi` pack is defaultFor
-- government), so existing tenants keep the exact same toolset until an admin
-- changes it. Fail-open: code reads `client.tool_packs ?? {}` and select('*'), so
-- the app works unchanged until this runs. Run once in the Supabase SQL editor.

alter table clients
  add column if not exists tool_packs jsonb not null default '{}'::jsonb;
