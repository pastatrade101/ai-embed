<script>
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: client = data.client;
	$: cap = client.monthly_conversation_cap ?? 0;
	$: usagePct = cap > 0 ? Math.min(100, Math.round((data.usedThisMonth / cap) * 100)) : 0;
	$: usageClass = usagePct >= 100 ? 'over' : usagePct >= 80 ? 'warn' : '';
	const statusLabel = { active: 'Active', trialing: 'Trial', past_due: 'Payment due', canceled: 'Canceled' };
	$: justReturned = $page.url.searchParams.get('upgrade') === 'success';
	const planName = (key) => data.plans.find((p) => p.key === key)?.name ?? key;
	let verifying = false;
</script>

<div class="page-head">
	<div>
		<h1>Plan &amp; billing</h1>
		<div class="sub">
			{#if data.paymentsEnabled}
				Upgrade instantly — pay by mobile money or card through Snippe’s secure checkout.
			{:else}
				Your current plan and usage. To upgrade or change plans, contact us — we’ll sort it out with you directly.
			{/if}
		</div>
	</div>
</div>

{#if form?.ok}
	<div class="notice">{form.message}</div>
{:else if form?.ok === false}
	<div class="notice">{form.message}</div>
{/if}
{#if form?.error}
	<div class="notice err">{form.error}</div>
{/if}

{#if justReturned || data.pendingAttempt}
	<div class="notice">
		{#if justReturned}
			Thanks! Payment can take a moment to confirm.
		{:else}
			You have an upgrade to <b>{planName(data.pendingAttempt.plan_key)}</b> in progress.
		{/if}
		If your plan hasn’t updated yet, check its status:
		<form method="POST" action="?/verifyPayment" use:enhance={() => { verifying = true; return async ({ update }) => { verifying = false; await update(); }; }} style="display:inline">
			<button class="btn sm" type="submit" disabled={verifying} style="margin-left:.4rem">{verifying ? 'Checking…' : 'Check payment status'}</button>
		</form>
	</div>
{/if}

<div class="card">
	<div class="rowflex" style="justify-content:space-between">
		<div>
			<h2 class="section" style="margin:0">{data.currentPlan?.name ?? client.plan}</h2>
			<div class="muted">{data.currentPlan ? (Number(data.currentPlan.price_amount) > 0 ? `${data.currentPlan.price_currency} ${data.currentPlan.price_amount} / month` : 'Free') : ''}</div>
		</div>
		<span class="badge {client.subscription_status === 'active' ? '' : 'off'}">{statusLabel[client.subscription_status] ?? client.subscription_status}</span>
	</div>

	<div style="margin-top:1rem">
		<div class="rowflex" style="justify-content:space-between"><span class="muted" style="font-size:.85rem">Conversations this month</span><span class="mono">{data.usedThisMonth} / {cap}</span></div>
		<div class="usage {usageClass}"><span style={`width:${usagePct}%`}></span></div>
		{#if usagePct >= 100}<div class="hint" style="color:var(--danger)">You've reached your monthly cap — the assistant will pause new conversations until next month or an upgrade.</div>{/if}
	</div>

	{#if data.currentPlan?.features?.length}
		<ul style="margin:1rem 0 0;padding-left:1.1rem;color:var(--body);font-size:.9rem">
			{#each data.currentPlan.features as f}<li>{f}</li>{/each}
		</ul>
	{/if}
</div>

<h2 class="section">AI usage this month</h2>
<div class="stat-grid">
	<div class="tile"><div class="k">Turns</div><div class="v">{data.usage.turns}</div><div class="foot">AI replies generated</div></div>
	<div class="tile"><div class="k">Input tokens</div><div class="v" style="font-size:1.5rem">{data.usage.inputTokens.toLocaleString()}</div><div class="foot">{data.usage.cachedTokens.toLocaleString()} cached</div></div>
	<div class="tile"><div class="k">Output tokens</div><div class="v" style="font-size:1.5rem">{data.usage.outputTokens.toLocaleString()}</div><div class="foot">assistant responses</div></div>
	<div class="tile"><div class="k">Est. AI cost</div><div class="v">${data.usage.cost.toFixed(2)}</div><div class="foot">approximate, this month</div></div>
</div>

<h2 class="section">All plans</h2>
<div class="plans-grid">
	{#each data.plans as p (p.key)}
		<div class="card plan-card" class:is-current={p.key === client.plan}>
			<div class="plan-top">
				<span class="plan-name">{p.name}</span>
				{#if p.key === client.plan}<span class="badge">current</span>{:else if p.is_default}<span class="badge neutral">default</span>{/if}
			</div>
			<div class="plan-price">
				{#if Number(p.price_amount) > 0}{p.price_currency} {Number(p.price_amount).toLocaleString()}<span class="per"> /mo</span>{:else}Free{/if}
			</div>
			<div class="plan-cap">{Number(p.monthly_conversation_cap).toLocaleString()} conversations / month</div>

			{#if p.features?.length}
				<ul class="plan-feats">
					{#each p.features as f}
						<li>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
							<span>{f}</span>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="plan-foot">
				{#if p.key === client.plan}
					<button class="btn ghost plan-cta" type="button" disabled>Current plan</button>
				{:else if Number(p.price_amount) > 0}
					{#if data.paymentsEnabled}
						<form method="POST" action="?/checkout">
							<input type="hidden" name="plan" value={p.key} />
							<button class="btn plan-cta" type="submit">Get {p.name}</button>
						</form>
					{:else}
						<span class="btn ghost plan-cta disabled">Contact us to upgrade</span>
					{/if}
				{:else}
					<span class="btn ghost plan-cta disabled">Contact us to switch</span>
				{/if}
			</div>
		</div>
	{/each}
</div>

{#if data.paymentsEnabled}
	<p class="hint" style="margin-top:1rem">Secure checkout by <b>Snippe</b>. You’ll be redirected to pay, then returned here — your plan activates automatically once payment confirms.</p>
{/if}

<style>
	.plans-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: 1rem;
		align-items: stretch;
	}
	.plan-card {
		display: flex;
		flex-direction: column;
		padding: 1.35rem;
	}
	.plan-card.is-current {
		border-color: var(--mint);
		box-shadow: inset 0 0 0 1px rgba(55, 224, 166, 0.5), var(--shadow);
	}
	.plan-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.plan-name {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--strong);
	}
	.plan-price {
		font-size: 1.6rem;
		font-weight: 800;
		color: var(--strong);
		letter-spacing: -0.02em;
		margin: 0.55rem 0 0.15rem;
	}
	.plan-price .per {
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--faint);
	}
	.plan-cap {
		color: var(--muted);
		font-size: 0.84rem;
	}
	.plan-feats {
		list-style: none;
		margin: 1.1rem 0 1.3rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.plan-feats li {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		font-size: 0.86rem;
		color: var(--body);
		line-height: 1.35;
	}
	.plan-feats svg {
		width: 15px;
		height: 15px;
		color: var(--mint);
		flex-shrink: 0;
		margin-top: 2px;
	}
	.plan-foot {
		margin-top: auto;
	}
	.plan-foot form,
	.plan-cta {
		width: 100%;
	}
	.plan-cta {
		justify-content: center;
	}
	.plan-cta.disabled,
	button.plan-cta:disabled {
		opacity: 0.55;
		cursor: default;
		pointer-events: none;
	}
</style>
