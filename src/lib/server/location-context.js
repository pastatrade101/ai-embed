// Factual location-context layer for TAUSI land plots.
//
// Combines three clearly-labelled sources for ONE plot:
//   [TAUSI API]                     size, price, fees, status, council, region
//   [Official project description]  the council's own verbatim wording (Swahili)
//   [OpenStreetMap, retrieved <d>]  computed straight-line distances to nearby
//                                   geographic features
//
// HARD RULES (enforced by only ever emitting measured facts):
//   - No valuation, appreciation/growth forecasts, scoring, ranking, or
//     recommendations. No "prime location", "opportunity", "undervalued", etc.
//   - Nothing asserted beyond what the API text or a cited OSM feature supports.
//   - Only OpenStreetMap geographic features + official TAUSI text — never news,
//     listings, blogs, or market commentary.
//   - Only plot + geography data is handled — never owners, applicants, payments.
// Fails soft: if OSM is down, still return the TAUSI facts + official description
// and say distances could not be retrieved.
import { env } from '$env/dynamic/private';
import { log } from './whatsapp/logger.js';
import { searchProjectFeatures, projectDescriptionFor } from './govdata.js';

const PORTAL = (env.TAUSI_PORTAL_URL || 'https://tausi.tamisemi.go.tz').replace(/\/+$/, '');
const OVERPASS = env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const PLOT_STATUS = { 3: 'Available', 4: 'Reserved', 5: 'Sold', 6: 'Hold', 10: 'On Preview' };

const clean = (s, max = 140) => {
	let t = String(s ?? '').replace(/\s+/g, ' ').trim();
	if (t.length > max) t = t.slice(0, max).trimEnd() + '…';
	return t;
};
const numPos = (v) => {
	const n = Number(String(v ?? '').replace(/,/g, ''));
	return Number.isFinite(n) && n > 0 ? n : null;
};
const tzs = (v) => {
	const n = numPos(v);
	return n == null ? null : 'TZS ' + n.toLocaleString('en-US');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Geometry --------------------------------------------------------------

/** Area-weighted centroid of one ring [[lon,lat],…]; falls back to vertex mean
 *  for a degenerate (zero-area) ring. Returns { lon, lat, area } or null. */
export function ringCentroid(ring) {
	if (!Array.isArray(ring) || ring.length < 3) return null;
	let a = 0, cx = 0, cy = 0;
	for (let i = 0; i < ring.length - 1; i++) {
		const p1 = ring[i], p2 = ring[i + 1];
		if (!Array.isArray(p1) || !Array.isArray(p2)) continue;
		const [x1, y1] = p1, [x2, y2] = p2;
		if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
		const cross = x1 * y2 - x2 * y1;
		a += cross;
		cx += (x1 + x2) * cross;
		cy += (y1 + y2) * cross;
	}
	a *= 0.5;
	if (Math.abs(a) < 1e-12) {
		let sx = 0, sy = 0, n = 0;
		for (const pt of ring) {
			if (Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) { sx += pt[0]; sy += pt[1]; n++; }
		}
		return n ? { lon: sx / n, lat: sy / n, area: 0 } : null;
	}
	return { lon: cx / (6 * a), lat: cy / (6 * a), area: Math.abs(a) };
}

/** Centroid { lat, lon } of a plot's (Multi)Polygon geometry — the outer ring of
 *  the largest sub-polygon by area. Returns null if geometry is unusable. */
export function plotCentroid(geometry) {
	if (!geometry) return null;
	const polys =
		geometry.type === 'MultiPolygon' ? geometry.coordinates : geometry.type === 'Polygon' ? [geometry.coordinates] : null;
	if (!Array.isArray(polys) || !polys.length) return null;
	let best = null;
	for (const poly of polys) {
		const c = ringCentroid(poly?.[0]);
		if (c && (!best || c.area > best.area)) best = c;
	}
	return best ? { lat: best.lat, lon: best.lon } : null;
}

/** Straight-line (great-circle) distance in km. */
export function haversineKm(lat1, lon1, lat2, lon2) {
	const R = 6371;
	const toRad = (d) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
	const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// ---- OpenStreetMap (Overpass) — cached, backed-off, fail-soft --------------

const _osm = new Map();
const OSM_TTL_MS = 24 * 60 * 60 * 1000; // geographic features change slowly

function parseOverpass(json, lat, lon) {
	const els = Array.isArray(json?.elements) ? json.elements : [];
	const at = (e) => (e.lat != null ? { lat: e.lat, lon: e.lon } : e.center ? { lat: e.center.lat, lon: e.center.lon } : null);
	const cats = { road: null, place: null, school: null, health: null, market: null, water: null, rail: null };
	const consider = (cat, e, name) => {
		const p = at(e);
		if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return;
		const km = haversineKm(lat, lon, p.lat, p.lon);
		if (!cats[cat] || km < cats[cat].km) cats[cat] = { name: clean(name || '(unnamed)', 60), km };
	};
	for (const e of els) {
		const t = e.tags || {};
		const nm = t.name || t['name:sw'] || t['name:en'];
		if (t.highway) consider('road', e, nm ? `${nm} (${t.highway})` : `${t.highway} road`);
		else if (/^(city|town|village)$/.test(t.place || '')) consider('place', e, nm || t.place);
		else if (t.amenity === 'school') consider('school', e, nm || 'school');
		else if (t.amenity === 'hospital' || t.amenity === 'clinic' || t.amenity === 'pharmacy') consider('health', e, nm || t.amenity);
		else if (t.amenity === 'marketplace') consider('market', e, nm || 'market');
		else if (t.amenity === 'drinking_water' || /water_well|water_works|borehole/.test(t.man_made || '')) consider('water', e, nm || 'water point');
		else if (t.railway === 'station') consider('rail', e, nm || 'railway station');
	}
	return cats;
}

/** Nearest OSM features around a centroid, or null if Overpass is unavailable.
 *  Cached by rounded centroid (~1 km) so the free shared service isn't hammered. */
export async function overpassNearby(lat, lon) {
	const key = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
	const c = _osm.get(key);
	if (c && c.expires > Date.now()) return c.value;
	const q =
		`[out:json][timeout:25];(` +
		`nwr(around:25000,${lat},${lon})[place~"^(city|town|village)$"];` +
		`nwr(around:12000,${lat},${lon})[amenity~"^(school|hospital|clinic|marketplace|pharmacy)$"];` +
		`nwr(around:12000,${lat},${lon})[amenity=drinking_water];` +
		`nwr(around:12000,${lat},${lon})[man_made~"^(water_well|water_works|borehole)$"];` +
		`way(around:12000,${lat},${lon})[highway~"^(trunk|primary)$"];` +
		`nwr(around:25000,${lat},${lon})[railway=station];` +
		`);out center tags;`;
	for (let attempt = 0; attempt < 3; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 30000);
		try {
			const res = await fetch(OVERPASS, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
				body: 'data=' + encodeURIComponent(q),
				signal: controller.signal
			});
			const text = await res.text();
			clearTimeout(timer);
			if (res.status === 429 || res.status === 504) {
				await sleep(1200 * (attempt + 1)); // rate-limited / overloaded — back off
				continue;
			}
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const parsed = parseOverpass(JSON.parse(text), lat, lon);
			_osm.set(key, { value: parsed, expires: Date.now() + OSM_TTL_MS });
			return parsed;
		} catch (err) {
			clearTimeout(timer);
			if (attempt === 2) {
				log.warn('overpass_failed', { key, error: String(err?.message || err) });
				return null;
			}
			await sleep(800 * (attempt + 1));
		}
	}
	return null;
}

// ---- The tool --------------------------------------------------------------

/**
 * Factual location context for one plot. Returns an AI-readable, source-labelled
 * STRING and never throws (fails soft). opts: { lotNumber, block, administrativeAreaCode }.
 */
export async function plotLocationContext(projectId, opts = {}) {
	const id = String(projectId ?? '').trim();
	if (!id) return 'Ask which project (its id) first — get ids from land_council_projects — then call this with that project id (and optionally a lot number).';
	const date = new Date().toISOString().slice(0, 10);

	let feats;
	try {
		feats = await searchProjectFeatures(id);
	} catch (err) {
		log.warn('loc_search_failed', { projectId: id, error: String(err?.message || err) });
		return `The live TAUSI service could not be reached right now, so I can’t pull this plot. Tell the citizen to try again shortly or use the TAUSI portal: [TAUSI portal](${PORTAL}).`;
	}
	if (!feats.length) return `No plot detail is available for project “${clean(id, 40)}” right now.`;

	const lot = String(opts.lotNumber ?? '').trim();
	const blk = String(opts.block ?? '').trim();
	let feat;
	if (lot) {
		feat = feats.find((f) => {
			const p = f?.properties || {};
			return String(p.lotNumber ?? '') === lot && (!blk || String(p.block ?? '').toLowerCase() === blk.toLowerCase());
		});
		if (!feat) return `I couldn’t find Lot ${clean(lot, 20)}${blk ? ` (Block ${clean(blk, 10)})` : ''} in this project. Use project_plots to list its plots and their lot numbers first.`;
	} else {
		feat = feats.find((f) => f?.properties?.plotStatus === 3) || feats[0];
	}
	const p = feat.properties || {};

	// [TAUSI API]
	const size = numPos(p.legalArea);
	const unit = clean(p.unitOfMeasure || 'Sqm', 12);
	const status = PLOT_STATUS[p.plotStatus] ?? (p.plotStatus != null ? String(p.plotStatus) : 'Unknown');
	const council = clean(p.administrativeAreaName || '', 60);
	const region = clean(p.region || '', 40);
	const district = clean(p.district || '', 40);
	const factBits = [
		size && `size ${size.toLocaleString('en-US')} ${unit}`,
		tzs(p.price ?? p.totalLandPlotCost) && `price ${tzs(p.price ?? p.totalLandPlotCost)}`,
		tzs(p.applicationFee) && `application fee ${tzs(p.applicationFee)}`,
		tzs(p.firstInstallmentFee) && `first installment ${tzs(p.firstInstallmentFee)}`,
		`status ${status}`,
		clean(p.lotUse || '', 24) && `lot use ${clean(p.lotUse, 24)}`
	].filter(Boolean).join(' · ');
	const where = [council, district && `${district} District`, region && `${region} Region`].filter(Boolean).join(', ');
	const plotLabel = `Plot ${p.block != null ? `Block ${clean(p.block, 10)}, ` : ''}Lot ${clean(p.lotNumber ?? '?', 12)}`;
	const projName = clean(p.landProjectName || '', 80) || id;

	const out = [];
	out.push(`Location context for ${plotLabel} in ${projName}${where ? `, ${where}` : ''}. Retrieved ${date}.`);
	out.push(`[TAUSI API] ${factBits}.`);

	// [Official project description]
	let desc = null;
	if (opts.administrativeAreaCode) {
		try {
			desc = await projectDescriptionFor(opts.administrativeAreaCode, p.landProjectId ?? p.landProjectID ?? id);
		} catch {
			desc = null;
		}
	}
	if (desc && (desc.description || desc.terms)) {
		out.push(`[Official project description] "${clean(desc.description || desc.terms, 900)}" — this is the council’s own wording (usually Swahili). If the citizen wants English, offer a translation and mark it clearly AS a translation; keep the original too.`);
	} else {
		out.push(`[Official project description] Not available for this lookup${opts.administrativeAreaCode ? '' : ' (no council area code was provided — pass administrative_area_code to include it)'}.`);
	}

	// [OpenStreetMap]
	const centroid = plotCentroid(feat.geometry);
	if (!centroid) {
		out.push(`[OpenStreetMap] The plot boundary geometry was not available, so nearby-feature distances could not be computed.`);
	} else {
		const osm = await overpassNearby(centroid.lat, centroid.lon);
		if (!osm) {
			out.push(`[OpenStreetMap] Distance data could not be retrieved right now (the map service was unavailable). The TAUSI facts and official description above still stand.`);
		} else {
			const rows = [
				['Nearest primary/trunk road', osm.road],
				['Nearest town/village', osm.place],
				['Nearest school', osm.school],
				['Nearest health facility', osm.health],
				['Nearest market', osm.market],
				['Nearest water point', osm.water],
				['Railway station within 25 km', osm.rail]
			];
			const found = rows.filter(([, c]) => c).length;
			out.push(`[OpenStreetMap, retrieved ${date}] Straight-line distances (NOT road distance):`);
			for (const [label, c] of rows) out.push(`- ${label}: ${c ? `${c.name} ~${c.km.toFixed(1)} km` : 'none found in range'}`);
			if (found < 3) out.push(`OpenStreetMap has limited coverage for this (often rural) area — missing map data is NOT evidence that amenities are absent.`);
		}
	}

	out.push(
		`Distances are computed from OpenStreetMap and are indicative only (straight-line, not road distance). ` +
		`The official project description is the authoritative source. Buyers should confirm site details with the ${council || 'relevant council'} land office before applying.`
	);
	return out.join('\n');
}
