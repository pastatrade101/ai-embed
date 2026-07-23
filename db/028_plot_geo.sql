-- 028: Pre-computed plot location context (OpenStreetMap distances).
--
-- The public Overpass instances are too slow/overloaded for live per-request use
-- from the server, so distances (which are static geography) are computed OFFLINE
-- by scripts/sync-plot-geo.mjs and read from here at query time — Overpass leaves
-- the citizen's request path entirely. plot_location_context reads this table
-- first and only falls back to a live Overpass lookup for un-synced plots.
--
-- No PII: only plot identity + geography. `nearest` holds the seven categories
-- ({ road:{name,km}, place, school, health, market, water, rail }); `osm_ok` is
-- false when the OSM lookup failed (centroid still stored so the row can be
-- retried on the next run).
create table if not exists plot_geo (
	project_id  text not null,
	lot_number  text not null default '',
	block       text not null default '',
	land_plot_id text,
	lat         double precision,
	lon         double precision,
	nearest     jsonb,
	osm_ok      boolean not null default false,
	computed_at timestamptz not null default now(),
	primary key (project_id, lot_number, block)
);
create index if not exists plot_geo_project on plot_geo (project_id);
