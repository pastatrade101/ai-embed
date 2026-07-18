// Display-only USD → platform-currency conversion. AI provider costs (Claude,
// Voyage) are billed in USD; revenue is in each plan's own currency. To show the
// two side by side (margins, cost tiles) we convert AI cost into the platform
// currency with an approximate, human-readable rate. Isomorphic (no server
// imports) so both server aggregations and client components share one source.
export const USD_TO = {
	USD: 1,
	TZS: 2600,
	KES: 130,
	UGX: 3800,
	RWF: 1300,
	NGN: 1600,
	ZAR: 18,
	GHS: 15,
	EUR: 0.92,
	GBP: 0.79
};

/** Convert a USD amount into the given platform currency. Unknown currency →
 *  rate 1 (best-effort: show the raw USD figure rather than an invented scale). */
export function usdToLocal(usd, currency = 'USD') {
	const rate = USD_TO[currency] ?? 1;
	return (Number(usd) || 0) * rate;
}
