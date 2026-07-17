<script>
	// A premium-feature gate that sells the value instead of just disabling things.
	// Shows the feature, its business value, and the plan that unlocks it.
	import { FEATURE_VALUE } from '$lib/feature-value.js';
	export let feature; // exact plan feature label
	export let planName = null; // plan that unlocks it (optional)
	export let reason = null; // optional context line (e.g. why it would help them now)
	export let upgradeHref = '/portal/billing';
	export let compareHref = '/portal/billing#plans';
	$: why = FEATURE_VALUE[feature] ?? null;
</script>

<div class="locked">
	<div class="locked-head">
		<span class="lock" aria-hidden="true">🔒</span>
		<div class="locked-title">
			<div class="lf-name">{feature}</div>
			{#if planName}<div class="lf-plan">Available on {planName}</div>{/if}
		</div>
	</div>
	{#if why}<p class="lf-why">{why}</p>{/if}
	{#if reason}<p class="lf-reason">{reason}</p>{/if}
	<div class="lf-actions">
		<a class="btn sm" href={upgradeHref}>{planName ? `Unlock with ${planName}` : 'Upgrade to unlock'}</a>
		<a class="btn sm ghost" href={compareHref}>Compare plans</a>
	</div>
</div>

<style>
	.locked {
		border: 1px solid var(--edge);
		border-radius: 14px;
		background:
			linear-gradient(135deg, rgba(var(--gold-rgb), 0.06), transparent 60%),
			var(--panel-2);
		padding: 1rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.locked-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.lock {
		font-size: 1.05rem;
		line-height: 1;
	}
	.lf-name {
		font-weight: 700;
		color: var(--strong);
		font-size: 0.98rem;
	}
	.lf-plan {
		font-size: 0.74rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--mint);
	}
	.lf-why {
		margin: 0;
		font-size: 0.88rem;
		color: var(--body);
		line-height: 1.5;
	}
	.lf-reason {
		margin: 0;
		font-size: 0.82rem;
		color: var(--muted);
		line-height: 1.5;
	}
	.lf-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.2rem;
	}
</style>
