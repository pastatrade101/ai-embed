<script>
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { usdToLocal } from '$lib/fx.js';

	export let data;
	export let form;
	$: t = data.totals;
	$: rev = data.revenue;
	$: spend = data.spend;
	$: health = data.health;
	$: billing = data.billing;
	$: attention = data.attention ?? [];
	$: activity = data.activity ?? [];
	$: industries = data.industries ?? [];
	$: execSummary = data.execSummary ?? [];
	$: insights = data.platformInsights ?? [];
	$: clients = data.clients ?? [];
	$: name = (data.superName ?? 'there').split(/\s+/)[0];

	const money = (n, cur = rev?.currency ?? 'USD') =>
		n == null ? '—' : new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
	const num = (n) => new Intl.NumberFormat('en').format(n ?? 0);
	// AI spend is billed in USD; convert to the platform currency for margin.
	const inRev = (usd) => usdToLocal(usd, rev?.currency ?? 'USD');
	function ago(s) {
		if (!s) return '—';
		const d = (Date.now() - new Date(s).getTime()) / 1000;
		if (d < 60) return 'just now';
		if (d < 3600) return `${Math.floor(d / 60)}m ago`;
		if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
		if (d < 2592000) return `${Math.floor(d / 86400)}d ago`;
		return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(s));
	}

	$: grossMargin = spend?.tracked && rev.mrr > 0 ? Math.round(((rev.mrr - inRev(spend.projected)) / rev.mrr) * 100) : null;
	// Rounded to match the platform-intelligence + industries "≥80% of cap"
	// convention (avoids two tiles on the same screen disagreeing by one).
	$: nearCap = clients.filter((c) => {
		const cap = Number(c.monthly_conversation_cap) || 0;
		return cap > 0 && Math.round(((c.conversationsMonth ?? 0) / cap) * 100) >= 80;
	}).length;
	$: atRisk = (billing?.pastDue ?? 0) + (billing?.canceled ?? 0);

	let greeting = 'Welcome';
	onMount(() => {
		const h = new Date().getHours();
		greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
	});

	// Copilot
	let question = '';
	let asking = false;
	const SAMPLES = ['Which clients are likely to churn?', 'Who should upgrade?', 'Which industry is growing fastest?', "Forecast next month's MRR"];
	const askSubmit = () => {
		asking = true;
		return async ({ update }) => {
			await update({ reset: false });
			asking = false;
		};
	};
</script>

{#if data.loadError}
	<div class="page-head"><div><h1>Command center</h1></div></div>
	<div class="notice err">Could not load platform data: {data.loadError}</div>
{:else if t}
	<!-- HERO — executive AI summary -->
	<section class="hero">
		<div class="hero-main">
			<div class="hero-hi">{greeting}, {name} <span class="wave">👋</span></div>
			<div class="hero-status" class:ok={health.ok}>
				<span class="pulse"></span>
				{health.ok ? 'Platform healthy — all systems operational' : 'Platform online — some integrations need setup'}
			</div>
			<ul class="summary">
				{#each execSummary as s}
					<li class="sum-{s.tone}"><span class="sum-dot"></span>{s.text}</li>
				{/each}
			</ul>
		</div>
		<div class="hero-chips">
			<div class="chip">
				<div class="chip-top"><span class="cv">{t.convToday}</span>{#if t.convToday - t.convYest !== 0}<span class="delta {t.convToday >= t.convYest ? 'up' : 'down'}">{t.convToday >= t.convYest ? '▲' : '▼'} {Math.abs(t.convToday - t.convYest)}</span>{/if}</div>
				<span class="cl">Conversations today</span>
			</div>
			<div class="chip">
				<div class="chip-top"><span class="cv">{t.leadsToday}</span>{#if t.leadsToday - t.leadsYest !== 0}<span class="delta {t.leadsToday >= t.leadsYest ? 'up' : 'down'}">{t.leadsToday >= t.leadsYest ? '▲' : '▼'} {Math.abs(t.leadsToday - t.leadsYest)}</span>{/if}</div>
				<span class="cl">Leads today</span>
			</div>
			<div class="chip">
				<div class="chip-top"><span class="cv">{t.newThisMonth}</span></div>
				<span class="cl">New clients / mo</span>
			</div>
			<a class="chip" class:warn={attention.length} href="/admin/clients">
				<div class="chip-top"><span class="cv">{attention.length}</span></div>
				<span class="cl">Need attention</span>
			</a>
		</div>
	</section>

	<!-- PLATFORM COPILOT -->
	<div class="card copilot">
		<div class="cop-head"><span class="cop-spark">✦</span> Ask Makutano AI <span class="cop-sub">— your platform, in plain English</span></div>
		<form method="POST" action="?/copilot" use:enhance={askSubmit} class="cop-form">
			<input name="question" bind:value={question} placeholder="e.g. Which clients should upgrade? Forecast next month's MRR." autocomplete="off" />
			<button class="btn" type="submit" disabled={asking || !question.trim()}>{asking ? 'Thinking…' : 'Ask'}</button>
		</form>
		<div class="cop-chips">
			{#each SAMPLES as s}<button type="button" class="cop-chip" on:click={() => (question = s)} data-no-busy>{s}</button>{/each}
		</div>
		{#if form?.error}<div class="notice err" style="margin-top:.6rem">{form.error}</div>{/if}
		{#if form?.answer}
			<div class="cop-answer">
				<div class="cop-q">{form.question}</div>
				<div class="cop-a">{form.answer}</div>
			</div>
		{/if}
	</div>

	<!-- EXECUTIVE KPIs — grouped -->
	<div class="kpi-cluster">
		<div class="cl-head"><span class="cl-label">Revenue</span><a href="/admin/revenue">Details →</a></div>
		<div class="stat-grid four">
			<div class="tile"><div class="k">MRR</div><div class="v">{money(rev.mrr)}</div><div class="foot">{money(rev.arr)} ARR</div></div>
			<div class="tile"><div class="k">ARPU</div><div class="v">{money(rev.arpu)}</div><div class="foot">{rev.payingCount} paying</div></div>
			<div class="tile"><div class="k">New revenue · mo</div><div class="v">{money(rev.newMrrMonth)}</div><div class="foot">from {t.newThisMonth} signups</div></div>
			<div class="tile"><div class="k">Gross margin</div><div class="v tone-{grossMargin == null ? '' : grossMargin >= 60 ? 'ok' : grossMargin >= 30 ? 'warn' : 'danger'}">{grossMargin == null ? '—' : grossMargin + '%'}</div><div class="foot">MRR − projected AI</div></div>
		</div>
	</div>

	<div class="kpi-cluster">
		<div class="cl-head"><span class="cl-label">Growth</span><a href="/admin/clients">Details →</a></div>
		<div class="stat-grid four">
			<div class="tile"><div class="k">Active clients</div><div class="v">{t.active}</div><div class="foot">{rev.payingCount} paying · {t.clients} total</div></div>
			<div class="tile"><div class="k">New this month</div><div class="v">{t.newThisMonth}</div><div class="foot">tenants onboarded</div></div>
			<div class="tile"><div class="k">Industries</div><div class="v">{industries.length}</div><div class="foot">verticals served</div></div>
			<div class="tile"><div class="k">Qualified leads</div><div class="v">{t.qualified}</div><div class="foot">of {num(t.leads)} captured</div></div>
		</div>
	</div>

	<div class="kpi-cluster">
		<div class="cl-head"><span class="cl-label">AI &amp; platform</span><a href="/admin/ai">Details →</a></div>
		<div class="stat-grid four">
			<div class="tile"><div class="k">Conversations · mo</div><div class="v">{num(t.conversationsMonth)}</div><div class="foot">{num(t.conversations)} all-time</div></div>
			<div class="tile"><div class="k">AI cost · mo</div><div class="v">{spend?.tracked ? money(inRev(spend.cost)) : '—'}</div><div class="foot">{spend?.tracked ? `proj ${money(inRev(spend.projected))}` : 'not metered'}</div></div>
			<div class="tile"><div class="k">Cache hit rate</div><div class="v tone-ok">{spend?.tracked ? spend.cacheHitRate + '%' : '—'}</div><div class="foot">prompt caching</div></div>
			<div class="tile"><div class="k">Avg client health</div><div class="v">{t.avgHealth}</div><div class="foot">{num(t.items)} knowledge items</div></div>
		</div>
	</div>

	<div class="kpi-cluster">
		<div class="cl-head"><span class="cl-label">Needs attention</span><a href="/admin/settings">Health →</a></div>
		<div class="stat-grid four">
			<a class="tile" href="/admin/revenue"><div class="k">Failed payments</div><div class="v" class:tone-danger={billing.failedPayments > 0}>{billing.failedPayments}</div><div class="foot">from Snippe</div></a>
			<a class="tile" href="/admin/clients"><div class="k">Near AI limit</div><div class="v" class:tone-warn={nearCap > 0}>{nearCap}</div><div class="foot">≥80% of cap</div></a>
			<a class="tile" href="/admin/clients"><div class="k">At risk</div><div class="v" class:tone-danger={atRisk > 0}>{atRisk}</div><div class="foot">{billing.pastDue} past due · {billing.canceled} canceled</div></a>
			<a class="tile" href="/admin/clients"><div class="k">Renewals · 7d</div><div class="v">{billing.upcomingRenewals}</div><div class="foot">{billing.trialing} on trial</div></a>
		</div>
	</div>

	<!-- PLATFORM INTELLIGENCE -->
	{#if insights.length}
		<h2 class="section">Platform intelligence</h2>
		<div class="intel">
			{#each insights as ins}
				<div class="intel-row"><span class="intel-ico">✦</span><span>{ins.text}</span></div>
			{/each}
		</div>
	{/if}

	<!-- LIVE ACTIVITY -->
	<h2 class="section">Live activity</h2>
	<div class="card feed">
		{#if activity.length}
			{#each activity as e}
				<div class="feed-row">
					<span class="fdot {e.type}"></span>
					<div class="feed-body"><div class="feed-t">{e.title}</div>{#if e.meta}<div class="feed-m">{e.meta}</div>{/if}</div>
					<span class="feed-time">{ago(e.at)}</span>
				</div>
			{/each}
		{:else}<div class="empty-soft sm">No activity yet.</div>{/if}
	</div>

	<!-- QUICK ACTIONS -->
	<h2 class="section">Quick actions</h2>
	<div class="quick">
		<a class="qa" href="/admin/clients/new"><span class="qi">＋</span> Add client</a>
		<a class="qa" href="/admin/industries"><span class="qi">◲</span> Industries</a>
		<a class="qa" href="/admin/ai"><span class="qi">✦</span> AI operations</a>
		<a class="qa" href="/admin/revenue"><span class="qi">＄</span> Revenue</a>
		<a class="qa" href="/admin/plans"><span class="qi">▤</span> Plans</a>
		<a class="qa" href="/admin/settings"><span class="qi">⚙</span> Settings</a>
	</div>
{/if}

<style>
	/* HERO */
	.hero {
		display: flex;
		gap: 1.2rem;
		align-items: stretch;
		justify-content: space-between;
		background: linear-gradient(120deg, rgba(var(--gold-rgb), 0.1), transparent 55%), rgba(var(--panel-rgb), 0.75);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		padding: 1.4rem 1.5rem;
		box-shadow: var(--shadow);
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}
	.hero-main {
		min-width: 300px;
		flex: 1;
	}
	.hero-hi {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--strong);
		letter-spacing: -0.02em;
	}
	.wave {
		font-size: 1.2rem;
	}
	.hero-status {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--warn);
		font-weight: 600;
		margin-top: 0.4rem;
	}
	.hero-status.ok {
		color: var(--mint);
	}
	.pulse {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
		box-shadow: 0 0 0 0 currentColor;
		animation: pulse 2s infinite;
	}
	@keyframes pulse {
		0% { box-shadow: 0 0 0 0 rgba(var(--gold-rgb), 0.5); }
		70% { box-shadow: 0 0 0 7px rgba(var(--gold-rgb), 0); }
		100% { box-shadow: 0 0 0 0 rgba(var(--gold-rgb), 0); }
	}
	.summary {
		list-style: none;
		margin: 0.9rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-width: 680px;
	}
	.summary li {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		font-size: 0.92rem;
		color: var(--soft);
		line-height: 1.45;
	}
	.sum-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex: none;
		margin-top: 0.45rem;
		background: var(--muted);
	}
	.sum-good .sum-dot {
		background: var(--mint);
	}
	.sum-warn .sum-dot {
		background: var(--warn);
	}
	.hero-chips {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
		align-content: center;
	}
	.chip {
		display: block;
		background: rgba(var(--well-rgb), 0.5);
		border: 1px solid var(--edge);
		border-radius: 12px;
		padding: 0.6rem 0.9rem;
		min-width: 0;
		text-decoration: none;
		transition: border-color 0.16s;
	}
	a.chip:hover {
		border-color: rgba(var(--gold-rgb), 0.4);
	}
	.chip-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.4rem;
	}
	.chip .cv {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--strong);
		line-height: 1;
	}
	.chip .cl {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.7rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.chip.warn .cv {
		color: var(--warn);
	}
	.chip .delta {
		flex: none;
		font-size: 0.7rem;
		font-weight: 700;
		white-space: nowrap;
	}
	.delta.up {
		color: var(--mint);
	}
	.delta.down {
		color: var(--danger);
	}

	/* Platform Copilot */
	.copilot {
		background: linear-gradient(120deg, rgba(var(--gold-rgb), 0.08), transparent 55%), rgba(var(--panel-rgb), 0.72);
		margin-bottom: 1.1rem;
	}
	.cop-head {
		font-weight: 700;
		color: var(--strong);
		font-size: 1rem;
		margin-bottom: 0.7rem;
	}
	.cop-spark {
		color: var(--mint);
	}
	.cop-sub {
		font-weight: 400;
		color: var(--muted);
		font-size: 0.86rem;
	}
	.cop-form {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.cop-form input {
		flex: 1;
		min-width: 240px;
	}
	.cop-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.6rem;
	}
	.cop-chip {
		border: 1px solid var(--edge);
		background: var(--panel-2);
		color: var(--body);
		border-radius: 999px;
		padding: 0.3rem 0.7rem;
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}
	.cop-chip:hover {
		border-color: var(--mint);
		color: var(--strong);
	}
	.cop-answer {
		margin-top: 0.9rem;
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: var(--panel-2);
		padding: 0.9rem 1rem;
	}
	.cop-q {
		font-weight: 600;
		color: var(--strong);
		margin-bottom: 0.45rem;
	}
	.cop-a {
		font-size: 0.92rem;
		color: var(--body);
		line-height: 1.55;
		white-space: pre-wrap;
	}

	/* KPI clusters */
	.kpi-cluster {
		margin-bottom: 1.1rem;
	}
	.cl-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin: 0 0 0.55rem;
	}
	.cl-label {
		font-size: 0.74rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}
	.cl-head a {
		font-size: 0.78rem;
		color: var(--mint);
		font-weight: 600;
	}
	.stat-grid.four {
		grid-template-columns: repeat(4, 1fr);
	}
	.stat-grid.four a.tile {
		text-decoration: none;
		transition: border-color 0.16s, transform 0.16s;
	}
	.stat-grid.four a.tile:hover {
		border-color: rgba(var(--gold-rgb), 0.4);
		transform: translateY(-2px);
	}
	@media (max-width: 900px) {
		.stat-grid.four {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 520px) {
		.stat-grid.four {
			grid-template-columns: 1fr 1fr;
		}
	}
	.tone-ok {
		color: #1f9d55;
	}
	.tone-warn {
		color: var(--warn);
	}
	.tone-danger {
		color: var(--danger);
	}

	/* Platform intelligence feed */
	.intel {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 0.6rem;
	}
	.intel-row {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		background: rgba(var(--panel-rgb), 0.72);
		border: 1px solid var(--edge);
		border-radius: 12px;
		padding: 0.8rem 0.95rem;
		font-size: 0.9rem;
		color: var(--body);
		line-height: 1.45;
	}
	.intel-ico {
		color: var(--mint);
		flex: none;
		margin-top: 1px;
	}

	/* Live activity feed */
	.feed {
		max-height: 620px;
		overflow-y: auto;
	}
	.feed-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--line-2);
	}
	.feed-row:last-child {
		border-bottom: none;
	}
	.fdot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: none;
		background: var(--accent);
	}
	.fdot.lead {
		background: var(--mint);
	}
	.fdot.signup {
		background: #a78bfa;
	}
	.feed-body {
		flex: 1;
		min-width: 0;
	}
	.feed-t {
		font-size: 0.84rem;
		color: var(--body);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.feed-m {
		font-size: 0.74rem;
		color: var(--muted);
	}
	.feed-time {
		font-size: 0.74rem;
		color: var(--faint);
		flex: none;
	}
	.empty-soft {
		color: var(--muted);
		text-align: center;
		padding: 1.4rem;
		font-size: 0.88rem;
	}
	.empty-soft.sm {
		padding: 0.9rem;
		font-size: 0.82rem;
	}

	/* Quick actions */
	.quick {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.qa {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(var(--panel-rgb), 0.72);
		border: 1px solid var(--edge);
		border-radius: 12px;
		padding: 0.7rem 1.1rem;
		color: var(--body);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.88rem;
		transition: border-color 0.16s;
	}
	.qa:hover {
		border-color: var(--mint);
	}
	.qi {
		color: var(--mint);
		font-size: 1rem;
	}
</style>
