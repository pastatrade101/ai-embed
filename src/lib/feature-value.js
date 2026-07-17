// Shared, non-server copy: a one-line business value for each advertised plan
// feature, keyed by the EXACT label stored in plans.features. Used by the Growth
// Advisor (server) and the LockedFeature component (client), so this file must
// stay free of any server-only imports.
export const FEATURE_VALUE = {
	'Website chat widget': 'Answer visitors right on your own website, not only your hosted page.',
	'Email lead alerts': 'Get an email the moment a booking-ready lead arrives.',
	'Conversation history & summaries': 'Review every chat with an AI summary of what each customer wants.',
	'Structured tours & pricing': 'Give the AI exact prices, dates and inclusions so answers stay accurate.',
	'Bulk knowledge import (CSV/JSON)': 'Load your whole catalogue at once instead of item by item.',
	'Remove "Powered by Makutano" badge': 'Present the assistant fully under your own brand.',
	'AI data analyst': 'Ask your numbers anything — top tours, where leads stall — answered instantly.',
	'AI research assistant': 'Auto-draft new knowledge from the web to answer what customers keep asking.',
	'Advanced (Sonnet) AI model': 'A stronger model for more nuanced, higher-quality replies.',
	'Chat file attachments (photos & PDFs)': 'Let customers send a passport, receipt or screenshot for the AI to read.',
	'Dedicated support': 'Priority help from the Makutano team when you need it.',
	'Website Knowledge Sync': 'Keep the AI in sync with your website automatically as it changes.',
	'Hosted AI page + QR code': 'A ready-made booking page and QR code — no website needed.',
	'WhatsApp lead handoff': 'Send booking-ready customers straight to your WhatsApp with full context.',
	'AI-qualified leads': 'Every enquiry scored and organised into a clean lead record.'
};

/** Name of the cheapest active plan whose features include `label` (or null). */
export function unlockingPlanName(plans, label) {
	const p = (plans ?? [])
		.filter((pl) => pl.is_active !== false && Array.isArray(pl.features) && pl.features.includes(label))
		.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))[0];
	return p?.name ?? null;
}
