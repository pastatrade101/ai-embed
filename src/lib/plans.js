// The catalogue of capabilities a plan can include. Shown as checkboxes in the
// admin Plans console and rendered as bullet points on the operator's billing
// page. The label strings are what get stored in plans.features and displayed —
// keep them human-readable. (Conversation cap is a separate numeric field.)
// Only capabilities the product actually enforces or delivers are listed, so plans
// never over-promise. (Removed: "Priority responses", "Custom branding & logo",
// "Multiple websites" — not enforced and not trivially deliverable.)
export const PLAN_FEATURES = [
	'Hosted AI page + QR code',
	'Website chat widget',
	'WhatsApp lead handoff',
	'Email lead alerts',
	'AI-qualified leads',
	'Conversation history & summaries',
	'Structured tours & pricing',
	'Bulk knowledge import (CSV/JSON)',
	'Website Knowledge Sync',
	'AI data analyst',
	'AI research assistant',
	'Advanced (Sonnet) AI model',
	'Chat file attachments (photos & PDFs)',
	'Remove "Powered by Makutano" badge',
	'Dedicated support'
];
