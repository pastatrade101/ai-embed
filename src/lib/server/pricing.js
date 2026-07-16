// Rough USD pricing per 1M tokens, used to estimate per-turn AI cost for the
// usage dashboard. Approximate — for display and overage signals, not billing
// of record. Update if Anthropic pricing changes.
const PRICING = {
	'claude-haiku-4-5': { in: 1, out: 5, cacheRead: 0.1, cacheWrite: 1.25 },
	'claude-sonnet-5': { in: 3, out: 15, cacheRead: 0.3, cacheWrite: 3.75 },
	'claude-opus-4-8': { in: 5, out: 25, cacheRead: 0.5, cacheWrite: 6.25 },
	// Voyage embeddings (input-only; no output or cache tiers). ~USD per 1M tokens.
	'voyage-3': { in: 0.06, out: 0, cacheRead: 0, cacheWrite: 0 }
};

/**
 * Estimate the USD cost of a single Anthropic response from its usage object.
 * @param {string} model
 * @param {{ input_tokens?:number, output_tokens?:number, cache_read_input_tokens?:number, cache_creation_input_tokens?:number }} u
 */
export function estimateCost(model, u = {}) {
	const p = PRICING[model] ?? PRICING['claude-haiku-4-5'];
	const input = u.input_tokens ?? 0;
	const output = u.output_tokens ?? 0;
	const cacheRead = u.cache_read_input_tokens ?? 0;
	const cacheWrite = u.cache_creation_input_tokens ?? 0;
	return (input * p.in + output * p.out + cacheRead * p.cacheRead + cacheWrite * p.cacheWrite) / 1_000_000;
}
