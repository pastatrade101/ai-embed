// Knowledge format + ingestion helpers.
//
// A knowledge item is one product / tour / itinerary / service:
//   title           (required) — the name a customer would recognise
//   category        e.g. tour, day-trip, climb, room, dish, service
//   price_amount    exact figure (a real number, injected verbatim — never guessed)
//   price_currency  e.g. USD, TZS
//   body            the human-readable description / full itinerary
//   metadata        flexible key→value facts (duration, group_size, includes,
//                   best_season, difficulty, …) — the same schema serves any vertical
//
// To make the assistant answer precisely, we don't embed the body alone: every
// chunk carries a compact "facts" line (title · category · price · key facts),
// and the structured facts are also embedded as their own chunk, so a question
// like "how much is the 5-day safari / what's included" retrieves the exact
// numbers regardless of which body chunk matches.

const CHUNK_TARGET = 500;

/** Split a body into ~500-char chunks on paragraph boundaries. */
export function splitText(body) {
	const clean = (body ?? '').trim();
	if (!clean) return [];
	const paras = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
	const chunks = [];
	let buf = '';
	for (const para of paras) {
		if ((buf + '\n\n' + para).length > CHUNK_TARGET && buf) {
			chunks.push(buf);
			buf = para;
		} else {
			buf = buf ? `${buf}\n\n${para}` : para;
		}
	}
	if (buf) chunks.push(buf);
	return chunks;
}

function metaEntries(metadata) {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
	return Object.entries(metadata).filter(([, v]) => v != null && v !== '');
}
const valStr = (v) => (Array.isArray(v) ? v.join(', ') : String(v));

/** Compact one-line facts header, prefixed to every body chunk. */
export function factsLine(item) {
	const parts = [];
	if (item.category) parts.push(item.category);
	if (item.price_amount != null && item.price_amount !== '')
		parts.push(`${item.price_currency ?? 'USD'} ${item.price_amount}`);
	for (const [k, v] of metaEntries(item.metadata)) parts.push(`${k}: ${valStr(v)}`);
	return parts.length ? `[${item.title}] ${parts.join(' · ')}` : `[${item.title}]`;
}

/** Multi-line structured facts, embedded as their own chunk. */
export function factsBlock(item) {
	const lines = [item.title];
	if (item.category) lines.push(`Category: ${item.category}`);
	if (item.price_amount != null && item.price_amount !== '')
		lines.push(`Price: ${item.price_currency ?? 'USD'} ${item.price_amount}`);
	for (const [k, v] of metaEntries(item.metadata)) lines.push(`${k}: ${valStr(v)}`);
	return lines.length > 1 ? lines.join('\n') : '';
}

/** Build the embeddable chunks for one item (facts + prefixed body chunks). */
export function chunkItem(item) {
	const header = factsLine(item);
	const chunks = [];
	const facts = factsBlock(item);
	if (facts) chunks.push(facts);
	for (const c of splitText(item.body)) chunks.push(`${header}\n${c}`);
	if (chunks.length === 0) chunks.push(header); // title-only item still retrievable
	return chunks;
}

// ---- Structured "details" (metadata) as editable text ---------------------

/** Parse a "Key: value" per-line block into a metadata object. */
export function parseDetails(text) {
	const md = {};
	for (const raw of String(text ?? '').split('\n')) {
		const line = raw.trim();
		if (!line) continue;
		const idx = line.indexOf(':');
		if (idx <= 0) continue;
		const key = line.slice(0, idx).trim();
		const value = line.slice(idx + 1).trim();
		if (key && value) md[key] = value;
	}
	return md;
}

/** Render a metadata object back to "Key: value" lines for editing. */
export function metadataToText(metadata) {
	return metaEntries(metadata).map(([k, v]) => `${k}: ${valStr(v)}`).join('\n');
}

// ---- Bulk parse: CSV or JSON ---------------------------------------------

// Reserved column names map onto real fields; every other column → metadata.
const FIELD_ALIASES = {
	title: 'title',
	name: 'title',
	category: 'category',
	type: 'category',
	price: 'price_amount',
	price_amount: 'price_amount',
	amount: 'price_amount',
	currency: 'price_currency',
	price_currency: 'price_currency',
	body: 'body',
	description: 'body',
	details: 'body'
};

function toNumberOrNull(v) {
	if (v == null || String(v).trim() === '') return null;
	const n = Number(String(v).replace(/[, ]/g, ''));
	return Number.isNaN(n) ? null : n;
}

function normalizeRow(obj) {
	const item = { title: '', category: null, price_amount: null, price_currency: null, body: null, metadata: {} };
	for (const [rawKey, rawVal] of Object.entries(obj)) {
		const key = String(rawKey).trim();
		const lower = key.toLowerCase();
		const val = typeof rawVal === 'string' ? rawVal.trim() : rawVal;
		if (lower === 'metadata' && val && typeof val === 'object') {
			Object.assign(item.metadata, val);
			continue;
		}
		const field = FIELD_ALIASES[lower];
		if (field === 'title') item.title = String(val ?? '').trim();
		else if (field === 'category') item.category = val ? String(val) : null;
		else if (field === 'price_amount') item.price_amount = toNumberOrNull(val);
		else if (field === 'price_currency') item.price_currency = val ? String(val).toUpperCase() : null;
		else if (field === 'body') item.body = val ? String(val) : null;
		else if (val !== '' && val != null) item.metadata[key] = val; // extra column → metadata
	}
	return item;
}

/** Minimal RFC-4180-ish CSV parser (quoted fields, embedded commas/newlines, "" escapes). */
function parseCSV(text) {
	const s = String(text).replace(/\r\n?/g, '\n');
	const rows = [];
	let row = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (inQuotes) {
			if (c === '"') {
				if (s[i + 1] === '"') { field += '"'; i++; }
				else inQuotes = false;
			} else field += c;
		} else if (c === '"') inQuotes = true;
		else if (c === ',') { row.push(field); field = ''; }
		else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
		else field += c;
	}
	if (field.length || row.length) { row.push(field); rows.push(row); }
	return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/**
 * Parse pasted CSV or JSON into normalized items.
 * @returns {{ items: object[], errors: string[] }}
 */
export function parseKnowledgeInput(text) {
	const trimmed = String(text ?? '').trim();
	if (!trimmed) return { items: [], errors: ['Nothing to import — paste CSV or JSON first.'] };

	let raw = [];
	const errors = [];

	if (trimmed[0] === '[' || trimmed[0] === '{') {
		try {
			const parsed = JSON.parse(trimmed);
			raw = Array.isArray(parsed) ? parsed : [parsed];
		} catch (e) {
			return { items: [], errors: [`Invalid JSON: ${e.message}`] };
		}
	} else {
		const rows = parseCSV(trimmed);
		if (rows.length < 2) return { items: [], errors: ['CSV needs a header row and at least one data row.'] };
		const header = rows[0].map((h) => h.trim());
		for (let r = 1; r < rows.length; r++) {
			const obj = {};
			header.forEach((h, i) => (obj[h] = rows[r][i] ?? ''));
			raw.push(obj);
		}
	}

	const items = [];
	raw.forEach((obj, i) => {
		const item = normalizeRow(obj);
		if (!item.title) {
			errors.push(`Row ${i + 1}: missing a title — skipped.`);
			return;
		}
		items.push(item);
	});

	return { items, errors };
}
