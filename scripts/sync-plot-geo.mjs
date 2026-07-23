// Pre-compute plot location distances into the plot_geo table so Overpass leaves
// the citizen's live request path. Run weekly (geography changes slowly):
//
//   docker compose exec ai-embed-server node scripts/sync-plot-geo.mjs
//   ...            node scripts/sync-plot-geo.mjs --project=<id>   (one project)
//   ...            node scripts/sync-plot-geo.mjs --max-cells=50   (bounded test)
//
// Enumerates councils → projects → plots (TAUSI public /search, all-zeros body),
// computes each plot's centroid, fetches each ~1 km CELL's OpenStreetMap features
// once (rate-limited, backed off, mirror-fallback), computes per-plot distances,
// and upserts plot_geo. Tolerant of OSM failure (stores osm_ok=false; retried next
// run). Handles ONLY plot + geography data — never PII.
import { createClient } from '@supabase/supabase-js';
import { plotCentroid, parseOverpass, overpassQuery } from '../src/lib/server/geo-utils.js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the environment.');
	process.exit(1);
}
const GW = (process.env.TAUSI_GATEWAY_BASE || 'https://tausi.tamisemi.go.tz/kivuko').replace(/\/+$/, '');
const LAND = 'tausi-landsales-service';
const OVERPASS = (process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter')
	.split(',').map((s) => s.trim()).filter(Boolean);
const OSM_DELAY_MS = Number(process.env.OSM_DELAY_MS || 1100); // be kind to the free service
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const MAX_CELLS = args['max-cells'] ? Number(args['max-cells']) : Infinity;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const listOf = (j) => { const d = j?.data; if (!d) return []; if (Array.isArray(d.itemList)) return d.itemList; if (d.item) return [d.item]; if (Array.isArray(d)) return d; return []; };

async function tausi(path, { method = 'GET', body, query, timeoutMs = 25000 } = {}) {
	const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString() : '';
	const c = new AbortController();
	const t = setTimeout(() => c.abort(), timeoutMs);
	try {
		const res = await fetch(`${GW}/${LAND}${path}${qs}`, {
			method,
			headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
			body: body ? JSON.stringify(body) : undefined,
			signal: c.signal
		});
		const txt = await res.text();
		clearTimeout(t);
		if (!res.ok) throw new Error('HTTP ' + res.status);
		return JSON.parse(txt);
	} catch (e) {
		clearTimeout(t);
		throw e;
	}
}

async function councilCodes() {
	const set = new Set();
	for (const ep of ['council-summary', 'sold-council-summary']) {
		try {
			for (const r of listOf(await tausi(`/api/v1/land-open-project/${ep}`))) if (r.administrativeAreaCode != null) set.add(String(r.administrativeAreaCode));
		} catch (e) {
			console.warn(`[warn] ${ep}: ${e.message}`);
		}
	}
	return [...set];
}
async function projectIds(code) {
	const ids = new Set();
	for (const ep of ['council-project', 'sold-council-project']) {
		try {
			for (const r of listOf(await tausi(`/api/v1/land-open-project/${ep}`, { query: { administrativeAreaCode: code, pageNo: 0, pageSize: 200 } }))) {
				const pid = r.projectId ?? r.landProjectId ?? r.id;
				if (pid != null) ids.add(String(pid));
			}
		} catch (e) {
			console.warn(`[warn] ${ep} ${code}: ${e.message}`);
		}
	}
	return [...ids];
}
async function projectFeatures(pid) {
	const j = await tausi('/api/v1/land-open-project/search', {
		method: 'POST',
		query: { pageNo: 0, pageSize: 5000 },
		body: { projectId: pid, minPrice: 0, maxPrice: 0, minLegalArea: 0, maxLegalArea: 0 },
		timeoutMs: 40000
	});
	const fc = j?.data?.features;
	return Array.isArray(fc) ? fc : Array.isArray(fc?.features) ? fc.features : [];
}

// ---- Overpass: once per ~1km cell, rate-limited + backoff + mirror fallback ----
const cellCache = new Map();
let lastOsmAt = 0, cellsFetched = 0;
async function osmForCell(lat, lon) {
	const key = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
	if (cellCache.has(key)) return cellCache.get(key);
	if (cellsFetched >= MAX_CELLS) { const v = { ok: false, elements: [] }; cellCache.set(key, v); return v; }
	const wait = OSM_DELAY_MS - (Date.now() - lastOsmAt);
	if (wait > 0) await sleep(wait);
	lastOsmAt = Date.now();
	cellsFetched++;
	const q = overpassQuery(lat, lon);
	let elements = null;
	for (const endpoint of OVERPASS) {
		for (let attempt = 0; attempt < 2 && elements == null; attempt++) {
			const c = new AbortController();
			const t = setTimeout(() => c.abort(), 40000);
			try {
				const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: 'data=' + encodeURIComponent(q), signal: c.signal });
				const txt = await res.text();
				clearTimeout(t);
				if ([429, 502, 503, 504].includes(res.status)) { if (attempt === 0) { await sleep(2500); continue; } break; }
				if (!res.ok) break;
				const j = JSON.parse(txt);
				elements = Array.isArray(j?.elements) ? j.elements : [];
			} catch {
				clearTimeout(t);
				if (attempt === 1) break;
				await sleep(1200);
			}
		}
		if (elements != null) break;
	}
	const v = { ok: elements != null, elements: elements || [] };
	cellCache.set(key, v);
	return v;
}

// ---- main ----
let buffer = [];
async function flush() {
	if (!buffer.length) return;
	const batch = buffer.splice(0, buffer.length);
	const { error } = await supabase.from('plot_geo').upsert(batch, { onConflict: 'project_id,lot_number,block' });
	if (error) console.error(`[error] upsert (${batch.length}): ${error.message}`);
}

(async () => {
	const started = Date.now();
	let projects;
	if (args.project) {
		projects = [String(args.project)];
	} else {
		const codes = await councilCodes();
		console.log(`councils: ${codes.length}`);
		const all = new Set();
		for (const code of codes) for (const pid of await projectIds(code)) all.add(pid);
		projects = [...all];
	}
	console.log(`projects: ${projects.length}${MAX_CELLS !== Infinity ? ` (max ${MAX_CELLS} OSM cells)` : ''}`);

	let plots = 0, withGeom = 0, osmOk = 0;
	for (let i = 0; i < projects.length; i++) {
		const pid = projects[i];
		let feats;
		try {
			feats = await projectFeatures(pid);
		} catch (e) {
			console.warn(`[warn] search ${pid}: ${e.message}`);
			continue;
		}
		for (const f of feats) {
			const p = f?.properties || {};
			plots++;
			const centroid = plotCentroid(f?.geometry);
			let nearest = null, osm_ok = false;
			if (centroid) {
				withGeom++;
				const cell = await osmForCell(centroid.lat, centroid.lon);
				if (cell.ok) { nearest = parseOverpass(cell.elements, centroid.lat, centroid.lon); osm_ok = true; osmOk++; }
			}
			buffer.push({
				project_id: pid,
				lot_number: String(p.lotNumber ?? ''),
				block: String(p.block ?? ''),
				land_plot_id: p.landPlotId != null ? String(p.landPlotId) : null,
				lat: centroid?.lat ?? null,
				lon: centroid?.lon ?? null,
				nearest,
				osm_ok,
				computed_at: new Date().toISOString()
			});
			if (buffer.length >= 200) await flush();
		}
		console.log(`[${i + 1}/${projects.length}] project ${pid}: ${feats.length} plots · cells ${cellsFetched} · osm_ok ${osmOk}`);
	}
	await flush();
	console.log(`\nDONE in ${Math.round((Date.now() - started) / 1000)}s — plots ${plots}, with-geometry ${withGeom}, osm_ok ${osmOk}, cells fetched ${cellsFetched}.`);
	process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
