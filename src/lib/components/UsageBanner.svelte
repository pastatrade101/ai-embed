<script>
	// In-app monthly-capacity banner shown across the portal. Driven entirely by the
	// existing credits.js budgetStatus (no new backend). Customer-facing copy is in
	// CONVERSATIONS, never dollars — the $ budget is an internal protection.
	//   approaching (>=80%) → informational
	//   critical    (>=95%) → warning
	//   grace/exhausted (>=100%) → upgrade prompt (history stays accessible)
	// Dismissible per level per session so it doesn't nag on every navigation, but
	// re-appears if usage escalates to a higher level.
	import { browser } from '$app/environment';
	export let usage = null;

	$: status = usage?.status ?? 'healthy';
	$: visibleLevel = ['approaching', 'critical', 'grace', 'exhausted'].includes(status);
	$: pct = usage?.pct ?? 0;
	$: left = usage?.estRemainingConversations ?? 0;
	$: convWord = left === 1 ? 'conversation' : 'conversations';

	$: tone = status === 'approaching' ? 'info' : status === 'critical' ? 'warn' : 'danger';
	$: message =
		status === 'approaching'
			? `You've used ${pct}% of this month's conversation capacity — about ${left} ${convWord} left.`
			: status === 'critical'
				? `Almost there: about ${left} ${convWord} left this month (${pct}%). Upgrade or add capacity to avoid any slowdown for your customers.`
				: `You've reached this month's conversation capacity. Your conversation history stays available and live chats keep running on a small grace buffer — upgrade or add capacity to restore full speed.`;
	$: ctaLabel = status === 'approaching' ? 'View plan' : 'Upgrade or add capacity';

	// Per-level, per-session dismissal.
	$: key = `ub:${status}`;
	let dismissed = false;
	$: if (browser && key) dismissed = sessionStorage.getItem(key) === '1';
	function close() {
		if (browser && key) sessionStorage.setItem(key, '1');
		dismissed = true;
	}
</script>

{#if visibleLevel && !dismissed}
	<div class="ub {tone}" role="status" aria-live="polite">
		<span class="ub-ico" aria-hidden="true">
			{#if tone === 'info'}
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
			{:else}
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
			{/if}
		</span>
		<span class="ub-msg">{message}</span>
		<a class="ub-cta" href="/portal/billing">{ctaLabel} →</a>
		<button class="ub-x" type="button" on:click={close} aria-label="Dismiss">×</button>
	</div>
{/if}

<style>
	.ub {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 0.95rem;
		border-radius: 12px;
		border: 1px solid;
		margin: 0 0 1rem;
		font-size: 0.9rem;
		line-height: 1.4;
	}
	.ub-ico { flex: none; display: inline-flex; }
	.ub-msg { flex: 1; min-width: 0; }
	.ub-cta {
		flex: none;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
		padding: 0.35rem 0.7rem;
		border-radius: 8px;
		border: 1px solid currentColor;
		transition: opacity 0.15s ease;
	}
	.ub-cta:hover { opacity: 0.8; }
	.ub-x {
		flex: none;
		background: none;
		border: none;
		color: inherit;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0.6;
		padding: 0 0.15rem;
	}
	.ub-x:hover { opacity: 1; }

	/* Tones — readable on the dark portal shell, self-contained so they don't
	   depend on app.css variables that may differ per surface. */
	.ub.info { background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.4); color: #bfdbfe; }
	.ub.warn { background: rgba(234, 179, 8, 0.13); border-color: rgba(234, 179, 8, 0.45); color: #fde68a; }
	.ub.danger { background: rgba(239, 68, 68, 0.14); border-color: rgba(239, 68, 68, 0.5); color: #fecaca; }

	@media (max-width: 640px) {
		.ub { flex-wrap: wrap; }
		.ub-msg { flex-basis: 100%; order: 3; }
	}
</style>
