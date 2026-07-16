<script>
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: client = data.client;
	$: credits = data.credits;
	// AI Usage (credit) bar — the friendly, budget-based view.
	$: barPct = Math.min(100, credits?.pct ?? 0);
	$: barClass = barPct >= 100 ? 'over' : barPct >= 80 ? 'warn' : '';
	const STATUS = {
		healthy: { label: 'Healthy', tone: 'ok' },
		approaching: { label: 'Approaching limit', tone: 'warn' },
		critical: { label: 'Almost used up', tone: 'warn' },
		grace: { label: 'Over allowance · grace', tone: 'danger' },
		exhausted: { label: 'Allowance used up', tone: 'danger' }
	};
	$: cStatus = STATUS[credits?.status] ?? STATUS.healthy;
	const fmtDate = (iso) => {
		try {
			return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
		} catch {
			return '';
		}
	};
	const nf = (n) => Number(n ?? 0).toLocaleString();
	// Estimated conversations for a plan, from its AI budget — the same basis the
	// usage dashboard uses, so plan cards and the meter agree.
	const planConversations = (p) => {
		const cpc = data.costPerConversation || 0.004;
		const budget = Number(p.included_ai_budget) || 0;
		return budget > 0 ? Math.round(budget / cpc) : Number(p.monthly_conversation_cap) || 0;
	};
	let showAdvanced = false;
	const statusLabel = { active: 'Active', trialing: 'Trial', past_due: 'Payment due', canceled: 'Canceled' };
	$: justReturned = $page.url.searchParams.get('upgrade') === 'success';
	$: boughtCredits = $page.url.searchParams.get('credits') === 'success';
	const planName = (key) => data.plans.find((p) => p.key === key)?.name ?? key;
	// Where a plan sits relative to the one the operator is on, so we only ever
	// offer real upgrades — never a "buy again" for the current or a lower tier.
	$: currentSort = data.currentPlan?.sort ?? -1;
	const rel = (p) => (p.key === client.plan ? 'current' : p.sort > currentSort ? 'upgrade' : 'downgrade');
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

{#if justReturned || boughtCredits || data.pendingAttempt}
	<div class="notice">
		{#if boughtCredits}
			Thanks! Your AI Credits will be added once payment confirms.
		{:else if justReturned}
			Thanks! Payment can take a moment to confirm.
		{:else}
			You have a payment in progress.
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
		<div class="rowflex" style="justify-content:space-between;align-items:baseline">
			<span class="muted" style="font-size:.85rem">AI usage this month</span>
			<span class="mono">{credits.pct}% · <span class="tone-{cStatus.tone}">{cStatus.label}</span></span>
		</div>
		<div class="usage {barClass}"><span style={`width:${barPct}%`}></span></div>
		<div class="rowflex" style="justify-content:space-between;margin-top:.45rem">
			<span class="hint">≈ {nf(credits.estRemainingConversations)} conversations left</span>
			<span class="hint">{fmtDate(credits.period.start)} – {fmtDate(credits.period.end)}</span>
		</div>
	</div>

	{#if data.currentPlan?.features?.length}
		<ul style="margin:1rem 0 0;padding-left:1.1rem;color:var(--body);font-size:.9rem">
			{#each data.currentPlan.features as f}<li>{f}</li>{/each}
		</ul>
	{/if}
</div>

<!-- Soft-limit banner: never abrupt; escalates 80 → 95 → 100+ (grace) -->
{#if credits.status === 'approaching'}
	<div class="soft warn">You're approaching your monthly AI allowance ({credits.pct}% used). Everything keeps working — consider an upgrade below if you expect a busy month.</div>
{:else if credits.status === 'critical'}
	<div class="soft warn">You've nearly used this month's AI allowance ({credits.pct}%). To avoid any slowdown for your customers, <a href="#plans">upgrade your plan</a>.</div>
{:else if credits.status === 'grace' || credits.status === 'exhausted'}
	<div class="soft danger">You've reached your monthly AI allowance. Your assistant is still running on a grace allowance so live chats aren't interrupted — <a href="#plans">upgrade your plan</a> to restore full capacity.</div>
{/if}

<h2 class="section">AI usage</h2>
<div class="usage-grid">
	<div class="card u-hero">
		<div class="u-pct tone-{cStatus.tone}">{credits.pct}<span>%</span></div>
		<div class="u-caption">of your monthly AI allowance used</div>
		<div class="usage {barClass}" style="margin:.8rem 0 1rem"><span style={`width:${barPct}%`}></span></div>
		<div class="u-row"><span class="muted">Estimated remaining</span><b>≈ {nf(credits.estRemainingConversations)} conversations</b></div>
		<div class="u-row"><span class="muted">Plan capacity</span><span>≈ {nf(credits.estTotalConversations)} / month</span></div>
		<div class="u-row"><span class="muted">Billing period</span><span>{fmtDate(credits.period.start)} – {fmtDate(credits.period.end)}</span></div>
		<div class="u-row"><span class="muted">Status</span><span class="tone-{cStatus.tone}">{cStatus.label}</span></div>
	</div>

	<div class="card u-forecast">
		<div class="k">Forecast</div>
		{#if credits.forecast.willExceed}
			<div class="f-big tone-warn">May exceed your plan</div>
			<div class="f-sub">At your current pace (~{credits.forecast.projectedPct}% projected this month){#if credits.forecast.exhaustsOnDay}, you could reach your allowance around day {credits.forecast.exhaustsOnDay}{/if}. An upgrade keeps things smooth.</div>
		{:else}
			<div class="f-big tone-ok">On track</div>
			<div class="f-sub">Projected ~{credits.forecast.projectedPct}% of your allowance this month — comfortably within your plan.</div>
		{/if}
		<div class="u-row" style="margin-top:.9rem"><span class="muted">Average daily usage</span><span>≈ {nf(credits.forecast.avgDailyConversations)} conversations</span></div>
		<div class="u-row"><span class="muted">Days left in period</span><span>{credits.period.daysRemaining}</span></div>
	</div>
</div>

{#if credits.categories.length}
	<h2 class="section">Where your AI is used</h2>
	<div class="card cat-card">
		{#each credits.categories as c}
			<div class="cat-row">
				<span class="cat-name">{c.label}</span>
				<div class="cat-bar"><span style={`width:${Math.max(3, c.pct)}%`}></span></div>
				<span class="cat-val">{c.pct}%</span>
			</div>
		{/each}
	</div>
{/if}

<button type="button" class="adv-toggle" on:click={() => (showAdvanced = !showAdvanced)} aria-expanded={showAdvanced}>
	{showAdvanced ? '▾' : '▸'} Advanced usage details
</button>
{#if showAdvanced}
	<div class="stat-grid">
		<div class="tile"><div class="k">Claude input</div><div class="v" style="font-size:1.4rem">{nf(credits.advanced.inputTokens)}</div><div class="foot">{nf(credits.advanced.cachedTokens)} cached</div></div>
		<div class="tile"><div class="k">Claude output</div><div class="v" style="font-size:1.4rem">{nf(credits.advanced.outputTokens)}</div><div class="foot">tokens generated</div></div>
		<div class="tile"><div class="k">Knowledge processing</div><div class="v" style="font-size:1.4rem">{nf(credits.advanced.embeddingTokens)}</div><div class="foot">Voyage embedding tokens</div></div>
		<div class="tile"><div class="k">Est. AI cost</div><div class="v">${credits.spent.toFixed(2)}</div><div class="foot">Claude ${credits.advanced.claudeCost.toFixed(2)} · Voyage ${credits.advanced.voyageCost.toFixed(2)}</div></div>
	</div>
{/if}

{#if data.paymentsEnabled}
	<h2 class="section" id="credits">Add AI Credits</h2>
	<p class="muted" style="margin:-0.4rem 0 0.9rem;font-size:0.9rem">
		Need more capacity this month? Top up instantly — credits apply to your current billing period ({fmtDate(credits.period.start)} – {fmtDate(credits.period.end)}).
		{#if credits.packCredits > 0}<br />You've added ≈ {nf(Math.round(credits.packCredits / 0.004))} conversations in top-ups this period.{/if}
	</p>
	<div class="packs-grid">
		{#each data.creditPacks as p (p.key)}
			<div class="card pack-card">
				<div class="pack-name">{p.label}</div>
				<div class="pack-price">{p.currency} {nf(p.price)}</div>
				<div class="pack-conv">≈ {nf(p.conversations)} more conversations</div>
				<form method="POST" action="?/buyCredits">
					<input type="hidden" name="pack" value={p.key} />
					<button class="btn pack-cta" type="submit">Buy {p.label} pack</button>
				</form>
			</div>
		{/each}
	</div>
{/if}

<h2 class="section" id="plans">All plans</h2>
<div class="plans-grid">
	{#each data.plans as p (p.key)}
		<div class="card plan-card" class:is-current={p.key === client.plan}>
			<div class="plan-top">
				<span class="plan-name">{p.name}</span>
				{#if rel(p) === 'current'}<span class="badge">current</span>{:else if p.is_default}<span class="badge neutral">default</span>{/if}
			</div>
			<div class="plan-price">
				{#if Number(p.price_amount) > 0}{p.price_currency} {Number(p.price_amount).toLocaleString()}<span class="per"> /mo</span>{:else}Free{/if}
			</div>
			<div class="plan-cap">≈ {planConversations(p).toLocaleString()} conversations / month</div>

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
				{#if rel(p) === 'current'}
					<button class="btn ghost plan-cta" type="button" disabled>Current plan</button>
				{:else if rel(p) === 'upgrade'}
					{#if data.paymentsEnabled}
						<form method="POST" action="?/checkout">
							<input type="hidden" name="plan" value={p.key} />
							<button class="btn plan-cta" type="submit">Upgrade to {p.name}</button>
						</form>
					{:else}
						<span class="btn ghost plan-cta disabled">Contact us to upgrade</span>
					{/if}
				{:else}
					<span class="btn ghost plan-cta disabled">Included · contact us to switch</span>
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
		box-shadow: inset 0 0 0 1px rgba(var(--gold-rgb), 0.5), var(--shadow);
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

	/* --- AI Usage dashboard --- */
	.soft {
		border-radius: 12px;
		padding: 0.75rem 0.9rem;
		font-size: 0.88rem;
		margin: 0 0 1rem;
		line-height: 1.45;
	}
	.soft.warn {
		color: var(--warn, #c79a2e);
		background: rgba(200, 150, 40, 0.08);
		border: 1px solid rgba(200, 150, 40, 0.3);
	}
	.soft.danger {
		color: var(--danger, #c84646);
		background: rgba(200, 70, 70, 0.08);
		border: 1px solid rgba(200, 70, 70, 0.3);
	}
	.soft a {
		font-weight: 600;
		color: inherit;
		text-decoration: underline;
	}
	.usage-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1rem;
		align-items: stretch;
	}
	.u-hero,
	.u-forecast {
		padding: 1.35rem;
	}
	.u-pct {
		font-size: 2.6rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1;
	}
	.u-pct span {
		font-size: 1.3rem;
		font-weight: 700;
	}
	.u-caption {
		color: var(--muted, #9aa5a1);
		font-size: 0.85rem;
		margin-top: 0.3rem;
	}
	.u-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
		font-size: 0.88rem;
		padding: 0.42rem 0;
		border-top: 1px solid var(--edge, rgba(255, 255, 255, 0.08));
	}
	.u-row:first-of-type {
		border-top: 0;
	}
	.u-row .muted {
		color: var(--muted, #9aa5a1);
	}
	.f-big {
		font-size: 1.3rem;
		font-weight: 700;
		margin: 0.5rem 0 0.3rem;
	}
	.f-sub {
		color: var(--muted, #9aa5a1);
		font-size: 0.86rem;
		line-height: 1.5;
	}
	.cat-card {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.cat-row {
		display: grid;
		grid-template-columns: minmax(96px, 150px) 1fr 44px;
		align-items: center;
		gap: 0.8rem;
		font-size: 0.86rem;
	}
	.cat-name {
		color: var(--body, #cdd6d2);
	}
	.cat-bar {
		height: 8px;
		border-radius: 999px;
		background: var(--panel-2, rgba(255, 255, 255, 0.05));
		overflow: hidden;
	}
	.cat-bar span {
		display: block;
		height: 100%;
		background: var(--mint, #4bbf9a);
		border-radius: 999px;
	}
	.cat-val {
		text-align: right;
		color: var(--muted, #9aa5a1);
		font-variant-numeric: tabular-nums;
	}
	.adv-toggle {
		background: none;
		border: 0;
		color: var(--muted, #9aa5a1);
		font: inherit;
		font-size: 0.86rem;
		cursor: pointer;
		padding: 0.7rem 0;
		margin-top: 0.4rem;
	}
	.adv-toggle:hover {
		color: var(--strong, #fff);
	}
	.tone-ok {
		color: #1f9d55;
	}
	.tone-warn {
		color: var(--warn, #c79a2e);
	}
	.tone-danger {
		color: var(--danger, #c84646);
	}
	.packs-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		align-items: stretch;
	}
	.pack-card {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.pack-name {
		font-weight: 700;
		color: var(--strong, #fff);
		font-size: 1.05rem;
	}
	.pack-price {
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--strong, #fff);
		letter-spacing: -0.02em;
	}
	.pack-conv {
		color: var(--muted, #9aa5a1);
		font-size: 0.85rem;
		margin-bottom: 0.6rem;
	}
	.pack-card form {
		margin-top: auto;
	}
	.pack-cta {
		width: 100%;
		justify-content: center;
	}
</style>
