<script>
	import { onMount } from 'svelte';

	export let data;
	$: t = data.totals;
	$: rev = data.revenue;
	$: health = data.health;
	$: attention = data.attention ?? [];
	$: activity = data.activity ?? [];
	$: insight = data.insight;
	$: name = (data.superName ?? 'there').split(/\s+/)[0];

	const money = (n, cur = rev?.currency ?? 'USD') =>
		n == null ? '—' : new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
	const num = (n) => new Intl.NumberFormat('en').format(n ?? 0);
	function ago(s) {
		if (!s) return '—';
		const d = (Date.now() - new Date(s).getTime()) / 1000;
		if (d < 60) return 'just now';
		if (d < 3600) return `${Math.floor(d / 60)}m ago`;
		if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
		if (d < 2592000) return `${Math.floor(d / 86400)}d ago`;
		return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(s));
	}

	let greeting = 'Welcome';
	onMount(() => {
		const h = new Date().getHours();
		greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
	});

	// Deterministic AI fleet sentence — every number is a real aggregate.
	$: sentence = (() => {
		if (!t) return '';
		const parts = [`You're running ${money(rev.mrr)} MRR across ${t.active} active ${t.active === 1 ? 'client' : 'clients'}`];
		if (t.newThisMonth > 0) parts[0] += `, ${t.newThisMonth} new this month` + (rev.newMrrMonth ? ` (+${money(rev.newMrrMonth)} MRR)` : '');
		if (t.leadsToday || t.convToday) parts.push(`${t.leadsToday} ${t.leadsToday === 1 ? 'lead' : 'leads'} and ${t.convToday} ${t.convToday === 1 ? 'conversation' : 'conversations'} came in today`);
		parts.push(attention.length ? `${attention.length} ${attention.length === 1 ? 'client needs' : 'clients need'} your attention` : 'every client looks healthy');
		return parts.join('. ') + '.';
	})();
</script>

{#if data.loadError}
	<div class="page-head"><div><h1>Dashboard</h1></div></div>
	<div class="notice err">Could not load platform data: {data.loadError}</div>
{:else if t}
	<!-- HERO -->
	<section class="hero">
		<div class="hero-main">
			<div class="hero-hi">{greeting}, {name} <span class="wave">👋</span></div>
			<p class="hero-sentence">{sentence}</p>
			<div class="hero-status" class:ok={health.ok}>
				<span class="pulse"></span>
				{health.ok ? 'AI platform healthy — all systems operational' : 'AI platform online — some integrations need setup'}
			</div>
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

	<!-- EXECUTIVE KPI ROW -->
	<div class="stat-grid five">
		<a class="tile" href="/admin/revenue">
			<div class="k">Monthly recurring revenue</div>
			<div class="v">{money(rev.mrr)}</div>
			<div class="foot">{money(rev.arr)} ARR · {money(rev.arpu)} ARPU</div>
		</a>
		<a class="tile" href="/admin/clients">
			<div class="k">Active clients</div>
			<div class="v">{t.active}</div>
			<div class="foot">{rev.payingCount} paying · {t.clients} total</div>
		</a>
		<a class="tile" href="/admin/clients">
			<div class="k">Qualified leads</div>
			<div class="v">{t.qualified}</div>
			<div class="foot">of {t.leads} captured · {t.avgLeads}/client</div>
		</a>
		<a class="tile" href="/admin/clients">
			<div class="k">Conversations · mo</div>
			<div class="v">{num(t.conversationsMonth)}</div>
			<div class="foot">{num(t.conversations)} all-time · {t.avgConv}/client</div>
		</a>
		<a class="tile" href="/admin/clients">
			<div class="k">Avg client health</div>
			<div class="v">{t.avgHealth}</div>
			<div class="foot">heuristic · {t.items} knowledge items</div>
		</a>
	</div>

	<!-- INSIGHT -->
	{#if insight}
		<div class="card insight"><span class="spark">✦</span><div><div class="ins-t">AI insight</div><p>{insight}</p></div></div>
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
		<a class="qa" href="/admin/clients"><span class="qi">▤</span> Clients</a>
		<a class="qa" href="/admin/revenue"><span class="qi">＄</span> Revenue</a>
		<a class="qa" href="/admin/plans"><span class="qi">▤</span> Plans &amp; billing</a>
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
	.hero-sentence {
		color: var(--soft);
		margin: 0.5rem 0 0.8rem;
		max-width: 640px;
		line-height: 1.5;
		font-size: 0.96rem;
	}
	.hero-status {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.82rem;
		color: var(--warn);
		font-weight: 600;
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

	.stat-grid.five {
		grid-template-columns: repeat(5, 1fr);
	}
	.stat-grid.five .tile {
		text-decoration: none;
		transition: border-color 0.16s, transform 0.16s;
	}
	.stat-grid.five a.tile:hover {
		border-color: rgba(var(--gold-rgb), 0.4);
		transform: translateY(-2px);
	}
	@media (max-width: 1100px) {
		.stat-grid.five {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	@media (max-width: 720px) {
		.stat-grid.five {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 600px) {
		.stat-grid.five {
			grid-template-columns: 1fr;
		}
	}

	/* Insight */
	.insight {
		display: flex;
		gap: 0.8rem;
		align-items: flex-start;
		margin-top: 0.85rem;
		background: linear-gradient(120deg, rgba(var(--gold-rgb), 0.08), transparent 60%), rgba(var(--panel-rgb), 0.72);
	}
	.insight .spark {
		color: var(--mint);
		font-size: 1.1rem;
	}
	.ins-t {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
		font-weight: 700;
	}
	.insight p {
		margin: 0.2rem 0 0;
		color: var(--soft);
		font-size: 0.92rem;
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
