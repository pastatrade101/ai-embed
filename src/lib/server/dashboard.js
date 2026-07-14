// Turn the raw workspace (conversations, leads, knowledge, tours) into an
// "AI employee" dashboard — everything derived from EXISTING data, no schema
// changes. Pure functions so they're easy to reason about and test.

const STOP = new Set([
	'day', 'days', 'tour', 'tours', 'the', 'and', 'national', 'park', 'trip',
	'package', 'experience', 'adventure', 'route', 'from', 'with', 'your',
	'round', 'year', 'best', 'private', 'luxury', 'classic', 'group', 'offers'
]);

/** Build a keyword → representative-tour map from tour titles + destinations
    (not seasons, which add month/“year-round” noise). */
function tourKeywords(tours) {
	const map = new Map();
	for (const t of tours) {
		const bag = `${t.title ?? ''} ${t.destination ?? ''}`;
		for (const w of bag.split(/[^A-Za-z]+/)) {
			const k = w.toLowerCase();
			if (w.length > 3 && !STOP.has(k) && !map.has(k)) map.set(k, t);
		}
	}
	return map;
}

const convText = (c) =>
	(
		(Array.isArray(c.messages) ? c.messages.filter((m) => m.role === 'user').map((m) => m.content).join(' ') : '') +
		' ' +
		(c.summary ?? '')
	).toLowerCase();

/** Top topics customers ask about, matched against the operator's real tours. */
export function topInterests(conversations, tours, limit = 4) {
	const kw = tourKeywords(tours);
	if (!kw.size) return [];
	const counts = new Map();
	for (const c of conversations) {
		const text = convText(c);
		const seen = new Set();
		for (const [k] of kw) {
			if (!seen.has(k) && text.includes(k)) {
				counts.set(k, (counts.get(k) ?? 0) + 1);
				seen.add(k);
			}
		}
	}
	return [...counts.entries()]
		.filter(([, n]) => n > 0)
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([k, n]) => ({ term: k.charAt(0).toUpperCase() + k.slice(1), count: n }));
}

/** Parse a rough group size from free text ("5 people", "group of 4", "for 2"). */
function groupSize(text) {
	const s = String(text ?? '').toLowerCase();
	let m = s.match(/(\d{1,2})\s*(?:people|pax|adults?|guests?|travellers?|persons?)/);
	if (m) return Math.min(20, Number(m[1]));
	m = s.match(/(?:group of|party of|for)\s*(\d{1,2})/);
	if (m) return Math.min(20, Number(m[1]));
	return null;
}

/**
 * Score a lead 0–100 from real signals (contact details, detail of interest,
 * conversation depth). Honest heuristic — no fabricated CRM data.
 */
export function scoreLead(lead) {
	let s = 0;
	if (lead.whatsapp) s += 30;
	if (lead.email) s += 22;
	const interest = String(lead.interest ?? '').toLowerCase();
	if (interest.length > 6) s += 8;
	if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|month|202\d|next (week|month)|\d{1,2}(st|nd|rd|th))/.test(interest)) s += 12; // dates
	if (groupSize(interest) || /\bgroup|family|couple|honeymoon\b/.test(interest)) s += 10; // party
	if (/\$|budget|usd|tzs|\d{3,}/.test(interest)) s += 8; // budget signal
	const turns = Array.isArray(lead.transcript) ? lead.transcript.length : 0;
	if (turns >= 6) s += 20;
	else if (turns >= 3) s += 12;
	else if (turns >= 1) s += 5;
	return Math.min(100, s);
}

export function leadTier(score) {
	if (score >= 78) return { label: 'Ready to book', cls: 'hot' };
	if (score >= 55) return { label: 'High interest', cls: 'warm' };
	if (score >= 35) return { label: 'Needs follow-up', cls: 'cool' };
	return { label: 'Just browsing', cls: 'cold' };
}

/** A soft pipeline estimate grounded in the operator's real tour prices. */
export function pipeline(scoredLeads, tours) {
	const kw = tourKeywords(tours);
	const tiers = { hot: 0, warm: 0, cool: 0, cold: 0 };
	let value = 0;
	let matched = 0;
	for (const l of scoredLeads) {
		tiers[l.tier.cls] += 1;
		const text = `${l.interest ?? ''}`.toLowerCase();
		let tour = null;
		for (const [k, t] of kw) {
			if (text.includes(k)) {
				tour = t;
				break;
			}
		}
		if (tour && tour.price != null) {
			const g = groupSize(text) ?? 2;
			value += Number(tour.price) * g;
			matched += 1;
		}
	}
	const currency = tours.find((t) => t.price != null)?.currency ?? 'USD';
	return { tiers, value: Math.round(value), matched, currency };
}

/** Merge recent conversations + leads into a single reverse-chronological feed. */
export function activityFeed(conversations, leads, limit = 8) {
	const events = [];
	for (const c of conversations.slice(0, 15)) {
		const q = Array.isArray(c.messages) ? c.messages.find((m) => m.role === 'user')?.content ?? '' : '';
		const summarized = typeof c.summary === 'string' && c.summary.trim();
		events.push({
			type: summarized ? 'summary' : 'conversation',
			at: c.created_at,
			title: summarized ? 'Summarized a chat for you' : 'Answered a customer',
			detail: (q || '').slice(0, 80)
		});
	}
	for (const l of leads.slice(0, 15)) {
		events.push({
			type: 'lead',
			at: l.created_at,
			title: `Captured a lead${l.name ? ` · ${l.name}` : ''}`,
			detail: (l.interest ?? '').slice(0, 80)
		});
	}
	return events.filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}

/** Actionable items the operator should review — all derived from real state. */
export function aiTasks({ client, stats, leads, items }) {
	const tasks = [];
	if (!client.is_active) {
		tasks.push({ icon: 'pause', text: 'Your assistant is paused — reactivate it to start answering customers.', cta: 'Reactivate', href: '/portal/settings', level: 'danger' });
	}
	if ((stats.items ?? 0) === 0) {
		tasks.push({ icon: 'book', text: "Your assistant has no tours or info yet — it can only greet visitors.", cta: 'Add tours', href: '/portal/knowledge', level: 'warn' });
	}
	if (!client.whatsapp_number) {
		tasks.push({ icon: 'phone', text: 'Add a WhatsApp number so the assistant can hand you leads.', cta: 'Add number', href: '/portal/settings', level: 'warn' });
	}
	const uncontacted = (leads ?? []).length;
	if (uncontacted > 0) {
		tasks.push({ icon: 'user', text: `${uncontacted} lead${uncontacted === 1 ? '' : 's'} captured — follow up while they're warm.`, cta: 'View leads', href: '/portal/leads', level: 'info' });
	}
	const cap = client.monthly_conversation_cap ?? 0;
	if (cap > 0 && (stats.conversationsMonth ?? 0) / cap >= 0.8) {
		tasks.push({ icon: 'gauge', text: `You've used ${Math.round(((stats.conversationsMonth ?? 0) / cap) * 100)}% of this month's conversations.`, cta: 'See plans', href: '/portal/billing', level: 'warn' });
	}
	return tasks;
}
