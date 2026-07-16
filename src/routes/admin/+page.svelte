<script>
	import { onMount } from 'svelte';
	import { readableInk } from '$lib/luminance.js';
	import Donut from '$lib/components/admin/Donut.svelte';
	import TrendChart from '$lib/components/admin/TrendChart.svelte';
	import HealthRing from '$lib/components/admin/HealthRing.svelte';
	import GrowthArea from '$lib/components/admin/GrowthArea.svelte';

	export let data;
	$: t = data.totals;
	$: rev = data.revenue;
	$: spend = data.spend;
	$: health = data.health;
	$: billing = data.billing;
	$: clients = data.clients ?? [];
	$: attention = data.attention ?? [];
	$: opps = data.opportunities ?? [];
	$: activity = data.activity ?? [];
	$: leaders = data.leaders ?? { conversations: [], leads: [] };
	$: insight = data.insight;
	$: trends = data.trends ?? { conversations: [], leads: [], growth: [] };
	$: name = (data.superName ?? 'there').split(/\s+/)[0];

	// Earthy categorical palette that sits in the forest/gold theme: gold, sage,
	// terracotta, soft lilac, light gold, teal, clay — distinct but on-brand.
	const PALETTE = ['#e0b24c', '#4b9e83', '#d9784c', '#b79ce0', '#ecca7d', '#6ea8a0', '#cf8f8f'];

	const money = (n, cur = rev?.currency ?? 'USD') =>
		n == null ? '—' : new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
	// AI provider costs are billed in USD; convert to the platform currency (TZS)
	// so cost & margin read in the same currency as revenue. Approximate rate.
	const USD_TZS = 2600;
	const inRevCur = (usd) => (rev?.currency === 'USD' ? usd : usd * USD_TZS);
	const initials = (s) => (s ?? '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	const num = (n) => new Intl.NumberFormat('en').format(n ?? 0);
	function tokens(n) {
		if (!n) return '0';
		if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
		if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
		return String(n);
	}
	function ago(s) {
		if (!s) return '—';
		const d = (Date.now() - new Date(s).getTime()) / 1000;
		if (d < 60) return 'just now';
		if (d < 3600) return `${Math.floor(d / 60)}m ago`;
		if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
		if (d < 2592000) return `${Math.floor(d / 86400)}d ago`;
		return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(s));
	}

	$: avgHealth = clients.length ? Math.round(clients.reduce((s, c) => s + (c.health?.score ?? 0), 0) / clients.length) : 0;
	$: planColor = (() => {
		const m = new Map();
		(rev?.byPlan ?? []).forEach((p, i) => m.set(p.key, PALETTE[i % PALETTE.length]));
		return m;
	})();
	$: maxPlanMrr = Math.max(1, ...(rev?.byPlan ?? []).map((p) => p.mrr));
	$: maxLbConv = Math.max(1, ...(leaders.conversations ?? []).map((c) => c.conversations));
	$: maxLbLeads = Math.max(1, ...(leaders.leads ?? []).map((c) => c.leads));
	$: maxModelCost = Math.max(1e-9, ...(spend?.byModel ?? []).map((m) => m.cost));

	const capPct = (c) => (c.monthly_conversation_cap > 0 ? Math.min(100, Math.round(((c.conversationsMonth ?? 0) / c.monthly_conversation_cap) * 100)) : null);
	const capCls = (p) => (p == null ? '' : p >= 100 ? 'red' : p >= 80 ? 'amber' : 'green');

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

	const statusWord = (s) => (s === 'operational' ? 'Operational' : 'Not set up');
</script>

{#if data.loadError}
	<div class="page-head"><div><h1>Dashboard</h1></div></div>
	<div class="notice err">Could not load platform data: {data.loadError}</div>
{:else if t}
	<!-- 1 · HERO -->
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
			<div class="chip" class:warn={attention.length}>
				<div class="chip-top"><span class="cv">{attention.length}</span></div>
				<span class="cl">Need attention</span>
			</div>
		</div>
	</section>

	<!-- 2 · EXECUTIVE KPI ROW -->
	<div class="stat-grid five">
		<div class="tile">
			<div class="k">Monthly recurring revenue</div>
			<div class="v">{money(rev.mrr)}</div>
			<div class="foot">{money(rev.arr)} ARR · {money(rev.arpu)} ARPU</div>
		</div>
		<div class="tile">
			<div class="k">Active clients</div>
			<div class="v">{t.active}</div>
			<div class="foot">{rev.payingCount} paying · {t.clients} total</div>
		</div>
		<div class="tile">
			<div class="k">Qualified leads</div>
			<div class="v">{t.qualified}</div>
			<div class="foot">of {t.leads} captured · {t.avgLeads}/client</div>
		</div>
		<div class="tile">
			<div class="k">Conversations · mo</div>
			<div class="v">{num(t.conversationsMonth)}</div>
			<div class="foot">{num(t.conversations)} all-time · {t.avgConv}/client</div>
		</div>
		<div class="tile">
			<div class="k">Avg client health</div>
			<div class="v">{avgHealth}</div>
			<div class="foot">heuristic · {t.items} knowledge items</div>
		</div>
	</div>

	<!-- 3 · REVENUE & PLAN MIX -->
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

	<!-- 4 · GROWTH CURVE -->
	<div class="card growth">
		<div class="growth-head">
			<div><div class="gh-t">Client growth</div><div class="gh-s">Cumulative tenants by signup date · last 30 days</div></div>
			<div class="growth-callouts">
				<div><b>{t.clients}</b><span>total</span></div>
				<div><b class="mint">+{t.newThisMonth}</b><span>this month</span></div>
				<div><b>{t.active}</b><span>active</span></div>
			</div>
		</div>
		<GrowthArea series={trends.growth} />
	</div>

	<!-- 5 · PLATFORM HEALTH -->
	<h2 class="section">Platform health</h2>
	<div class="card health">
		<div class="health-overall" class:ok={health.ok}>
			<span class="big-dot"></span>
			<div>
				<div class="ho-word">{health.ok ? 'All systems operational' : 'Some services need setup'}</div>
				<div class="ho-sub">Live status check · {health.paymentEventsToday} payment {health.paymentEventsToday === 1 ? 'event' : 'events'} today</div>
			</div>
		</div>
		<div class="health-grid">
			{#each health.checks as c}
				<div class="hcheck">
					<span class="hdot {c.status}"></span>
					<div><div class="hc-n">{c.name}</div><div class="hc-note">{c.note}</div></div>
					<span class="hc-status {c.status}">{statusWord(c.status)}</span>
				</div>
			{/each}
		</div>
		<p class="fineprint">Point-in-time check (reachability + configuration) — not a historical uptime %, which we don’t log.</p>
	</div>

	<!-- 6 · USAGE ANALYTICS -->
	<h2 class="section">Platform usage · last 14 days</h2>
	<div class="split usage">
		<div class="card">
			<div class="usage-legend"><span class="ul bar">Conversations</span><span class="ul line">Leads</span></div>
			<TrendChart bars={trends.conversations} line={trends.leads} height={90} />
		</div>
		<div class="usage-tiles">
			<div class="mini-tile"><div class="mt-v">{t.convToday}</div><div class="mt-l">Conversations today</div></div>
			<div class="mini-tile"><div class="mt-v">{t.leadsToday}</div><div class="mt-l">Leads today</div></div>
			<div class="mini-tile"><div class="mt-v">{num(spend.turns)}</div><div class="mt-l">AI responses / mo</div></div>
			<div class="mini-tile"><div class="mt-v">{tokens(spend.inputTokens + spend.outputTokens)}</div><div class="mt-l">Tokens / mo</div></div>
		</div>
	</div>

	<!-- 7 · AI COST & MARGIN -->
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

	<!-- 8 · LEADERBOARD -->
	<h2 class="section">Client leaderboard</h2>
	<div class="split">
		<div class="card lb">
			<div class="lb-head">Most conversations</div>
			{#if leaders.conversations.length}
				{#each leaders.conversations as c, i}
					<a class="lb-row" href={`/admin/clients/${c.slug}`}>
						<span class="rank">{i + 1}</span>
						<span class="lb-name">{c.name}</span>
						<div class="btrack sm"><span class="bfill" style="width:{Math.round((c.conversations / maxLbConv) * 100)}%"></span></div>
						<span class="bv">{num(c.conversations)}</span>
					</a>
				{/each}
			{:else}<div class="empty-soft sm">No conversations yet.</div>{/if}
		</div>
		<div class="card lb">
			<div class="lb-head">Most leads</div>
			{#if leaders.leads.length}
				{#each leaders.leads as c, i}
					<a class="lb-row" href={`/admin/clients/${c.slug}`}>
						<span class="rank">{i + 1}</span>
						<span class="lb-name">{c.name}</span>
						<div class="btrack sm"><span class="bfill" style="width:{Math.round((c.leads / maxLbLeads) * 100)}%;background:var(--mint)"></span></div>
						<span class="bv">{num(c.leads)}</span>
					</a>
				{/each}
			{:else}<div class="empty-soft sm">No leads captured yet.</div>{/if}
		</div>
	</div>

	<!-- 9 · CLIENT PORTFOLIO -->
	<h2 class="section">Client portfolio</h2>
	{#if clients.length === 0}
		<div class="card empty">
			<h3>No clients yet</h3>
			<p>Onboard your first business to start answering its customers.</p>
			<a class="btn" href="/admin/clients/new">Add your first client</a>
		</div>
	{:else}
		<div class="portfolio">
			{#each clients as c}
				<div class="pcard">
					<div class="pc-top">
						{#if c.logo_url}
							<div class="avatar has-logo"><img src={c.logo_url} alt="" /></div>
						{:else}
							<div class="avatar" style="background:{c.brand_color ?? '#e0b24c'};color:{readableInk(c.brand_color ?? '#e0b24c')}">{initials(c.name)}</div>
						{/if}
						<div class="pc-id">
							<div class="pc-name">{c.name}</div>
							<div class="pc-meta">{c.plan} · <span class="st {c.subscription_status}">{c.is_active ? c.subscription_status : 'paused'}</span></div>
						</div>
						<HealthRing score={c.health.score} cls={c.health.cls} />
					</div>
					<div class="pc-stats">
						<div><b>{money((rev.byPlan.find((p) => p.key === c.plan)?.price) ?? 0)}</b><span>MRR</span></div>
						<div><b>{num(c.conversationsMonth)}</b><span>conv / mo</span></div>
						<div><b>{num(c.leads)}</b><span>leads</span></div>
						<div><b>{num(c.items)}</b><span>knowledge</span></div>
					</div>
					{#if capPct(c) != null}
						<div class="cap"><div class="cap-track"><span class="cap-fill {capCls(capPct(c))}" style="width:{capPct(c)}%"></span></div><span class="cap-l">{capPct(c)}% of cap</span></div>
					{/if}
					<div class="pc-foot">
						<span class="pc-last">Active {ago(c.lastActive)} · <span class="hb {c.health.cls}">{c.health.label}</span></span>
					</div>
					<div class="pc-actions">
						<a class="btn sm" href={`/admin/clients/${c.slug}`}>Open tenant</a>
						<a class="btn sm ghost" href={`/admin/clients/${c.slug}`}>Billing</a>
						<a class="btn sm ghost" href={`/admin/clients/${c.slug}`}>{c.is_active ? 'Suspend' : 'Activate'}</a>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- 10 · ATTENTION -->
	{#if attention.length}
		<h2 class="section">Needs attention <span class="count-pill">{attention.length}</span></h2>
		<div class="card list">
			{#each attention as a}
				<a class="att-row sev{a.top.sev}" href={`/admin/clients/${a.client.slug}`}>
					<span class="att-dot"></span>
					<div class="att-body">
						<div class="att-name">{a.client.name}</div>
						<div class="att-reasons">
							{#each a.flags.slice(0, 3) as f}<span class="att-flag">{f.text}</span>{/each}
						</div>
					</div>
					<span class="att-act">{a.top.action} →</span>
				</a>
			{/each}
		</div>
	{/if}

	<!-- 11 · INSIGHT -->
	{#if insight}
		<div class="card insight"><span class="spark">✦</span><div><div class="ins-t">AI insight</div><p>{insight}</p></div></div>
	{/if}

	<!-- 12 · ACTIVITY + 13 · OPPORTUNITIES -->
	<div class="split top">
		<div class="card feed">
			<div class="card-head">Live activity</div>
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
		<div class="card opps">
			<div class="card-head">Growth opportunities</div>
			{#if opps.length}
				{#each opps as o}
					<div class="opp-row">
						<span class="opp-kind {o.kind}">{o.kind === 'upsell' ? 'Upsell' : 'Activate'}</span>
						<div><div class="opp-t">{o.title}</div><div class="opp-d">{o.detail}</div></div>
					</div>
				{/each}
			{:else}<div class="empty-soft sm">No opportunities flagged — the fleet looks well-optimized.</div>{/if}
		</div>
	</div>

	<!-- 14 · BILLING -->
	<h2 class="section">Billing overview</h2>
	<div class="stat-grid">
		<div class="tile"><div class="k">MRR / ARR</div><div class="v">{money(billing.mrr)}</div><div class="foot">{money(billing.arr)} annual run-rate</div></div>
		<div class="tile"><div class="k">Failed payments</div><div class="v">{billing.failedPayments}</div><div class="foot">from Snippe attempts</div></div>
		<div class="tile"><div class="k">Renewals · 7d</div><div class="v">{billing.upcomingRenewals}</div><div class="foot">{billing.trialing} on trial</div></div>
		<div class="tile"><div class="k">At risk</div><div class="v">{billing.pastDue + billing.canceled}</div><div class="foot">{billing.pastDue} past due · {billing.canceled} canceled</div></div>
	</div>

	<!-- 15 · QUICK ACTIONS -->
	<h2 class="section">Quick actions</h2>
	<div class="quick">
		<a class="qa" href="/admin/clients/new"><span class="qi">＋</span> Add client</a>
		<a class="qa" href="/admin/plans"><span class="qi">▤</span> Manage plans</a>
		<a class="qa" href="/admin/plans"><span class="qi">＄</span> Billing &amp; pricing</a>
	</div>

	<!-- 16 · HONEST ROADMAP -->
	<h2 class="section">Not yet tracked</h2>
	<div class="roadmap">
		<div class="rm">Bookings &amp; conversion <span>needs a bookings table</span></div>
		<div class="rm">Geographic map <span>we don’t collect client location</span></div>
		<div class="rm">MRR / churn over time <span>metrics aren’t snapshotted</span></div>
		<div class="rm">Response time &amp; search volume <span>not measured</span></div>
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

	/* SPLIT layouts */
	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.85rem;
	}
	.split.top {
		align-items: start;
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
	}
	.mix-legend {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
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
	.bars-head,
	.lb-head,
	.card-head {
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
	.btrack.sm {
		height: 6px;
	}
	.bfill {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: 99px;
		transition: width 0.5s ease;
	}
	.bv {
		width: 62px;
		flex: none;
		text-align: right;
		font-size: 0.82rem;
		color: var(--strong);
		font-weight: 600;
	}
	.bars-foot {
		display: flex;
		gap: 1.4rem;
		margin-top: 0.9rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--edge);
	}
	.bars-foot div {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.bars-foot b {
		color: var(--strong);
		font-size: 1rem;
		display: block;
	}

	/* Growth */
	.growth {
		margin-top: 0.85rem;
	}
	.growth-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 0.6rem;
		flex-wrap: wrap;
	}
	.gh-t {
		font-weight: 700;
		color: var(--strong);
	}
	.gh-s {
		font-size: 0.78rem;
		color: var(--muted);
	}
	.growth-callouts {
		display: flex;
		gap: 1.3rem;
	}
	.growth-callouts b {
		font-size: 1.2rem;
		color: var(--strong);
		display: block;
	}
	.growth-callouts .mint {
		color: var(--mint);
	}
	.growth-callouts span {
		font-size: 0.7rem;
		color: var(--muted);
		text-transform: uppercase;
	}

	/* Health */
	.health-overall {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding-bottom: 0.9rem;
		margin-bottom: 0.9rem;
		border-bottom: 1px solid var(--edge);
	}
	.big-dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--warn);
		box-shadow: none;
	}
	.health-overall.ok .big-dot {
		background: var(--mint);
		box-shadow: none;
	}
	.ho-word {
		font-weight: 700;
		color: var(--strong);
	}
	.ho-sub {
		font-size: 0.78rem;
		color: var(--muted);
	}
	.health-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}
	@media (max-width: 640px) {
		.health-grid {
			grid-template-columns: 1fr;
		}
	}
	.hcheck {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.7rem;
		background: var(--panel-2);
		border-radius: 10px;
	}
	.hdot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: none;
	}
	.hdot.operational {
		background: var(--mint);
	}
	.hdot.unconfigured {
		background: var(--faint);
	}
	.hc-n {
		font-size: 0.85rem;
		color: var(--body);
		font-weight: 600;
	}
	.hc-note {
		font-size: 0.72rem;
		color: var(--muted);
	}
	.hc-status {
		margin-left: auto;
		font-size: 0.72rem;
		font-weight: 600;
	}
	.hc-status.operational {
		color: var(--mint);
	}
	.hc-status.unconfigured {
		color: var(--faint);
	}

	/* Usage */
	.usage-legend {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.6rem;
		font-size: 0.76rem;
		color: var(--muted);
	}
	.ul::before {
		content: '';
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 3px;
		margin-right: 5px;
		vertical-align: middle;
	}
	.ul.bar::before {
		background: var(--accent);
	}
	.ul.line::before {
		background: var(--mint);
	}
	.usage-tiles,
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
	.empty-soft.sm {
		padding: 0.9rem;
		font-size: 0.82rem;
	}

	/* Leaderboard */
	.lb-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.4rem 0;
		text-decoration: none;
	}
	.rank {
		width: 20px;
		flex: none;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--muted);
		text-align: center;
	}
	.lb-name {
		width: 120px;
		flex: none;
		font-size: 0.85rem;
		color: var(--body);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Portfolio */
	/* Keep the live activity feed tidy; scroll rather than stretch the page. */
	.feed {
		max-height: 620px;
		overflow-y: auto;
	}
	/* Full-width portfolio: cards stretch to fill the row, capped at 4 per row. */
	.portfolio {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(max(240px, calc((100% - 3 * 0.85rem) / 4)), 1fr));
		gap: 0.85rem;
	}
	.pcard {
		background: rgba(var(--panel-rgb), 0.72);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		padding: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		transition: border-color 0.16s, transform 0.16s;
	}
	.pcard:hover {
		border-color: rgba(var(--gold-rgb), 0.35);
		transform: translateY(-2px);
	}
	.pc-top {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.avatar {
		width: 42px;
		height: 42px;
		border-radius: 11px;
		display: grid;
		place-items: center;
		font-weight: 700;
		font-size: 0.9rem;
		flex: none;
	}
	.avatar.has-logo {
		background: var(--panel-2);
		border: 1px solid var(--edge);
		overflow: hidden;
	}
	.avatar.has-logo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: inherit;
	}
	.pc-id {
		min-width: 0;
		flex: 1;
	}
	.pc-name {
		font-weight: 650;
		color: var(--strong);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.pc-meta {
		font-size: 0.76rem;
		color: var(--muted);
		text-transform: capitalize;
	}
	.st.active {
		color: var(--mint);
	}
	.st.past_due {
		color: var(--warn);
	}
	.st.canceled {
		color: var(--danger);
	}
	.pc-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.4rem;
		padding: 0.6rem 0;
		border-top: 1px solid var(--edge);
		border-bottom: 1px solid var(--edge);
	}
	.pc-stats div {
		text-align: center;
	}
	.pc-stats b {
		display: block;
		color: var(--strong);
		font-size: 0.95rem;
	}
	.pc-stats span {
		font-size: 0.64rem;
		color: var(--muted);
		text-transform: uppercase;
	}
	.cap {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.cap-track {
		flex: 1;
		height: 6px;
		background: var(--panel-2);
		border-radius: 99px;
		overflow: hidden;
	}
	.cap-fill {
		display: block;
		height: 100%;
		border-radius: 99px;
	}
	.cap-fill.green {
		background: var(--mint);
	}
	.cap-fill.amber {
		background: var(--warn);
	}
	.cap-fill.red {
		background: var(--danger);
	}
	.cap-l {
		font-size: 0.72rem;
		color: var(--muted);
		flex: none;
	}
	.pc-last {
		font-size: 0.76rem;
		color: var(--muted);
	}
	.hb {
		font-weight: 600;
	}
	.hb.hot {
		color: var(--mint);
	}
	.hb.warm {
		color: var(--accent);
	}
	.hb.cool {
		color: var(--warn);
	}
	.hb.cold {
		color: var(--danger);
	}
	.pc-actions {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	/* Attention */
	.count-pill {
		font-size: 0.72rem;
		background: var(--warn);
		color: var(--ink-text);
		border-radius: 99px;
		padding: 0.1rem 0.5rem;
		font-weight: 700;
		vertical-align: middle;
	}
	.list {
		padding: 0.4rem 0.6rem;
	}
	.att-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 0.5rem;
		border-bottom: 1px solid var(--line-2);
		text-decoration: none;
	}
	.att-row:last-child {
		border-bottom: none;
	}
	.att-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: none;
		background: var(--accent);
	}
	.sev3 .att-dot {
		background: var(--danger);
	}
	.sev2 .att-dot {
		background: var(--warn);
	}
	.att-body {
		flex: 1;
		min-width: 0;
	}
	.att-name {
		font-weight: 600;
		color: var(--strong);
		font-size: 0.9rem;
	}
	.att-reasons {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-top: 0.2rem;
	}
	.att-flag {
		font-size: 0.72rem;
		color: var(--soft);
		background: var(--panel-2);
		border-radius: 6px;
		padding: 0.1rem 0.45rem;
	}
	.att-act {
		font-size: 0.78rem;
		color: var(--mint);
		font-weight: 600;
		flex: none;
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

	/* Feed + opps */
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
	.opp-row {
		display: flex;
		gap: 0.7rem;
		align-items: flex-start;
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--line-2);
	}
	.opp-row:last-child {
		border-bottom: none;
	}
	.opp-kind {
		font-size: 0.66rem;
		font-weight: 700;
		text-transform: uppercase;
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
		flex: none;
	}
	.opp-kind.upsell {
		background: rgba(var(--gold-rgb), 0.16);
		color: var(--mint);
	}
	.opp-kind.activate {
		background: rgba(var(--accent-rgb), 0.16);
		color: var(--accent);
	}
	.opp-t {
		font-size: 0.86rem;
		color: var(--body);
		font-weight: 600;
	}
	.opp-d {
		font-size: 0.76rem;
		color: var(--muted);
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

	/* Roadmap */
	.roadmap {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.6rem;
	}
	.rm {
		border: 1px dashed var(--edge);
		border-radius: 12px;
		padding: 0.9rem 1rem;
		color: var(--muted);
		font-size: 0.86rem;
		font-weight: 600;
	}
	.rm span {
		display: block;
		font-weight: 400;
		font-size: 0.74rem;
		color: var(--faint);
		margin-top: 0.2rem;
	}
</style>
