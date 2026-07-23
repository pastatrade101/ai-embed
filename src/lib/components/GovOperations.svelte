<script>
	// Operations view — for the team running the service. Only the three things that
	// can be computed honestly today (composite health, an action queue, conversation
	// analytics); no faked infrastructure metrics. Data from data.govOps.
	import { page } from '$app/stores';
	import OnboardingChecklist from './OnboardingChecklist.svelte';
	export let data;

	$: client = data.client;
	$: ops = data.govOps ?? { meta: { lowData: true }, health: { state: 'ok', checks: [] }, actions: [], analytics: null };
	$: health = ops.health ?? { state: 'ok', checks: [] };
	$: actions = ops.actions ?? [];
	$: analytics = ops.analytics;
	$: maxDaily = analytics ? Math.max(1, ...analytics.daily.map((d) => d.count)) : 1;

	const nf = (n) => Number(n ?? 0).toLocaleString('en');
	const STATE_LABEL = { ok: 'Healthy', warn: 'Needs attention', critical: 'Action required' };
	const dayLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });

	$: embed = `<script src="${$page.url.origin}/widget.js" data-client="${client.slug}" defer><\/script>`;
	let copied = false;
	async function copyEmbed() {
		try { await navigator.clipboard.writeText(embed); copied = true; setTimeout(() => (copied = false), 1600); } catch (e) {}
	}
</script>

<!-- B1. Composite health strip -->
<div class="card health-card">
	<div class="health-head">
		<h2 class="section" style="margin:0">Service health</h2>
		<span class="hbadge {health.state}">{STATE_LABEL[health.state] ?? 'Healthy'}</span>
	</div>
	<div class="health-grid">
		{#each health.checks as c}
			<div class="hcheck">
				<span class="hdot {c.state}" aria-hidden="true"></span>
				<span class="hname">{c.name}</span>
				<span class="hdetail">{c.detail}</span>
			</div>
		{/each}
	</div>
</div>

<!-- B2. Action centre — the most useful panel; lead with it -->
<div class="card">
	<h2 class="section" style="margin:0 0 .2rem">What needs attention</h2>
	<p class="muted panel-sub">Findings from the service, turned into things to act on.</p>
	{#if actions.length}
		<div class="act-list">
			{#each actions as a}
				<a class="act-row" href={a.href}>
					<span class="pdot {a.priority}" aria-hidden="true"></span>
					<span class="act-body">
						<span class="act-title">{a.title}</span>
						{#if a.detail}<span class="act-detail">{a.count != null ? `${nf(a.count)} ${a.detail}` : a.detail}</span>{/if}
					</span>
					<span class="act-go" aria-hidden="true">→</span>
				</a>
			{/each}
		</div>
	{:else}
		<p class="none">Nothing needs attention right now.</p>
	{/if}
</div>

<!-- B6. Conversation analytics (aggregate, operator-owned volume) -->
<div class="card">
	<h2 class="section" style="margin:0 0 .2rem">Conversation activity</h2>
	<p class="muted panel-sub">Last {ops.meta?.periodDays ?? 30} days. Aggregate service volume.</p>
	{#if analytics}
		<div class="op-kpis">
			<div class="opk"><div class="opk-v">{nf(analytics.total)}</div><div class="opk-k">conversations</div></div>
			<div class="opk"><div class="opk-v">{analytics.resolutionRate == null ? '—' : analytics.resolutionRate + '%'}</div><div class="opk-k">resolved without escalation</div></div>
			<div class="opk"><div class="opk-v">{analytics.unresolvedRate == null ? '—' : analytics.unresolvedRate + '%'}</div><div class="opk-k">could not resolve</div></div>
			<div class="opk"><div class="opk-v">{analytics.avgMessages}</div><div class="opk-k">avg messages / conversation</div></div>
		</div>
		<div class="spark" role="img" aria-label={`Daily conversations over the last 14 days, ${analytics.daily.map((d) => `${dayLabel(d.date)}: ${d.count}`).join(', ')}`}>
			{#each analytics.daily as d}
				<span class="spark-col" title={`${dayLabel(d.date)}: ${d.count}`}>
					<span class="spark-bar" style={`height:${Math.max(3, Math.round((d.count / maxDaily) * 40))}px`}></span>
				</span>
			{/each}
		</div>
		<div class="spark-axis"><span>{dayLabel(analytics.daily[0].date)}</span><span>{dayLabel(analytics.daily[analytics.daily.length - 1].date)}</span></div>
	{:else}
		<div class="empty">
			<h3>Not enough conversations yet</h3>
			<p>Once the service has handled at least {ops.meta?.kAnon ?? 10} citizen conversations in the period, activity trends appear here.</p>
		</div>
	{/if}
</div>

<!-- Operator setup -->
<OnboardingChecklist {client} stats={data.stats} />

<div class="card embed-card">
	<h2 class="section" style="margin:0 0 .2rem">Add the assistant to an official website</h2>
	<p class="muted panel-sub">Paste this snippet before &lt;/body&gt; on a ministry or council page.</p>
	<div class="embed-row">
		<code class="embed-code">{embed}</code>
		<button class="btn-copy" type="button" on:click={copyEmbed}>{copied ? 'Copied' : 'Copy'}</button>
	</div>
</div>

<style>
	.panel-sub { font-size: 0.85rem; margin: 0 0 0.9rem; }
	.none { font-size: 0.85rem; color: var(--faint); margin: 0.4rem 0 0; }
	.card { margin-bottom: 1rem; }

	/* Health */
	.health-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.9rem; }
	.hbadge { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.55rem; border-radius: 99px; border: 1px solid var(--edge); }
	.hbadge.ok { color: var(--accent); border-color: rgba(var(--accent-rgb), 0.5); }
	.hbadge.warn { color: var(--warn); border-color: rgba(255, 181, 71, 0.5); }
	.hbadge.critical { color: var(--danger); border-color: rgba(255, 93, 108, 0.5); }
	.health-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.8rem; }
	.hcheck { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 0.5rem; align-items: center; }
	.hdot { width: 9px; height: 9px; border-radius: 50%; grid-row: 1 / span 2; }
	.hdot.ok { background: var(--accent); }
	.hdot.warn { background: var(--warn); }
	.hdot.critical { background: var(--danger); }
	.hname { font-size: 0.86rem; font-weight: 600; color: var(--body); }
	.hdetail { grid-column: 2; font-size: 0.78rem; color: var(--muted); }

	/* Action centre */
	.act-list { display: flex; flex-direction: column; }
	.act-row { display: flex; align-items: center; gap: 0.7rem; padding: 0.7rem 0; border-top: 1px solid var(--line-2, rgba(var(--fg-rgb), 0.08)); text-decoration: none; color: inherit; }
	.act-row:first-child { border-top: none; }
	.act-row:hover .act-title { color: var(--strong); }
	.pdot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
	.pdot.critical { background: var(--danger); }
	.pdot.warn { background: var(--warn); }
	.pdot.info { background: var(--muted); }
	.act-body { flex: 1; min-width: 0; }
	.act-title { display: block; font-size: 0.9rem; font-weight: 600; color: var(--body); }
	.act-detail { display: block; font-size: 0.78rem; color: var(--muted); margin-top: 0.1rem; }
	.act-go { color: var(--faint); flex: none; }

	/* Analytics */
	.op-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.9rem; margin-bottom: 1.1rem; }
	.opk-v { font-size: 1.5rem; font-weight: 800; color: var(--strong); }
	.opk-k { font-size: 0.75rem; color: var(--muted); margin-top: 0.15rem; }
	.spark { display: flex; align-items: flex-end; gap: 4px; height: 44px; }
	.spark-col { flex: 1; display: flex; align-items: flex-end; justify-content: center; }
	.spark-bar { display: block; width: 100%; max-width: 18px; border-radius: 3px 3px 0 0; background: var(--accent); }
	.spark-axis { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--faint); margin-top: 0.4rem; }

	.embed-row { display: flex; gap: 0.6rem; align-items: stretch; }
	.embed-code { flex: 1; font-family: 'Geist Mono', monospace; font-size: 0.78rem; color: var(--soft); background: rgba(var(--well-rgb), 0.6); border: 1px solid var(--edge); border-radius: 10px; padding: 0.6rem 0.7rem; overflow-x: auto; white-space: nowrap; }
	.btn-copy { flex: none; font-size: 0.82rem; font-weight: 600; color: var(--strong); background: rgba(var(--fg-rgb), 0.06); border: 1px solid var(--edge); border-radius: 10px; padding: 0 0.9rem; cursor: pointer; }
	.btn-copy:hover { background: rgba(var(--fg-rgb), 0.1); }

	@media (prefers-reduced-motion: reduce) { .spark-bar { transition: none; } }
</style>
