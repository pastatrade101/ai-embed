-- Featured cards on the hosted assistant page's welcome screen.
-- A per-tenant, admin-authored list of cards. Each card is a small JSON object
-- ({ type, title, subtitle, icon, projectId }); live cards (plots available, on-
-- preview countdown, councils with land) resolve their numbers at render time from
-- the TAUSI API through the existing cache + circuit breaker. Stored as JSONB so no
-- new table is needed and the shape can evolve.
--
-- Fail-open: code reads `client.featured_cards ?? []`, so the app works unchanged
-- until this runs. Run once in the Supabase SQL editor.

alter table clients
  add column if not exists featured_cards jsonb not null default '[]'::jsonb;
