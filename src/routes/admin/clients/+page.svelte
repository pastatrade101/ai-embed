<script>
	import { readableInk } from '$lib/luminance.js';
	import TrendChart from '$lib/components/admin/TrendChart.svelte';
	import HealthRing from '$lib/components/admin/HealthRing.svelte';
	import GrowthArea from '$lib/components/admin/GrowthArea.svelte';

	export let data;
	$: t = data.totals;
	$: rev = data.revenue;
	$: spend = data.spend;
	$: clients = data.clients ?? [];
	$: attention = data.attention ?? [];
	$: opps = data.opportunities ?? [];
	$: leaders = data.leaders ?? { conversations: [], leads: [] };
	$: trends = data.trends ?? { conversations: [], leads: [], growth: [] };

	const money = (n, cur = rev?.currency ?? 'USD') =>
		n == null ? '—' : new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
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
	const initials = (s) => (s ?? '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

	$: maxLbConv = Math.max(1, ...(leaders.conversations ?? []).map((c) => c.conversations));
	$: maxLbLeads = Math.max(1, ...(leaders.leads ?? []).map((c) => c.leads));
	// Usage against the real capacity (budget-derived ≈ conversations, matching
	// the billing + plan screens), not the legacy hard cap.
	const capOf = (c) => Number(c.aiCapacity) || Number(c.monthly_conversation_cap) || 0;
	const capPct = (c) => {
		const cap = capOf(c);
		return cap > 0 ? Math.min(100, Math.round(((c.conversationsMonth ?? 0) / cap) * 100)) : null;
	};
	const capCls = (p) => (p == null ? '' : p >= 100 ? 'red' : p >= 80 ? 'amber' : 'green');
	// A client that's used a few conversations of a large plan is a real <1% — show
	// that (with a visible sliver) rather than a misleading flat "0% of cap".
	const capLabel = (c) => {
		const p = capPct(c);
		if (p == null) return null;
		return p === 0 && (c.conversationsMonth ?? 0) > 0 ? '<1% of cap' : `${p}% of cap`;
	};
	const capWidth = (c) => {
		const p = capPct(c);
		if (p == null) return 0;
		return p === 0 && (c.conversationsMonth ?? 0) > 0 ? 2 : p;
	};
</script>

<div class="page-head">
	<div><h1>Clients</h1><div class="sub">Every tenant, their health and activity, plus upsell opportunities and who needs attention.</div></div>
	<div class="actions"><a class="btn sm" href="/admin/clients/new">+ Add client</a></div>
</div>

{#if data.loadError}
	<div class="notice err">Could not load platform data: {data.loadError}</div>
{:else}
	<!-- PORTFOLIO -->
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
						<div class="cap"><div class="cap-track"><span class="cap-fill {capCls(capPct(c))}" style="width:{capWidth(c)}%"></span></div><span class="cap-l">{capLabel(c)}</span></div>
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

	<!-- UPSELL OPPORTUNITIES -->
	<h2 class="section">Upsell opportunities</h2>
	<div class="card opps">
		{#if opps.length}
			{#each opps as o}
				<div class="opp-row">
					<span class="opp-kind {o.kind}">{o.kind === 'upsell' ? 'Upsell' : 'Activate'}</span>
					<div><div class="opp-t">{o.title}</div><div class="opp-d">{o.detail}</div></div>
				</div>
			{/each}
		{:else}<div class="empty-soft sm">No opportunities flagged — the fleet looks well-optimized.</div>{/if}
	</div>

	<!-- ATTENTION -->
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

	<!-- LEADERBOARD -->
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

	<!-- GROWTH -->
	<h2 class="section">Client growth</h2>
	<div class="card growth">
		<div class="growth-head">
			<div><div class="gh-t">Cumulative tenants</div><div class="gh-s">By signup date · last 30 days</div></div>
			<div class="growth-callouts">
				<div><b>{t.clients}</b><span>total</span></div>
				<div><b class="mint">+{t.newThisMonth}</b><span>this month</span></div>
				<div><b>{t.active}</b><span>active</span></div>
			</div>
		</div>
		<GrowthArea series={trends.growth} />
	</div>

	<!-- USAGE -->
	<h2 class="section">Platform usage · last 14 days</h2>
	<div class="split">
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

	/* Portfolio: cards stretch to fill the row, capped at 4 per row. */
	.portfolio {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(max(240px, calc((100% - 3 * 0.85rem) / 4)), 1fr));
		gap: 0.85rem;
	}
	.empty {
		text-align: center;
		padding: 1.6rem;
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

	/* Opportunities */
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

	/* Leaderboard */
	.lb-head {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
		margin-bottom: 0.8rem;
	}
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

	/* Growth */
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
	.usage-tiles {
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
</style>
