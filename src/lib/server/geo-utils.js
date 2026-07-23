// Pure geometry + OpenStreetMap helpers — NO framework imports ($env/$lib/logger),
// so BOTH the server (location-context.js) and the standalone sync script
// (scripts/sync-plot-geo.mjs, run under plain node) can import them.

const clean = (s, max = 60) => {
	const t = String(s ?? '').replace(/\s+/g, ' ').trim();
	return t.length > max ? t.slice(0, max).trimEnd() + '…' : t;
};

/** Area-weighted centroid of one ring [[lon,lat],…]; vertex mean for a degenerate
 *  (zero-area) ring. Returns { lon, lat, area } or null. */
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

/** Centroid { lat, lon } of a plot's (Multi)Polygon geometry — outer ring of the
 *  largest sub-polygon by area. null if geometry is unusable. */
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

/** Nearest straight-line distance (km) from (lat,lon) to an OSM element, using its
 *  full geometry (way/relation vertices from `out geom`) when present. */
export function nearestKm(e, lat, lon) {
	if (Array.isArray(e.geometry) && e.geometry.length) {
		let best = Infinity;
		for (const g of e.geometry) {
			if (Number.isFinite(g?.lat) && Number.isFinite(g?.lon)) {
				const d = haversineKm(lat, lon, g.lat, g.lon);
				if (d < best) best = d;
			}
		}
		return best === Infinity ? null : best;
	}
	if (Number.isFinite(e.lat) && Number.isFinite(e.lon)) return haversineKm(lat, lon, e.lat, e.lon);
	if (Number.isFinite(e.center?.lat) && Number.isFinite(e.center?.lon)) return haversineKm(lat, lon, e.center.lat, e.center.lon);
	return null;
}

/** Categorise raw OSM elements → nearest per category, measured from (lat,lon).
 *  Returns { road, place, school, health, market, water, rail } of {name,km}|null. */
export function parseOverpass(elements, lat, lon) {
	const els = Array.isArray(elements) ? elements : [];
	const cats = { road: null, place: null, school: null, health: null, market: null, water: null, rail: null };
	const consider = (cat, e, name) => {
		const km = nearestKm(e, lat, lon);
		if (km == null) return;
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

/** The Overpass QL query for features near a centroid. */
export function overpassQuery(lat, lon) {
	return (
		`[out:json][timeout:25];(` +
		`nwr(around:25000,${lat},${lon})[place~"^(city|town|village)$"];` +
		`nwr(around:12000,${lat},${lon})[amenity~"^(school|hospital|clinic|marketplace|pharmacy)$"];` +
		`nwr(around:12000,${lat},${lon})[amenity=drinking_water];` +
		`nwr(around:12000,${lat},${lon})[man_made~"^(water_well|water_works|borehole)$"];` +
		`way(around:12000,${lat},${lon})[highway~"^(trunk|primary)$"];` +
		`nwr(around:25000,${lat},${lon})[railway=station];` +
		`);out geom;`
	);
}
