<script>
	import Donut from '$lib/components/admin/Donut.svelte';

	export let data;
	$: t = data.totals;
	$: rev = data.revenue;
	$: spend = data.spend;
	$: billing = data.billing;

	// Earthy categorical palette that sits in the forest/gold theme.
	const PALETTE = ['#e0b24c', '#4b9e83', '#d9784c', '#b79ce0', '#ecca7d', '#6ea8a0', '#cf8f8f'];

	const money = (n, cur = rev?.currency ?? 'USD') =>
		n == null ? '—' : new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
	// AI provider costs are billed in USD; convert to the platform currency so cost
	// & margin read in the same currency as revenue. Approximate rate.
	const USD_TZS = 2600;
	const inRevCur = (usd) => (rev?.currency === 'USD' ? usd : usd * USD_TZS);

	$: planColor = (() => {
		const m = new Map();
		(rev?.byPlan ?? []).forEach((p, i) => m.set(p.key, PALETTE[i % PALETTE.length]));
		return m;
	})();
	$: maxPlanMrr = Math.max(1, ...(rev?.byPlan ?? []).map((p) => p.mrr));
	$: maxModelCost = Math.max(1e-9, ...(spend?.byModel ?? []).map((m) => m.cost));
</script>

<div class="page-head"><div><h1>Revenue</h1><div class="sub">MRR, plan mix, AI cost &amp; margin, and billing — live from current plans and metered usage.</div></div></div>

{#if data.loadError}
	<div class="notice err">Could not load platform data: {data.loadError}</div>
{:else if rev}
	<!-- REVENUE & PLAN MIX -->
	<h2 class="section">Revenue &amp; plan mix</h2>
	<div class="split">
		<div class="card mix">
			<Donut
				segments={(rev.byPlan ?? []).map((p) => ({ label: p.name, value: p.count, color: planColor.get(p.key) }))}
				centerValue={String(t.active)}
				centerLabel="active"
			/>
			<div class="mix-legend">
				{#each rev.byPlan as p}
					<div class="lg-row">
						<span class="dot" style="background:{planColor.get(p.key)}"></span>
						<span class="lg-name">{p.name}</span>
						<span class="lg-meta">{p.count} · {money(p.price)}/mo</span>
					</div>
				{/each}
			</div>
		</div>
		<div class="card bars">
			<div class="bars-head">MRR by plan</div>
			{#each rev.byPlan as p}
				<div class="bar-row">
					<span class="bl">{p.name}</span>
					<div class="btrack"><span class="bfill" style="width:{Math.round((p.mrr / maxPlanMrr) * 100)}%;background:{planColor.get(p.key)}"></span></div>
					<span class="bv">{money(p.mrr)}</span>
				</div>
			{/each}
			<div class="bars-foot">
				<div><b>{money(rev.mrr)}</b> MRR</div>
				<div><b>{money(rev.arr)}</b> ARR</div>
				<div><b>{money(rev.arpu)}</b> ARPU</div>
			</div>
			<p class="fineprint">Computed live from current plans — no MRR-over-time line (metrics aren’t snapshotted).</p>
		</div>
	</div>

	<!-- AI COST & MARGIN -->
	<h2 class="section">AI cost &amp; margin</h2>
	{#if spend.tracked}
		<div class="split">
			<div class="card">
				<div class="bars-head">Spend by model · this month</div>
				{#each spend.byModel as m}
					<div class="bar-row">
						<span class="bl mono">{m.model}</span>
						<div class="btrack"><span class="bfill" style="width:{Math.round((m.cost / maxModelCost) * 100)}%;background:var(--accent)"></span></div>
						<span class="bv">{money(inRevCur(m.cost))}</span>
					</div>
				{/each}
			</div>
			<div class="cost-tiles">
				<div class="mini-tile"><div class="mt-v">{money(inRevCur(spend.cost))}</div><div class="mt-l">AI cost so far / mo</div></div>
				<div class="mini-tile"><div class="mt-v">{money(inRevCur(spend.projected))}</div><div class="mt-l">Projected / mo</div></div>
				<div class="mini-tile"><div class="mt-v">{money(inRevCur(spend.claudeCost))}</div><div class="mt-l">Claude cost</div></div>
				<div class="mini-tile"><div class="mt-v">{money(inRevCur(spend.voyageCost))}</div><div class="mt-l">Voyage (embeddings)</div></div>
				<div class="mini-tile"><div class="mt-v">{money(inRevCur(t.conversationsMonth ? spend.cost / t.conversationsMonth : 0))}</div><div class="mt-l">Cost / conversation</div></div>
				<div class="mini-tile"><div class="mt-v">{money(inRevCur(t.qualified ? spend.cost / t.qualified : 0))}</div><div class="mt-l">Cost / qualified lead</div></div>
				<div class="mini-tile"><div class="mt-v">{money(inRevCur(t.clients ? spend.cost / t.clients : 0))}</div><div class="mt-l">Cost / tenant</div></div>
				<div class="mini-tile"><div class="mt-v">{rev.mrr > 0 ? Math.round(((rev.mrr - inRevCur(spend.projected)) / rev.mrr) * 100) + '%' : '—'}</div><div class="mt-l">Projected gross margin</div></div>
			</div>
		</div>
		{#if spend.topSpenders?.length}
			<div class="card" style="margin-top:1rem">
				<div class="bars-head">Top AI spenders · this month</div>
				{#each spend.topSpenders as s}
					<div class="bar-row">
						<span class="bl">{s.name}</span>
						<div class="btrack"><span class="bfill" style="width:{Math.round((s.cost / Math.max(1e-9, spend.topSpenders[0].cost)) * 100)}%;background:var(--accent)"></span></div>
						<span class="bv">{money(inRevCur(s.cost))}</span>
					</div>
				{/each}
			</div>
		{/if}
		<p class="fineprint">From metered AI turns (usage_records), Claude + Voyage embeddings. Projected = straight-line to month end. Gross margin = MRR − projected AI cost; excludes storage &amp; opex.{#if rev?.currency && rev.currency !== 'USD'} AI cost billed in USD, shown at ≈{USD_TZS.toLocaleString()} {rev.currency}/USD.{/if}</p>
	{:else}
		<div class="card empty-soft">AI cost isn’t metered yet — once usage logging records turns, spend, tokens and margin appear here.</div>
	{/if}

	<!-- BILLING OVERVIEW -->
	<h2 class="section">Billing overview</h2>
	<div class="stat-grid">
		<div class="tile"><div class="k">MRR / ARR</div><div class="v">{money(billing.mrr)}</div><div class="foot">{money(billing.arr)} annual run-rate</div></div>
		<div class="tile"><div class="k">Failed payments</div><div class="v">{billing.failedPayments}</div><div class="foot">from Snippe attempts</div></div>
		<div class="tile"><div class="k">Renewals · 7d</div><div class="v">{billing.upcomingRenewals}</div><div class="foot">{billing.trialing} on trial</div></div>
		<div class="tile"><div class="k">At risk</div><div class="v">{billing.pastDue + billing.canceled}</div><div class="foot">{billing.pastDue} past due · {billing.canceled} canceled</div></div>
	</div>
{/if}

<style>
	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.85rem;
	}
	@media (max-width: 860px) {
		.split {
			grid-template-columns: 1fr;
		}
	}
	.fineprint {
		font-size: 0.72rem;
		color: var(--faint);
		margin: 0.7rem 0 0;
	}

	/* Revenue mix */
	.mix {
		display: flex;
		gap: 1.2rem;
		align-items: center;
		/* On narrow screens the donut centres and the legend drops below it
		   full-width, so the right-aligned prices never overflow the card. */
		flex-wrap: wrap;
		justify-content: center;
	}
	.mix-legend {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 200px;
		flex: 1;
	}
	.lg-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.85rem;
	}
	.lg-row .dot {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		flex: none;
	}
	.lg-name {
		color: var(--body);
		font-weight: 600;
	}
	.lg-meta {
		color: var(--muted);
		margin-left: auto;
		font-size: 0.78rem;
	}

	/* Horizontal bars */
	.bars-head {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
		margin-bottom: 0.8rem;
	}
	.bar-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin-bottom: 0.6rem;
	}
	.bl {
		width: 92px;
		flex: none;
		font-size: 0.82rem;
		color: var(--body);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bl.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.74rem;
	}
	.btrack {
		flex: 1;
		height: 8px;
		background: var(--panel-2);
		border-radius: 99px;
		overflow: hidden;
	}
	.bfill {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: 99px;
		transition: width 0.5s ease;
	}
	.bv {
		/* Size to the value (TZS figures run well past a fixed 62px) so it never
		   overflows the card; the flexible bar track shrinks to make room. */
		min-width: 62px;
		flex: none;
		white-space: nowrap;
		text-align: right;
		font-size: 0.82rem;
		color: var(--strong);
		font-weight: 600;
	}
	.bars-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem 1.4rem;
		margin-top: 0.9rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--edge);
	}
	.bars-foot div {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.bars-foot b {
		overflow-wrap: anywhere;
	}
	.bars-foot b {
		color: var(--strong);
		font-size: 1rem;
		display: block;
	}

	/* Cost tiles */
	.cost-tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}
	.mini-tile {
		background: rgba(var(--panel-rgb), 0.72);
		border: 1px solid var(--edge);
		border-radius: 12px;
		padding: 0.75rem 0.9rem;
	}
	.mt-v {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--strong);
	}
	.mt-l {
		font-size: 0.72rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.empty-soft {
		color: var(--muted);
		text-align: center;
		padding: 1.4rem;
		font-size: 0.88rem;
	}
	.mt-v {
		overflow-wrap: anywhere;
	}
	@media (max-width: 560px) {
		.mt-v {
			font-size: 1.1rem;
		}
		.bars-foot {
			gap: 0.6rem 1rem;
		}
	}
</style>
