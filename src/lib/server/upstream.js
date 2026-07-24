// Reusable upstream-protection guard for live government / third-party APIs.
//
// The most important asset to protect is the UPSTREAM service, not this bot:
// inbound chat traffic must NEVER translate 1:1 into upstream load. Each
// institution's data module makes ONE guard instance for its host, so a per-host
// rate ceiling + circuit breaker + in-flight cap protect that upstream
// INDEPENDENTLY — an outage on one government API can never trip the breaker of
// another. This is the battle-tested pattern proven in govdata.js (TAUSI),
// lifted into a shared factory so every new institution inherits it for free.
//
// A guard's state is per closure (per createUpstreamGuard call), so two guards
// never share a limiter, queue or breaker. Per-process — the ceiling is per
// instance, which is the right granularity for a horizontally-scaled node app.
import { env } from '$env/dynamic/private';
import { log } from './whatsapp/logger.js';

// NaN-safe: a typo'd env falls back to the default, never silently disables a
// control (a NaN threshold would otherwise make a breaker that never opens).
const envNum = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/**
 * Create an isolated upstream guard for one host.
 * @param {object} cfg
 * @param {string} cfg.name        Human label used in errors + logs (e.g. 'NeST').
 * @param {string} cfg.envPrefix   Env var prefix for tunables (e.g. 'NEST' → NEST_MAX_RPS…).
 * @param {object} [cfg.defaults]  Per-host default tunables.
 * @returns {{ fetchJson: Function, circuitOpen: () => boolean }}
 */
export function createUpstreamGuard({ name, envPrefix, defaults = {} }) {
	const P = envPrefix;
	// One global outbound rate ceiling — caps our request rate no matter how many
	// users are chatting. A bounded queue sheds load rather than piling up.
	const MAX_RPS = Math.max(0.5, envNum(env[`${P}_MAX_RPS`], defaults.maxRps ?? 4));
	const MIN_INTERVAL_MS = 1000 / MAX_RPS;
	const MAX_QUEUE = Math.max(10, envNum(env[`${P}_MAX_QUEUE`], defaults.maxQueue ?? 60)); // callers waiting for a start slot
	const MAX_INFLIGHT = Math.max(2, envNum(env[`${P}_MAX_INFLIGHT`], defaults.maxInflight ?? 12)); // concurrent open connections
	const CB_THRESHOLD = Math.max(1, envNum(env[`${P}_CB_THRESHOLD`], defaults.cbThreshold ?? 5));
	const CB_COOLDOWN_MS = Math.max(1000, envNum(env[`${P}_CB_COOLDOWN_MS`], defaults.cbCooldownMs ?? 30000));
	const TIMEOUT_MS = Math.max(1000, envNum(env[`${P}_TIMEOUT_MS`], defaults.timeoutMs ?? 12000));

	let _rateChain = Promise.resolve();
	let _nextSlotAt = 0;
	let _queueDepth = 0;
	let _inFlight = 0;

	/** Wait for this call's turn under the global ceiling. Only spaces the START of
	 *  requests, so a slow fetch never blocks the queue behind it. */
	function acquireSlot() {
		_queueDepth++;
		_rateChain = _rateChain.then(async () => {
			const now = Date.now();
			const at = Math.max(now, _nextSlotAt);
			_nextSlotAt = at + MIN_INTERVAL_MS;
			if (at > now) await new Promise((r) => setTimeout(r, at - now));
		});
		return _rateChain.finally(() => { _queueDepth--; });
	}

	let _cbFailures = 0, _cbOpenUntil = 0;
	/** True while the breaker is open — callers should serve cached / fail soft. */
	const circuitOpen = () => Date.now() < _cbOpenUntil;
	function cbSuccess() { _cbFailures = 0; }
	function cbFailure() {
		if (++_cbFailures >= CB_THRESHOLD) {
			_cbOpenUntil = Date.now() + CB_COOLDOWN_MS;
			_cbFailures = 0;
			log.warn('upstream_circuit_open', { name, cooldownMs: CB_COOLDOWN_MS });
		}
	}
	/** Open the breaker for at least `ms` — honours an upstream Retry-After so a
	 *  throttled API is left alone for exactly as long as it asked (capped 5 min). */
	function cbBackoff(ms) {
		if (!(ms > 0)) return;
		_cbOpenUntil = Math.max(_cbOpenUntil, Date.now() + Math.min(ms, 5 * 60 * 1000));
		_cbFailures = 0;
		log.warn('upstream_circuit_backoff', { name, ms });
	}
	/** Parse a Retry-After header (delta-seconds or HTTP-date) → ms, or null. Never
	 *  throws — a missing/garbage header just means "no explicit backoff". */
	function retryAfterMs(headers) {
		try {
			const v = headers?.get?.('retry-after');
			if (!v) return null;
			const secs = Number(v);
			if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
			const when = Date.parse(v);
			return Number.isFinite(when) ? Math.max(0, when - Date.now()) : null;
		} catch {
			return null;
		}
	}

	/**
	 * Fetch `url` and return parsed JSON, under the rate ceiling + breaker. Throws
	 * on open circuit / saturation / timeout / network / non-2xx so callers fail
	 * soft. Only UPSTREAM distress (5xx, 429, 408, timeout, network) trips the
	 * breaker — a 4xx (our own bad request) does not, and neither does a GraphQL
	 * `errors` payload (that arrives HTTP 200 and is the caller's to inspect).
	 */
	async function fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = TIMEOUT_MS } = {}) {
		if (circuitOpen()) throw new Error(`${name} circuit open — serving fail-soft`);
		if (_queueDepth >= MAX_QUEUE) throw new Error(`${name} limiter saturated — serving fail-soft`);
		await acquireSlot(); // global outbound ceiling — independent of inbound volume
		// Cap concurrent OPEN connections. acquireSlot only spaces the START of calls;
		// a slow/timing-out upstream keeps sockets open long after their slot drained,
		// so without this a burst of slow calls stacks up ~MAX_RPS×timeout connections.
		if (_inFlight >= MAX_INFLIGHT) throw new Error(`${name} too many in-flight — serving fail-soft`);
		_inFlight++;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const res = await fetch(url, { method, headers, body, signal: controller.signal });
			const text = await res.text(); // read the body before clearing the timer
			if (!res.ok) {
				// Upstream distress trips the breaker: 5xx, 429 (rate limited), 408
				// (request timeout). 429/503 may carry Retry-After — honour it so we
				// never retry-storm a throttled government API. Other 4xx are OUR bad
				// request and must NOT trip the breaker.
				if (res.status >= 500 || res.status === 429 || res.status === 408) {
					cbFailure();
					cbBackoff(retryAfterMs(res.headers));
				}
				throw new Error(`HTTP ${res.status}`);
			}
			cbSuccess();
			try {
				return text ? JSON.parse(text) : {};
			} catch {
				throw new Error(`unparseable JSON from ${name}`);
			}
		} catch (err) {
			if (err?.name === 'AbortError' || /network|fetch failed|econn|enotfound|eai_again|timed out/i.test(String(err?.message || ''))) cbFailure();
			throw err?.name === 'AbortError' ? new Error(`${name} request timed out`) : err;
		} finally {
			clearTimeout(timer);
			_inFlight--;
		}
	}

	return { fetchJson, circuitOpen };
}
