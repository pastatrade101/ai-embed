-- 022_platform_modules.sql — the module spine for the AI Business OS.
-- A tenant enables/disables business modules (Orders, Inventory, Invoicing…) without
-- reconnecting WhatsApp or re-onboarding. State is a single jsonb map on clients:
--   { "orders": true, "inventory": false, ... }
-- Absent/unknown keys fall back to the module registry's per-industry defaults
-- (src/lib/server/modules.js), so this migration changes nothing until a tenant
-- toggles something. FAILS OPEN: before this runs, client.modules is undefined and
-- the registry treats it as {} (defaults apply).
alter table clients add column if not exists modules jsonb not null default '{}'::jsonb;

comment on column clients.modules is
  'Per-tenant module marketplace state (see src/lib/server/modules.js). Merged over per-industry defaults at read time; only stores explicit on/off overrides.';
