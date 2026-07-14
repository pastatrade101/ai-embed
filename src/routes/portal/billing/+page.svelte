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
<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr))">
	{#each data.plans as p}
		<div class="card" style={p.key === client.plan ? 'border-color:var(--mint)' : ''}>
			<div class="rowflex" style="justify-content:space-between">
				<strong>{p.name}</strong>
				{#if p.key === client.plan}<span class="badge">current</span>{/if}
			</div>
			<div style="font-size:1.5rem;font-weight:700;margin:.3rem 0">
				{#if Number(p.price_amount) > 0}{p.price_currency} {p.price_amount}<span class="faint" style="font-size:.85rem;font-weight:500"> /mo</span>{:else}Free{/if}
			</div>
			<div class="muted" style="font-size:.85rem">{p.monthly_conversation_cap} conversations / month</div>
			{#if p.features?.length}<ul style="margin:.7rem 0 .9rem;padding-left:1.1rem;font-size:.84rem;color:var(--body)">{#each p.features as f}<li>{f}</li>{/each}</ul>{/if}

			{#if p.key !== client.plan && Number(p.price_amount) > 0}
				{#if data.paymentsEnabled}
					<form method="POST" action="?/checkout">
						<input type="hidden" name="plan" value={p.key} />
						<button class="btn sm" type="submit" style="width:100%">Get {p.name}</button>
					</form>
				{:else}
					<a class="btn ghost sm" href="/portal/billing" style="width:100%;justify-content:center;pointer-events:none;opacity:.6">Contact us to upgrade</a>
				{/if}
			{/if}
		</div>
	{/each}
</div>

{#if data.paymentsEnabled}
	<p class="hint" style="margin-top:1rem">Secure checkout by <b>Snippe</b>. You’ll be redirected to pay, then returned here — your plan activates automatically once payment confirms.</p>
{/if}
