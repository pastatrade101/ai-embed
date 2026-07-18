<script>
	export let data;
	$: industries = data.industries ?? [];
	$: rev = data.revenue;
	$: totalMrr = industries.reduce((s, i) => s + i.mrr, 0);

	const money = (n, cur = rev?.currency ?? 'USD') =>
		n == null ? '—' : new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
	const num = (n) => new Intl.NumberFormat('en').format(Math.round(n ?? 0));
	// AI cost is USD; show it as USD (it's a cost metric, not revenue).
	const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;
	const share = (mrr) => (totalMrr > 0 ? Math.round((mrr / totalMrr) * 100) : 0);
	const healthCls = (h) => (h >= 70 ? 'ok' : h >= 45 ? 'warn' : 'danger');
	// Only crown a fastest-growing vertical when something actually grew.
	$: fastest = [...industries].sort((a, b) => b.newThisMonth - a.newThisMonth)[0];
	$: hasGrowth = fastest && fastest.newThisMonth > 0;
</script>

<div class="page-head">
	<div>
		<h1>Industry intelligence</h1>
		<div class="sub">How each vertical is performing across the platform — revenue, engagement, AI usage and health, all from live data.</div>
	</div>
</div>

{#if data.loadError}
	<div class="notice err">Could not load platform data: {data.loadError}</div>
{:else if industries.length === 0}
	<div class="card empty-soft">No clients yet — industries appear here once tenants sign up.</div>
{:else}
	<!-- Roll-up strip -->
	<div class="stat-grid">
		<div class="tile"><div class="k">Industries served</div><div class="v">{industries.length}</div><div class="foot">active verticals</div></div>
		<div class="tile"><div class="k">Total MRR</div><div class="v">{money(totalMrr)}</div><div class="foot">across all industries</div></div>
		<div class="tile"><div class="k">Top vertical</div><div class="v" style="font-size:1.5rem">{industries[0].icon} {industries[0].label.split(' ')[0]}</div><div class="foot">{money(industries[0].mrr)} MRR</div></div>
		<div class="tile"><div class="k">Fastest growing</div>{#if hasGrowth}<div class="v" style="font-size:1.5rem">{fastest.icon} {fastest.label.split(' ')[0]}</div><div class="foot">+{fastest.newThisMonth} this month</div>{:else}<div class="v">—</div><div class="foot">no new clients this month</div>{/if}</div>
	</div>

	<div class="ind-grid">
		{#each industries as i}
			<div class="ind card">
				<div class="ind-top">
					<span class="ind-ico">{i.icon}</span>
					<div class="ind-id">
						<div class="ind-name">{i.label}</div>
						<div class="ind-meta">{i.count} {i.count === 1 ? 'client' : 'clients'} · {i.active} active{i.newThisMonth > 0 ? ` · +${i.newThisMonth} new` : ''}</div>
					</div>
					<div class="ind-mrr">
						<div class="im-v">{money(i.mrr)}</div>
						<div class="im-l">MRR · {share(i.mrr)}%</div>
					</div>
				</div>

				<div class="ind-share"><span class="is-fill" style={`width:${share(i.mrr)}%`}></span></div>

				<div class="ind-metrics">
					<div><b>{money(i.arr)}</b><span>ARR</span></div>
					<div><b>{num(i.avgConvMonth)}</b><span>avg conv / mo</span></div>
					<div><b class="hb {healthCls(i.avgHealth)}">{i.avgHealth}</b><span>avg health</span></div>
					<div><b>{usd(i.avgAiCost)}</b><span>avg AI cost</span></div>
					<div><b>{num(i.totalConvMonth)}</b><span>conv / mo</span></div>
					<div><b>{i.upgradeCandidates}</b><span>upgrade-ready</span></div>
				</div>

				{#if i.top}
					<div class="ind-top-client">
						<span class="tc-label">Top performer</span>
						<a href={`/admin/clients/${i.top.slug}`} class="tc-name">{i.top.name}</a>
						<span class="tc-meta">health {i.top.health} · {num(i.top.convMonth)} conv/mo</span>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<p class="hint" style="margin-top:1rem">Revenue = sum of paying clients' plan prices. AI cost is metered per tenant (USD). Health is the platform's engagement + billing heuristic (0–100).</p>
{/if}

<style>
	.ind-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 1rem;
		margin-top: 1.2rem;
	}
	.ind {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		transition: border-color 0.16s, transform 0.16s;
	}
	.ind:hover {
		border-color: rgba(var(--gold-rgb), 0.35);
		transform: translateY(-2px);
	}
	.ind-top {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.ind-ico {
		font-size: 1.6rem;
		line-height: 1;
		flex: none;
	}
	.ind-id {
		flex: 1;
		min-width: 0;
	}
	.ind-name {
		font-weight: 700;
		color: var(--strong);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ind-meta {
		font-size: 0.76rem;
		color: var(--muted);
	}
	.ind-mrr {
		text-align: right;
		flex: none;
	}
	.im-v {
		font-weight: 800;
		color: var(--strong);
		font-size: 1.05rem;
		letter-spacing: -0.01em;
	}
	.im-l {
		font-size: 0.68rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.ind-share {
		height: 6px;
		border-radius: 99px;
		background: var(--panel-2);
		overflow: hidden;
	}
	.is-fill {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: var(--accent);
	}
	.ind-metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem 0.4rem;
		padding: 0.6rem 0;
		border-top: 1px solid var(--edge);
		border-bottom: 1px solid var(--edge);
	}
	.ind-metrics div {
		text-align: center;
		min-width: 0;
	}
	.ind-metrics b {
		display: block;
		color: var(--strong);
		font-size: 0.95rem;
	}
	.ind-metrics span {
		font-size: 0.64rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.hb.ok {
		color: var(--mint);
	}
	.hb.warn {
		color: var(--warn);
	}
	.hb.danger {
		color: var(--danger);
	}
	.ind-top-client {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
		font-size: 0.8rem;
	}
	.tc-label {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
		font-weight: 700;
	}
	.tc-name {
		font-weight: 600;
		color: var(--mint);
	}
	.tc-meta {
		color: var(--muted);
		font-size: 0.76rem;
	}
</style>
