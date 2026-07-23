<script>
	// Government leadership dashboard. Answers "what are citizens telling us, and what
	// should we do about it?" — aggregate only, no drill-through to a citizen. Every
	// figure comes from data.govDash, which enforces k-anonymity and PII stripping in
	// the service layer. Language: citizen / served / resolved / demand / coverage.
	import { onMount } from 'svelte';
	import GovOperations from './GovOperations.svelte';
	export let data;
	let view = 'leadership'; // Leadership | Operations — a tab toggle, NOT a role (same operator)

	$: client = data.client;
	$: g = data.govDash ?? { meta: { lowData: true, totalInPeriod: 0, periodDays: 30, generatedAt: null }, summary: {}, topics: [], stuck: [], region: { top: [], noActivity: [], noActivityCount: 0 }, signals: [] };
	$: sum = g.summary ?? {};
	$: lowData = g.meta?.lowData !== false;

	const nf = (n) => Number(n ?? 0).toLocaleString('en');
	const pctText = (v) => (v == null ? 'Insufficient data' : `${v}%`);
	const arrow = (dir) => (dir === 'up' ? '↑' : dir === 'down' ? '↓' : '·');

	let now = Date.now();
	onMount(() => {
		const i = setInterval(() => (now = Date.now()), 60000);
		return () => clearInterval(i);
	});
	function freshness(iso) {
		if (!iso) return '';
		const s = Math.round((now - new Date(iso).getTime()) / 1000);
		if (s < 90) return 'updated just now';
		const m = Math.round(s / 60);
		if (m < 60) return `updated ${m} min ago`;
		const h = Math.round(m / 60);
		return `updated ${h}h ago`;
	}

</script>

<!-- Header -->
<div class="gov-head">
	<h1>Citizen service overview</h1>
	<p class="sub">
		What citizens are telling {client.name || 'the ministry'} through the service.
		<span class="period">Last {g.meta?.periodDays ?? 30} days{g.meta?.generatedAt ? ` · ${freshness(g.meta.generatedAt)}` : ''}</span>
	</p>
</div>

<div class="view-toggle" role="tablist" aria-label="Dashboard view">
	<button type="button" role="tab" class:active={view === 'leadership'} aria-selected={view === 'leadership'} on:click={() => (view = 'leadership')}>Leadership</button>
	<button type="button" role="tab" class:active={view === 'operations'} aria-selected={view === 'operations'} on:click={() => (view = 'operations')}>Operations</button>
</div>

{#if view === 'operations'}
	<GovOperations {data} />
{:else if lowData}
	<!-- Honest low-data state for the whole analytical view. -->
	<div class="card">
		<div class="empty">
			<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18" /><path d="M7 14l3-3 3 2 4-5" /></svg>
			<h3>Not enough conversations yet to identify trends</h3>
			<p>Once the service has handled at least {g.meta?.kAnon ?? 10} citizen conversations in a period, demand, service gaps and regional reach will appear here. Aggregated only — never a single citizen.</p>
		</div>
	</div>
{:else}
	<!-- 1. Summary row -->
	<div class="gov-kpis">
		<div class="card kpi">
			<div class="k">Citizens served</div>
			<div class="v">{nf(sum.citizensServed?.value)}</div>
			<div class="foot">
				{#if sum.citizensServed?.deltaPct != null}
					<span class="delta">{arrow(sum.citizensServed.direction)} {Math.abs(sum.citizensServed.deltaPct)}% vs previous period</span>
				{:else}conversations in period{/if}
			</div>
		</div>
		<div class="card kpi">
			<div class="k">Resolved without office visit</div>
			<div class="v">{pctText(sum.resolvedShare)}</div>
			<div class="foot">no escalation, handoff or unanswered question</div>
		</div>
		<div class="card kpi">
			<div class="k">Regions reached</div>
			<div class="v">{nf(sum.regionsReached?.value)}<span class="unit"> of {sum.regionsReached?.of ?? 26}</span></div>
			<div class="foot">mainland regions with citizen enquiries</div>
		</div>
		<div class="card kpi">
			<div class="k">Asked in Kiswahili</div>
			<div class="v">{pctText(sum.swahiliShare)}</div>
			<div class="foot">of enquiries where language was detected</div>
		</div>
	</div>

	<!-- 3. Where citizens get stuck — highest-value panel, given prominence -->
	<div class="card stuck-card">
		<h2 class="section" style="margin:0 0 .2rem">Where citizens get stuck</h2>
		<p class="muted panel-sub">Enquiries the service could not resolve — unsolicited reports of where to improve.</p>
		{#if g.stuck.length}
			<div class="stuck-list">
				{#each g.stuck as s}
					<div class="stuck-row">
						<div class="stuck-main">
							<span class="stuck-label">{s.label}</span>
							{#if s.cause}<span class="stuck-cause">{s.cause}</span>{/if}
						</div>
						<div class="stuck-meta">
							<span class="stuck-count">{nf(s.count)} citizens</span>
							{#if s.region}<span class="stuck-region">concentrated in {s.region}</span>{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<p class="none">No unresolved clusters above the reporting threshold this period.</p>
		{/if}
	</div>

	<div class="two-col">
		<!-- 2. What citizens are asking about -->
		<div class="card">
			<h2 class="section" style="margin:0 0 .2rem">What citizens are asking about</h2>
			<p class="muted panel-sub">Ranked by volume, with change on the previous period.</p>
			{#if g.topics.length}
				<div class="insight-list">
					{#each g.topics as t}
						<div class="insight-row">
							<span class="insight-term" title={t.label}>{t.label}</span>
							<span class="insight-bar"><span style={`width:${Math.min(100, (t.count / g.topics[0].count) * 100)}%`}></span></span>
							<span class="topic-fig">
								<span class="mono">{nf(t.count)}</span>
								{#if t.deltaPct != null}<span class="delta sm">{arrow(t.direction)} {Math.abs(t.deltaPct)}%</span>{/if}
							</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="none">No topic reached the reporting threshold this period.</p>
			{/if}
		</div>

		<!-- 4. Demand by region -->
		<div class="card">
			<h2 class="section" style="margin:0 0 .2rem">Demand by region</h2>
			<p class="muted panel-sub">Where enquiries come from. Coverage gaps are a finding, not an omission.</p>
			{#if g.region.top.length}
				<div class="bars">
					{#each g.region.top as r}
						<div class="bar-row">
							<span class="bl" title={r.region}>{r.region}</span>
							<div class="btrack"><span class="bfill" style={`width:${Math.min(100, (r.count / g.region.top[0].count) * 100)}%`}></span></div>
							<span class="bv mono">{nf(r.count)}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="none">No region reached the reporting threshold this period.</p>
			{/if}
			{#if g.region.noActivityCount > 0}
				<div class="coverage-row">
					<span class="cov-dot" aria-hidden="true"></span>
					<span><b>{g.region.noActivityCount}</b> of {sum.regionsReached?.of ?? 26} regions had no citizen enquiries this period</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- 5. Signals to review -->
	{#if g.signals.length}
		<div class="card">
			<h2 class="section" style="margin:0 0 .2rem">Signals to review</h2>
			<p class="muted panel-sub">Changes surfaced automatically that may warrant a decision.</p>
			<div class="sig-list">
				{#each g.signals as s}
					<div class="sig-row">
						<span class="sig-dot {s.severity}" aria-hidden="true"></span>
						<span class="sig-text">{s.text}</span>
						<span class="sig-count mono">{nf(s.count)}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/if}

<style>
	.gov-head { margin: 0 0 1.1rem; }
	.gov-head h1 { font-size: 1.5rem; letter-spacing: -0.02em; color: var(--strong); margin: 0; }
	.gov-head .sub { font-size: 0.92rem; color: var(--muted); margin: 0.3rem 0 0; }
	.gov-head .period { color: var(--faint); }

	/* Leadership | Operations toggle (tabs, not a role) */
	.view-toggle { display: inline-flex; gap: 0.2rem; padding: 0.2rem; margin: 0 0 1.4rem; background: rgba(var(--well-rgb), 0.5); border: 1px solid var(--edge); border-radius: 10px; }
	.view-toggle button { font-size: 0.85rem; font-weight: 600; color: var(--muted); background: transparent; border: none; border-radius: 8px; padding: 0.4rem 0.9rem; cursor: pointer; }
	.view-toggle button:hover { color: var(--body); }
	.view-toggle button.active { color: var(--strong); background: rgba(var(--panel-rgb), 0.9); box-shadow: inset 0 0 0 1px var(--edge); }

	.gov-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.9rem; margin-bottom: 1.1rem; }
	.kpi .k { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; }
	.kpi .v { font-size: 2rem; font-weight: 800; color: var(--strong); margin-top: 0.2rem; line-height: 1.1; }
	.kpi .v .unit { font-size: 0.95rem; font-weight: 600; color: var(--faint); }
	.kpi .foot { font-size: 0.8rem; color: var(--faint); margin-top: 0.35rem; }
	.delta { color: var(--muted); }
	.delta.sm { font-size: 0.76rem; margin-left: 0.35rem; }

	.panel-sub { font-size: 0.85rem; margin: 0 0 0.9rem; }
	.none { font-size: 0.85rem; color: var(--faint); margin: 0.4rem 0 0; }

	/* Ranked-topic list (these classes are scoped to the sales +page.svelte, so the
	   government component must define its own copies). Wider term column — service
	   labels are longer than the tour keywords the original was sized for. */
	.insight-list { display: flex; flex-direction: column; gap: 0.6rem; }
	.insight-row { display: flex; align-items: center; gap: 0.7rem; }
	.insight-term { width: 190px; flex-shrink: 0; font-size: 0.86rem; font-weight: 600; color: var(--body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.insight-bar { flex: 1; height: 7px; border-radius: 99px; background: var(--panel-2); overflow: hidden; }
	.insight-bar > span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--mint), var(--accent)); }

	/* Stuck panel — the reason the dashboard exists */
	.stuck-card { border-color: rgba(var(--fg-rgb), 0.16); }
	.stuck-list { display: flex; flex-direction: column; }
	.stuck-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 0.7rem 0; border-top: 1px solid var(--line-2, rgba(var(--fg-rgb), 0.08)); }
	.stuck-row:first-child { border-top: none; }
	.stuck-main { min-width: 0; }
	.stuck-label { display: block; font-size: 0.95rem; font-weight: 600; color: var(--body); }
	.stuck-cause { display: block; font-size: 0.8rem; color: var(--muted); margin-top: 0.15rem; }
	.stuck-meta { text-align: right; flex: none; }
	.stuck-count { display: block; font-size: 0.92rem; font-weight: 700; color: var(--strong); }
	.stuck-region { display: block; font-size: 0.76rem; color: var(--faint); margin-top: 0.15rem; }

	/* Topic figure (count + neutral delta) */
	.topic-fig { display: inline-flex; align-items: baseline; justify-content: flex-end; min-width: 72px; }
	.topic-fig .mono { font-size: 0.82rem; color: var(--body); }

	/* Region bars (reuse admin bar pattern) */
	.bars { display: flex; flex-direction: column; gap: 0.55rem; }
	.bar-row { display: flex; align-items: center; gap: 0.7rem; }
	.bl { width: 96px; flex: none; font-size: 0.82rem; color: var(--body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.btrack { flex: 1; height: 8px; background: var(--panel-2); border-radius: 99px; overflow: hidden; }
	.bfill { display: block; height: 100%; background: var(--accent); border-radius: 99px; }
	.bv { min-width: 46px; flex: none; text-align: right; font-size: 0.82rem; color: var(--strong); font-weight: 600; }
	.coverage-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.9rem; padding-top: 0.8rem; border-top: 1px solid var(--line-2, rgba(var(--fg-rgb), 0.08)); font-size: 0.85rem; color: var(--muted); }
	.cov-dot { width: 8px; height: 8px; border-radius: 99px; background: var(--muted); flex: none; }
	.coverage-row b { color: var(--body); }

	/* Signals */
	.sig-list { display: flex; flex-direction: column; }
	.sig-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0; border-top: 1px solid var(--line-2, rgba(var(--fg-rgb), 0.08)); font-size: 0.88rem; color: var(--body); }
	.sig-row:first-child { border-top: none; }
	.sig-dot { width: 9px; height: 9px; border-radius: 99px; flex: none; }
	.sig-dot.warn { background: var(--warn); }
	.sig-dot.danger { background: var(--danger); }
	.sig-dot.neutral { background: var(--muted); }
	.sig-text { flex: 1; }
	.sig-count { color: var(--muted); font-size: 0.82rem; }

	.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.1rem; }
	.stuck-card { margin-top: 1.1rem; }
	@media (max-width: 820px) { .two-col { grid-template-columns: 1fr; } }
</style>
