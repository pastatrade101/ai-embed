// Public hosted AI page — the "no website needed" entry point. Anyone with the
// link (or QR) can chat with an operator's assistant. No auth. Only public-safe
// fields are exposed. Also loads structured tour cards (real data — no photos,
// so the UI uses elegant placeholders) for the premium concierge experience.
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { listTours, departuresByItem } from '$lib/server/tours.js';

const metaGet = (md, ...keys) => {
	if (!md || typeof md !== 'object') return null;
	for (const k of Object.keys(md)) {
		if (keys.some((want) => k.toLowerCase().includes(want))) {
			const v = md[k];
			if (v != null && String(v).trim()) return String(v).trim();
		}
	}
	return null;
};

// Pull a day-by-day itinerary out of free-text bodies ("Day 1: ...", "Day 2 – ...").
// Returns [] when there's no clear structure so the UI can fall back gracefully.
function parseItinerary(body) {
	if (!body) return [];
	const steps = [];
	const re = /(^|\n)\s*day\s*(\d+)\s*[:.\-–—]?\s*(.*?)(?=(?:\n\s*day\s*\d+\b)|$)/gis;
	let m;
	while ((m = re.exec(body)) !== null) {
		const day = Number(m[2]);
		const text = m[3].replace(/\s+/g, ' ').trim();
		if (text) steps.push({ day, text });
	}
	return steps.length >= 2 ? steps.slice(0, 20) : [];
}

function firstPara(body) {
	if (!body) return '';
	const p = String(body).split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
	return p.length > 220 ? p.slice(0, 217).trimEnd() + '…' : p;
}

export async function load({ params }) {
	const { data: client } = await supabase
		.from('clients')
		.select(
			'id, slug, name, logo_url, brand_color, whatsapp_number, contact_email, phone, address, business_hours, languages, assistant_name, welcome_message, suggested_questions, is_active, subscription_status'
		)
		.eq('slug', params.slug)
		.maybeSingle();

	if (!client || !client.is_active || client.subscription_status === 'canceled') {
		throw error(404, 'This assistant is not available.');
	}

	// Structured tour cards from real catalogue data.
	let tours = [];
	try {
		const items = await listTours(client.id);
		const deps = await departuresByItem(client.id, items.map((t) => t.id));
		tours = items.map((t) => ({
			id: t.id,
			title: t.title,
			price: t.price_amount ?? null,
			currency: t.price_currency ?? 'USD',
			duration: metaGet(t.metadata, 'duration'),
			season: metaGet(t.metadata, 'season', 'month'),
			destination: metaGet(t.metadata, 'destination', 'route', 'park', 'location'),
			// Strip a leading "max"/"up to" so the card's "Max {n}" doesn't read "Max max 6".
			maxGroup: (metaGet(t.metadata, 'group', 'max people', 'max') || '').replace(/^\s*(max(imum)?|up to)\s+/i, '').trim() || null,
			summary: firstPara(t.body),
			itinerary: parseItinerary(t.body),
			departures: (deps[t.id] ?? []).slice(0, 5).map((d) => ({
				date: d.start_date,
				price: d.price_amount ?? null,
				currency: d.currency ?? t.price_currency ?? 'USD',
				seats: d.seats_available ?? null,
				status: d.status ?? 'open'
			}))
		}));
	} catch (e) {
		tours = []; // tours are a bonus; never block the page
	}

	return {
		client: {
			slug: client.slug,
			name: client.name,
			logo: client.logo_url ?? null,
			brand: client.brand_color ?? '#0f6e56',
			whatsapp: client.whatsapp_number ?? null,
			email: client.contact_email ?? null,
			phone: client.phone ?? null,
			address: client.address ?? null,
			hours: client.business_hours ?? null,
			languages: client.languages ?? null,
			assistantName: client.assistant_name ?? null,
			welcome: client.welcome_message ?? null,
			suggestions: Array.isArray(client.suggested_questions) ? client.suggested_questions.slice(0, 6) : []
		},
		tours
	};
}
