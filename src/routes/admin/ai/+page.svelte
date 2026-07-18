<script>
	import { usdToLocal, USD_TO } from '$lib/fx.js';
	export let data;
	$: spend = data.spend;
	$: t = data.totals;
	$: rev = data.revenue;
	$: health = data.health;
	// AI-related health checks only.
	$: aiChecks = (health?.checks ?? []).filter((c) => ['AI models', 'Embeddings'].includes(c.name));

	const money = (n, cur = rev?.currency ?? 'USD') =>
		n == null ? '—' : new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
	const money4 = (n, cur = rev?.currency ?? 'USD') =>
		n == null ? '—' : new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
	const num = (n) => new Intl.NumberFormat('en').format(Math.round(n ?? 0));
	// AI spend is billed in USD; convert to the platform currency (matches Revenue).
	$: fxRate = USD_TO[rev?.currency ?? 'USD'] ?? 1;
	const inRev = (usd) => usdToLocal(usd, rev?.currency ?? 'USD');
	function tokens(n) {
		if (!n) return '0';
		if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
		if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
		if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
		return String(n);
	}
	const FEATURE_LABEL = {
		widget: 'Website widget chat', hosted: 'Hosted page chat', whatsapp: 'WhatsApp', embedding: 'Query embeddings',
		knowledge_index: 'Knowledge indexing', website_sync: 'Website sync', summary: 'Conversation summaries',
		translate: 'Translation', data_analyst: 'AI data analyst', research: 'AI research', lead_extract: 'Lead extraction', other: 'Other / untagged'
	};
	const featLabel = (f) => FEATURE_LABEL[f] ?? f;
	$: maxModelCost = Math.max(1e-9, ...(spend?.byModel ?? []).map((m) => m.cost));
	$: maxFeatCost = Math.max(1e-9, ...(spend?.byFeature ?? []).map((f) => f.cost));
	$: costPerConv = spend?.tracked && t.conversationsMonth ? spend.cost / t.conversationsMonth : null;
	$: cacheSavedUsd = spend?.tracked ? (spend.cachedTokens / 1e6) * 0.9 : 0;
</script>

<div class="page-head">
	<div>
		<h1>AI operations</h1>
		<div class="sub">Claude &amp; Voyage usage, prompt-cache economics, model health and where AI spend goes — this month, across the whole platform.</div>
	</div>
</div>

{#if data.loadError}
	<div class="notice err">Could not load platform data: {data.loadError}</div>
{:else if !spend?.tracked}
	<div class="card empty-soft">AI usage isn't metered yet — once conversations run, spend, tokens, cache and model health appear here.</div>
{:else}
	<!-- Model health -->
	<div class="card health-strip">
		{#each aiChecks as c}
			<div class="hs"><span class="hdot {c.status}"></span><div><div class="hs-n">{c.name}</div><div class="hs-note">{c.note}</div></div></div>
		{/each}
		<div class="hs"><span class="hdot operational"></span><div><div class="hs-n">Prompt cache</div><div class="hs-note">{spend.cacheHitRate}% hit rate</div></div></div>
	</div>

	<!-- Cost KPIs -->
	<h2 class="section">AI cost · this month</h2>
	<div class="stat-grid">
		<div class="tile"><div class="k">AI cost so far</div><div class="v">{money(inRev(spend.cost))}</div><div class="foot">projected {money(inRev(spend.projected))}</div></div>
		<div class="tile"><div class="k">Claude</div><div class="v">{money(inRev(spend.claudeCost))}</div><div class="foot">{Math.round((spend.claudeCost / Math.max(1e-9, spend.cost)) * 100)}% of spend</div></div>
		<div class="tile"><div class="k">Voyage (embeddings)</div><div class="v">{money(inRev(spend.voyageCost))}</div><div class="foot">{Math.round((spend.voyageCost / Math.max(1e-9, spend.cost)) * 100)}% of spend</div></div>
		<div class="tile"><div class="k">Cost / conversation</div><div class="v">{costPerConv == null ? '—' : money4(inRev(costPerConv))}</div><div class="foot">{num(t.conversationsMonth)} conv this mo</div></div>
	</div>

	<!-- Token + cache economics -->
	<h2 class="section">Token economics</h2>
	<div class="stat-grid">
		<div class="tile"><div class="k">AI responses</div><div class="v">{num(spend.turns)}</div><div class="foot">metered calls</div></div>
		<div class="tile"><div class="k">Input · output</div><div class="v" style="font-size:1.4rem">{tokens(spend.inputTokens)} · {tokens(spend.outputTokens)}</div><div class="foot">avg {num(spend.avgInputTokens)} in / {num(spend.avgOutputTokens)} out</div></div>
		<div class="tile"><div class="k">Cache hit rate</div><div class="v tone-ok">{spend.cacheHitRate}%</div><div class="foot">{tokens(spend.cachedTokens)} cached tokens</div></div>
		<div class="tile"><div class="k">Cache savings</div><div class="v tone-ok">≈ {money(inRev(cacheSavedUsd))}</div><div class="foot">est. this month</div></div>
	</div>

	<div class="split">
		<!-- Spend by model -->
		<div class="card">
			<div class="bars-head">Spend by model</div>
			{#each spend.byModel as m}
				<div class="bar-row">
					<span class="bl mono">{m.model}</span>
					<div class="btrack"><span class="bfill" style={`width:${Math.round((m.cost / maxModelCost) * 100)}%`}></span></div>
					<span class="bv">{money4(inRev(m.cost))}</span>
				</div>
			{/each}
		</div>

		<!-- Spend by feature -->
		<div class="card">
			<div class="bars-head">Spend by capability</div>
			{#each spend.byFeature as f}
				<div class="bar-row">
					<span class="bl">{featLabel(f.feature)}</span>
					<div class="btrack"><span class="bfill" style={`width:${Math.round((f.cost / maxFeatCost) * 100)}%;background:var(--mint)`}></span></div>
					<span class="bv">{money4(inRev(f.cost))}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Top spenders -->
	{#if spend.topSpenders?.length}
		<h2 class="section">Top AI spenders</h2>
		<div class="card">
			{#each spend.topSpenders as s}
				<div class="bar-row">
					<span class="bl2">{s.name}</span>
					<div class="btrack"><span class="bfill" style={`width:${Math.round((s.cost / Math.max(1e-9, spend.topSpenders[0].cost)) * 100)}%`}></span></div>
					<span class="bv">{money4(inRev(s.cost))}</span>
				</div>
			{/each}
		</div>
	{/if}

	<p class="hint" style="margin-top:1rem">Metered from usage_records (Claude + Voyage). Costs billed in USD{rev.currency !== 'USD' ? `, shown at ≈${fxRate.toLocaleString()} ${rev.currency}/USD` : ''}. Projected = straight-line to month end. Response latency isn't recorded, so it isn't shown.</p>
{/if}

<style>
	.health-strip {
		display: flex;
		gap: 1.6rem;
		flex-wrap: wrap;
	}
	.hs {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}
	.hdot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex: none;
	}
	.hdot.operational {
		background: var(--mint);
	}
	.hdot.unconfigured {
		background: var(--faint);
	}
	.hs-n {
		font-size: 0.86rem;
		font-weight: 600;
		color: var(--strong);
	}
	.hs-note {
		font-size: 0.74rem;
		color: var(--muted);
	}
	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.85rem;
		margin-top: 0.85rem;
	}
	@media (max-width: 860px) {
		.split {
			grid-template-columns: 1fr;
		}
	}
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
		width: 140px;
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
	.bl2 {
		width: 160px;
		flex: none;
		font-size: 0.85rem;
		color: var(--body);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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
		width: 80px;
		flex: none;
		text-align: right;
		font-size: 0.8rem;
		color: var(--strong);
		font-weight: 600;
		white-space: nowrap;
	}
	.tone-ok {
		color: #1f9d55;
	}
</style>
