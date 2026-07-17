-- 016: Industry dimension for the multi-industry platform.
--
-- Every tenant belongs to one industry (a key into the code-level Industry
-- Registry in src/lib/industries.js + src/lib/server/industries.js), which
-- drives the AI persona, tools, terminology, knowledge categories and
-- onboarding. Tourism is the default, reproducing the original product
-- verbatim — existing tenants keep behaving exactly as before.
--
-- The app FAILS OPEN before this migration runs: everywhere the industry is
-- read uses select('*') / optional fields, and inserts retry without the
-- column, so nothing breaks if this hasn't been applied yet.
alter table clients add column if not exists industry text not null default 'tourism';

-- Fast filtering/reporting by industry in the admin console.
create index if not exists idx_clients_industry on clients (industry);
