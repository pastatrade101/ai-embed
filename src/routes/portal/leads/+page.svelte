<script>
	import { enhance } from '$app/forms';
	import ShareCard from '$lib/components/ShareCard.svelte';

	export let data;
	export let form;
	$: ({ leads, stats, summary, insights, stageCounts, gaps, pipelineReady, client } = data);

	let q = '';
	let filter = 'all';
	let stageFilter = null;
	let openId = null;
	let savingId = null;

	// Pipeline stages (order + display). new/qualifying/qualified are AI-derived;
	// contacted/quoted/won/lost are operator-set (need the pipeline migration).
	const STAGE_META = {
		new: { label: 'New', cls: 'st-new' },
		qualifying: { label: 'Qualifying', cls: 'st-qualifying' },
		qualified: { label: 'Qualified', cls: 'st-qualified' },
		contacted: { label: 'Contacted', cls: 'st-contacted' },
		quoted: { label: 'Quoted', cls: 'st-quoted' },
		won: { label: 'Won', cls: 'st-won' },
		lost: { label: 'Lost', cls: 'st-lost' }
	};
	const STAGE_ORDER = ['new', 'qualifying', 'qualified', 'contacted', 'quoted', 'won', 'lost'];
	const OPERATOR_STAGES = ['contacted', 'quoted', 'won', 'lost'];
	// Submit a stage change; `savingId` disables that lead's control mid-flight.
	const stageSubmit = (id) => {
		savingId = id;
		return async ({ update }) => {
			await update();
			savingId = null;
		};
	};

	// ---- formatting helpers ----
	const money = (n, cur = stats.currency) => {
		if (n == null) return '';
		try {
			return new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
		} catch (e) {
			return `${cur} ${Math.round(n).toLocaleString()}`;
		}
	};
	function timeAgo(s) {
		if (!s) return '';
		const d = (Date.now() - new Date(s).getTime()) / 1000;
		if (d < 60) return 'just now';
		if (d < 3600) return `${Math.floor(d / 60)}m ago`;
		if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
		if (d < 604800) return `${Math.floor(d / 86400)}d ago`;
		return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(s));
	}
	const initials = (n) =>
		(n || '?')
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase() || '?';
	const digits = (p) => String(p || '').replace(/[^0-9]/g, '');
	const waLink = (l, msg) => `https://wa.me/${digits(l.whatsapp)}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
	const quoteMsg = (l) => {
		const who = l.name ? `Hi ${l.name.split(' ')[0]}, ` : 'Hi, ';
		const t = l.detail.tour ? `thanks for your interest in ${l.detail.tour}. ` : 'thanks for reaching out. ';
		const price = l.detail.estValue ? `Here's a quote for your group: ${money(l.detail.estValue)}. ` : '';
		return `${who}${t}${price}Happy to tailor it to your dates — when would you like to travel?`;
	};

	const INTENT = { hot: 'Very high', warm: 'High', cool: 'Medium', cold: 'Low' };
	const budgetBand = (l) => (l.detail.budget == null ? null : l.detail.budget >= 5000 ? 'High' : l.detail.budget >= 2000 ? 'Medium' : 'Modest');

	const FILTERS = [
		{ id: 'all', label: 'All' },
		{ id: 'hot', label: 'Hot' },
		{ id: 'warm', label: 'High interest' },
		{ id: 'followup', label: 'Needs follow-up' },
		{ id: 'today', label: 'Today' },
		{ id: 'week', label: 'This week' },
		{ id: 'open', label: 'Open' }
	];

	function matchFilter(l) {
		const d = l.created_at ? new Date(l.created_at) : null;
		switch (filter) {
			case 'hot':
				return l.tier.cls === 'hot';
			case 'warm':
				return l.tier.cls === 'warm';
			case 'followup':
				return l.tier.cls === 'cool' || l.tier.cls === 'cold';
			case 'today':
				return d && d.toDateString() === new Date().toDateString();
			case 'week':
				return d && Date.now() - d.getTime() < 604800000;
			case 'open':
				return l.stage !== 'won' && l.stage !== 'lost';
			default:
				return true;
		}
	}
	$: needle = q.trim().toLowerCase();
	$: filtered = leads.filter((l) => {
		if (stageFilter && l.stage !== stageFilter) return false;
		if (!matchFilter(l)) return false;
		if (!needle) return true;
		const hay = `${l.name ?? ''} ${l.whatsapp ?? ''} ${l.email ?? ''} ${l.interest ?? ''} ${l.detail.destination ?? ''} ${l.detail.tour ?? ''}`.toLowerCase();
		return hay.includes(needle);
	});
	const toggleStage = (s) => (stageFilter = stageFilter === s ? null : s);
</script>

<div class="page-head">
	<div>
		<h1>Leads</h1>
		<div class="sub">Your AI’s pipeline of potential bookings — who to contact first, and what to say next.</div>
	</div>
</div>

{#if leads.length === 0}
	<div class="card empty-cta">
		<div class="empty-ic">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
		</div>
		<h2>Your AI hasn’t captured any leads yet</h2>
		<p>Share your assistant and enquiries will land here — scored, qualified, and ready to contact.</p>
		<ShareCard slug={client.slug} name={client.name} />
	</div>
{:else}
	<!-- KPI cards -->
	<div class="kpis">
		<div class="kpi">
			<span class="kpi-l">Today’s leads</span>
			<span class="kpi-v">{stats.today}</span>
		</div>
		<div class="kpi hot">
			<span class="kpi-l">Hot leads</span>
			<span class="kpi-v">{stats.hot}</span>
			<span class="kpi-s">ready to book</span>
		</div>
		<div class="kpi">
			<span class="kpi-l">Qualified</span>
			<span class="kpi-v">{stats.warmPlus}</span>
			<span class="kpi-s">of {stats.total} total</span>
		</div>
		<div class="kpi money">
			<span class="kpi-l">Potential pipeline</span>
			<span class="kpi-v">{stats.pipelineValue ? money(stats.pipelineValue) : '—'}</span>
			<span class="kpi-s">{stats.matched} tour-matched</span>
		</div>
		<div class="kpi win">
			<span class="kpi-l">Booked value</span>
			<span class="kpi-v">{stats.wonValue ? money(stats.wonValue) : '—'}</span>
			<span class="kpi-s">{stats.wonCount} won{stats.conversion != null ? ` · ${stats.conversion}% conversion` : ''}</span>
		</div>
	</div>

	<!-- Sales pipeline -->
	<div class="pipeline">
		{#each STAGE_ORDER as s}
			<button class="stage {STAGE_META[s].cls}" class:on={stageFilter === s} class:empty={!stageCounts[s]} on:click={() => toggleStage(s)} data-no-busy>
				<span class="st-n">{stageCounts[s] ?? 0}</span>
				<span class="st-l">{STAGE_META[s].label}</span>
			</button>
		{/each}
	</div>
	{#if !pipelineReady}
		<div class="pipe-hint">Stages <b>New → Qualified</b> update automatically. To mark <b>Contacted / Quoted / Won / Lost</b> yourself, run <code>db/011_leads_pipeline.sql</code> once in Supabase.</div>
	{/if}
	{#if form?.error}<div class="pipe-err">{form.error}</div>{/if}

	<!-- AI summary -->
	<div class="card ai-brief">
		<div class="brief-head">
			<span class="spark">✦</span>
			<h3>Today’s summary</h3>
		</div>
		<ul class="brief-list">
			<li>Your AI handled <b>{summary.convToday}</b> {summary.convToday === 1 ? 'conversation' : 'conversations'} today → <b>{summary.todayCount}</b> {summary.todayCount === 1 ? 'lead' : 'leads'} captured · <b>{summary.weekCount}</b> this week</li>
			{#if summary.qualifiedCount > 0 || summary.pipelineValue > 0}
				<li><b>{summary.qualifiedCount}</b> qualified{summary.pipelineValue > 0 ? ` · ${money(summary.pipelineValue)} potential value` : ''}</li>
			{/if}
			{#if summary.topMonth}
				<li><b>{summary.topMonth[1]}</b> {summary.topMonth[1] === 1 ? 'customer wants' : 'customers want'} to travel in <b>{summary.topMonth[0]}</b></li>
			{/if}
			{#if summary.topDestination}
				<li><b>{summary.topDestination[1]}</b> asking about <b>{summary.topDestination[0]}</b></li>
			{/if}
			{#if summary.highBudgetCount > 0}
				<li><b>{summary.highBudgetCount}</b> with a budget above {money(5000)}</li>
			{/if}
		</ul>
		{#if summary.priority}
			<div class="priority">
				<span class="pri-tag">Contact first</span>
				<div class="pri-body">
					<b>{summary.priority.name}</b>
					{#if summary.priority.tour}— interested in {summary.priority.tour}{/if}
					{#if summary.priority.month} · travelling {summary.priority.month}{/if}.
					<span class="pri-act">{summary.priority.action}.</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Insights strip -->
	{#if insights.topDestination || insights.topMonth || insights.hotCount}
		<div class="insights">
			{#if insights.topDestination}
				<div class="ins"><span>Most requested</span><b>{insights.topDestination}</b></div>
			{/if}
			{#if insights.topMonth}
				<div class="ins"><span>Peak travel month</span><b>{insights.topMonth}</b></div>
			{/if}
			<div class="ins"><span>Hot right now</span><b>{insights.hotCount} lead{insights.hotCount === 1 ? '' : 's'}</b></div>
		</div>
	{/if}

	<!-- Opportunities: demand the catalogue doesn't cover yet -->
	{#if gaps?.length}
		<div class="card gaps">
			<div class="brief-head"><span class="spark">💡</span><h3>Opportunities</h3></div>
			<ul class="gap-list">
				{#each gaps as g}
					<li>
						<b>{g.count}</b> {g.count === 1 ? 'customer' : 'customers'} asked about <b>{g.label}</b> — you don’t offer this yet.
						<a class="gap-add" href="/portal/knowledge">Add it</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Search + filters -->
	<div class="toolbar">
		<div class="search">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
			<input placeholder="Search name, phone, destination…" bind:value={q} />
		</div>
		<div class="chips">
			{#each FILTERS as f}
				<button class="chip" class:on={filter === f.id} on:click={() => (filter = f.id)} data-no-busy>{f.label}</button>
			{/each}
		</div>
	</div>

	<div class="count">{filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}</div>

	{#if filtered.length === 0}
		<div class="card none">No leads match “{q || FILTERS.find((f) => f.id === filter)?.label}”. Try a different filter.</div>
	{:else}
		<div class="lead-grid">
			{#each filtered as l (l.id)}
				<article class="lead" class:done={l.stage === 'won' || l.stage === 'lost'}>
					<header class="lead-top">
						<div class="who">
							<div class="avatar {l.tier.cls}">{initials(l.name)}</div>
							<div>
								<div class="name">{l.name || 'Unnamed enquiry'} <span class="stage-badge {STAGE_META[l.stage].cls}">{STAGE_META[l.stage].label}</span></div>
								<div class="captured">Captured {timeAgo(l.created_at)}</div>
							</div>
						</div>
						<div class="score {l.tier.cls}" title="Lead score">
							<b>{l.score}</b>
							<span>{l.tier.label}</span>
						</div>
					</header>

					{#if l.detail.destination || l.detail.month || l.detail.dates || l.detail.group || l.detail.children != null || l.detail.country || l.detail.accommodation || l.detail.budget || l.detail.estValue}
						<div class="facts">
							{#if l.detail.destination}<span class="fact">📍 {l.detail.destination}</span>{/if}
							{#if l.detail.dates || l.detail.month}<span class="fact">📅 {l.detail.dates || l.detail.month}</span>{/if}
							{#if l.detail.group}<span class="fact">👥 {l.detail.group} adult{l.detail.group === 1 ? '' : 's'}{#if l.detail.children}+{l.detail.children} kid{l.detail.children === 1 ? '' : 's'}{/if}</span>{/if}
							{#if l.detail.country}<span class="fact">🌍 {l.detail.country}</span>{/if}
							{#if l.detail.accommodation}<span class="fact">🏨 {l.detail.accommodation}</span>{/if}
							{#if l.detail.budget}<span class="fact">💰 {money(l.detail.budget)}</span>{/if}
							{#if l.detail.estValue}<span class="fact val">≈ {money(l.detail.estValue)} value</span>{/if}
						</div>
					{/if}

					{#if l.detail.firstMessage}
						<p class="quote">“{l.detail.firstMessage.length > 160 ? l.detail.firstMessage.slice(0, 160) + '…' : l.detail.firstMessage}”</p>
					{/if}

					<div class="next"><span class="bolt">⚡</span> Next: <b>{l.action}</b></div>

					<div class="actions">
						{#if l.whatsapp}
							<a class="btn wa" href={waLink(l, l.score >= 78 ? quoteMsg(l) : '')} target="_blank" rel="noopener">
								<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3-.8a10.5 10.5 0 0 1-4-3.6c-.3-.5-.9-1.4-.9-2.6 0-1.2.6-1.8.9-2 .2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c0 .2.1.3 0 .5l-.4.6-.3.3c-.1.2-.3.3-.1.6.2.4.9 1.4 1.9 2.2 1.2 1.1 2.2 1.4 2.5 1.5.3.2.5.1.7-.1l.9-1c.2-.3.4-.2.6-.1l1.8.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4Z"/></svg>
								{l.score >= 78 ? 'Send quote' : 'WhatsApp'}
							</a>
							<a class="btn ghost" href="tel:{l.whatsapp}" aria-label="Call">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
							</a>
						{/if}
						{#if l.email}
							<a class="btn ghost" href="mailto:{l.email}" aria-label="Email">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
							</a>
						{/if}
						<form method="POST" action="?/setStatus" use:enhance={() => stageSubmit(l.id)} class="stage-form">
							<input type="hidden" name="id" value={l.id} />
							<label class="stage-set">
								<span>Stage</span>
								<select
									name="status"
									value={OPERATOR_STAGES.includes(l.stage) ? l.stage : ''}
									disabled={savingId === l.id}
									on:change={(e) => {
										e.target.form.action = e.target.value ? '?/setStatus' : '?/clearStatus';
										e.target.form.requestSubmit();
									}}
								>
									<option value="">{OPERATOR_STAGES.includes(l.stage) ? 'Back to auto' : `${STAGE_META[l.stage].label} (auto)`}</option>
									{#each OPERATOR_STAGES as s}<option value={s}>{STAGE_META[s].label}</option>{/each}
								</select>
							</label>
						</form>
						<button class="btn link" on:click={() => (openId = openId === l.id ? null : l.id)} data-no-busy>
							{openId === l.id ? 'Hide details' : 'Details'}
						</button>
					</div>

					{#if openId === l.id}
						<div class="detail">
							<div class="qual">
								<h4>What the AI learned</h4>
								<dl>
									{#if l.detail.tour || l.detail.destination}<dt>Interested in</dt><dd>{l.detail.tour || l.detail.destination}</dd>{/if}
									{#if l.detail.country}<dt>Country</dt><dd>{l.detail.country}</dd>{/if}
									{#if l.detail.dates || l.detail.month}<dt>Travelling</dt><dd>{l.detail.dates || l.detail.month}</dd>{/if}
									{#if l.detail.group}<dt>Adults</dt><dd>{l.detail.group}</dd>{/if}
									{#if l.detail.children != null}<dt>Children</dt><dd>{l.detail.children}</dd>{/if}
									{#if l.detail.accommodation}<dt>Accommodation</dt><dd>{l.detail.accommodation}</dd>{/if}
									{#if budgetBand(l)}<dt>Budget</dt><dd>{budgetBand(l)} ({money(l.detail.budget)})</dd>{/if}
									<dt>Buying intent</dt><dd class="intent {l.tier.cls}">{INTENT[l.tier.cls]}</dd>
									<dt>Recommended</dt><dd>{l.action}</dd>
								</dl>
							</div>
							<div class="timeline">
								<h4>Journey</h4>
								<ol>
									<li class="done"><span>Started a chat with your AI</span></li>
									<li class="done"><span>AI qualified this lead — {l.score}/100</span></li>
									{#if l.detail.budget || l.detail.month || l.detail.group}
										<li class="done"><span>Shared trip details{l.detail.month ? ` · ${l.detail.month}` : ''}{l.detail.budget ? ` · ${money(l.detail.budget)}` : ''}</span></li>
									{/if}
									<li class="done"><span>Left contact details {timeAgo(l.created_at)}</span></li>
									{#if OPERATOR_STAGES.includes(l.stage)}
										<li class="done you"><span>You marked this {STAGE_META[l.stage].label.toLowerCase()}</span></li>
										{#if l.stage !== 'won' && l.stage !== 'lost'}<li class="todo"><span>{l.action}</span></li>{/if}
									{:else}
										<li class="todo"><span>{l.action}</span></li>
									{/if}
								</ol>
							</div>
							<div class="contacts">
								{#if l.whatsapp}<span class="c">📱 {l.whatsapp}</span>{/if}
								{#if l.email}<span class="c">✉️ {l.email}</span>{/if}
							</div>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
{/if}

<style>
	/* Sales pipeline */
	.pipeline {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		padding-bottom: 0.2rem;
		margin-bottom: 0.5rem;
	}
	.stage {
		flex: 1 0 auto;
		min-width: 72px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.05rem;
		padding: 0.5rem 0.55rem;
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: var(--panel-2);
		cursor: pointer;
		transition: border-color 0.12s, background 0.12s;
	}
	.stage .st-n {
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--strong);
		line-height: 1.1;
	}
	.stage .st-l {
		font-size: 0.66rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.stage.empty {
		opacity: 0.5;
	}
	.stage.on {
		border-color: var(--mint);
		background: rgba(var(--gold-rgb), 0.1);
	}
	.stage.st-won .st-n {
		color: #1f9d55;
	}
	.stage.st-lost .st-n {
		color: var(--warn);
	}
	.stage-badge {
		display: inline-block;
		font-size: 0.58rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		vertical-align: middle;
		background: var(--edge);
		color: var(--muted);
	}
	.stage-badge.st-qualified {
		background: rgba(var(--gold-rgb), 0.16);
		color: var(--mint);
	}
	.stage-badge.st-contacted {
		background: rgba(74, 123, 208, 0.16);
		color: #4a7bd0;
	}
	.stage-badge.st-quoted {
		background: rgba(138, 99, 208, 0.16);
		color: #8a63d0;
	}
	.stage-badge.st-won {
		background: rgba(31, 157, 85, 0.16);
		color: #1f9d55;
	}
	.stage-badge.st-lost {
		background: rgba(200, 70, 70, 0.14);
		color: var(--warn);
	}
	.pipe-hint {
		font-size: 0.78rem;
		color: var(--faint);
		margin: -0.1rem 0 0.7rem;
	}
	.pipe-hint code {
		background: var(--panel-2);
		padding: 0.05rem 0.3rem;
		border-radius: 5px;
	}
	.pipe-err {
		font-size: 0.82rem;
		color: var(--warn);
		margin: -0.1rem 0 0.7rem;
	}
	.stage-form {
		display: inline-flex;
	}
	.stage-set {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--muted);
	}
	.stage-set select {
		font-size: 0.8rem;
		padding: 0.25rem 0.4rem;
		border-radius: 8px;
		border: 1px solid var(--edge);
		background: var(--panel);
		color: var(--strong);
	}
	.kpi.win .kpi-v {
		color: #1f9d55;
	}
	.gaps {
		margin-bottom: 1rem;
	}
	.gap-list {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		font-size: 0.9rem;
		color: var(--body);
	}
	.gap-list li {
		line-height: 1.45;
	}
	.gap-list b {
		color: var(--strong);
	}
	.gap-add {
		color: var(--mint);
		font-weight: 600;
		margin-left: 0.3rem;
		white-space: nowrap;
	}

	/* KPIs */
	.kpis {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 12px;
		margin-bottom: 16px;
	}
	.kpi {
		background: var(--panel);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.kpi-l {
		font-size: 0.72rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.kpi-v {
		font-size: 1.7rem;
		font-weight: 700;
		color: var(--strong);
		line-height: 1.1;
	}
	.kpi-s {
		font-size: 0.72rem;
		color: var(--faint);
	}
	.kpi.hot .kpi-v {
		color: var(--mint);
	}
	.kpi.money .kpi-v {
		color: var(--strong);
		font-size: 1.4rem;
	}

	/* AI brief */
	.ai-brief {
		border: 1px solid var(--edge);
		background: linear-gradient(180deg, rgba(var(--gold-rgb), 0.06), transparent 60%), var(--panel);
		margin-bottom: 14px;
	}
	.brief-head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}
	.brief-head h3 {
		margin: 0;
		font-size: 1rem;
	}
	.spark {
		color: var(--mint);
		font-size: 1.05rem;
	}
	.brief-list {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.brief-list li {
		color: var(--soft);
		font-size: 0.9rem;
	}
	.brief-list b {
		color: var(--strong);
	}
	.priority {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		margin-top: 12px;
		padding: 12px;
		border-radius: 12px;
		background: rgba(var(--gold-rgb), 0.08);
		border: 1px solid rgba(var(--gold-rgb), 0.22);
	}
	.pri-tag {
		flex: none;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--ink-text);
		background: var(--mint);
		padding: 4px 8px;
		border-radius: 6px;
	}
	.pri-body {
		font-size: 0.9rem;
		color: var(--soft);
	}
	.pri-body b {
		color: var(--strong);
	}
	.pri-act {
		color: var(--mint);
		font-weight: 600;
	}

	/* Insights */
	.insights {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: 14px;
	}
	.ins {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 8px 14px;
		border-radius: 10px;
		background: var(--panel-2);
		border: 1px solid var(--edge);
	}
	.ins span {
		font-size: 0.68rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.ins b {
		color: var(--body);
		font-size: 0.92rem;
	}

	/* Toolbar */
	.toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 10px;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 220px;
		background: var(--panel);
		border: 1px solid var(--edge);
		border-radius: 10px;
		padding: 0 12px;
	}
	.search svg {
		width: 16px;
		height: 16px;
		color: var(--muted);
		flex: none;
	}
	.search input {
		flex: 1;
		background: none;
		border: none;
		color: var(--body);
		padding: 10px 0;
		font-size: 0.9rem;
		outline: none;
	}
	.chips {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.chip {
		background: var(--panel-2);
		border: 1px solid var(--edge);
		color: var(--soft);
		border-radius: 999px;
		padding: 7px 13px;
		font-size: 0.82rem;
		cursor: pointer;
		transition: all 0.14s;
	}
	.chip:hover {
		border-color: var(--muted);
	}
	.chip.on {
		background: var(--mint);
		border-color: var(--mint);
		color: var(--ink-text);
		font-weight: 600;
	}
	.count {
		font-size: 0.78rem;
		color: var(--muted);
		margin-bottom: 12px;
	}
	.none {
		color: var(--muted);
		text-align: center;
		padding: 28px;
	}

	/* Lead cards */
	.lead-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 14px;
	}
	.lead {
		background: var(--panel);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 11px;
		transition: border-color 0.16s, transform 0.12s;
	}
	.lead:hover {
		border-color: var(--muted);
	}
	.lead.done {
		opacity: 0.72;
	}
	.lead-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 10px;
	}
	.who {
		display: flex;
		gap: 11px;
		align-items: center;
		min-width: 0;
	}
	.avatar {
		flex: none;
		width: 42px;
		height: 42px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		font-weight: 700;
		font-size: 0.9rem;
		color: var(--strong);
		background: var(--panel-2);
		border: 1px solid var(--edge);
	}
	.avatar.hot {
		background: rgba(var(--gold-rgb), 0.16);
		border-color: rgba(var(--gold-rgb), 0.4);
		color: var(--mint);
	}
	.avatar.warm {
		background: rgba(var(--accent-rgb), 0.16);
		border-color: rgba(var(--accent-rgb), 0.4);
		color: #93b4ff;
	}
	.avatar.cool {
		background: rgba(255, 181, 71, 0.15);
		border-color: rgba(255, 181, 71, 0.36);
		color: var(--warn);
	}
	.name {
		font-weight: 650;
		color: var(--strong);
		display: flex;
		align-items: center;
		gap: 7px;
		flex-wrap: wrap;
	}
	.badge-done {
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--mint);
		border: 1px solid rgba(var(--gold-rgb), 0.4);
		border-radius: 5px;
		padding: 1px 5px;
	}
	.captured {
		font-size: 0.75rem;
		color: var(--faint);
	}
	.score {
		flex: none;
		text-align: center;
		border-radius: 10px;
		padding: 5px 10px;
		min-width: 58px;
		border: 1px solid var(--edge);
		background: var(--panel-2);
	}
	.score b {
		display: block;
		font-size: 1.15rem;
		line-height: 1;
		color: var(--strong);
	}
	.score span {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--muted);
	}
	.score.hot {
		background: rgba(var(--gold-rgb), 0.14);
		border-color: rgba(var(--gold-rgb), 0.4);
	}
	.score.hot b {
		color: var(--mint);
	}
	.score.warm {
		background: rgba(var(--accent-rgb), 0.14);
		border-color: rgba(var(--accent-rgb), 0.4);
	}
	.score.warm b {
		color: #93b4ff;
	}
	.score.cool {
		background: rgba(255, 181, 71, 0.13);
		border-color: rgba(255, 181, 71, 0.36);
	}
	.score.cool b {
		color: var(--warn);
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.fact {
		font-size: 0.76rem;
		color: var(--soft);
		background: var(--panel-2);
		border: 1px solid var(--edge);
		border-radius: 7px;
		padding: 3px 8px;
	}
	.fact.val {
		color: var(--mint);
		border-color: rgba(var(--gold-rgb), 0.3);
	}
	.quote {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
		font-style: italic;
		line-height: 1.45;
		border-left: 2px solid var(--edge);
		padding-left: 10px;
	}
	.next {
		font-size: 0.83rem;
		color: var(--soft);
	}
	.next b {
		color: var(--strong);
	}
	.bolt {
		color: var(--warn);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
		margin-top: auto;
		padding-top: 4px;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border-radius: 9px;
		padding: 8px 12px;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid var(--edge);
		background: var(--panel-2);
		color: var(--body);
		text-decoration: none;
		transition: all 0.14s;
	}
	.btn svg {
		width: 15px;
		height: 15px;
	}
	.btn.wa {
		background: #25d366;
		border-color: #25d366;
		color: #04220f;
	}
	.btn.wa:hover {
		filter: brightness(1.06);
	}
	.btn.ghost:hover {
		border-color: var(--muted);
	}
	.btn.ghost.on {
		border-color: rgba(var(--gold-rgb), 0.4);
		color: var(--mint);
	}
	.btn.link {
		background: none;
		border-color: transparent;
		color: var(--muted);
		margin-left: auto;
		padding: 8px 6px;
	}
	.btn.link:hover {
		color: var(--body);
	}

	/* Detail / timeline */
	.detail {
		border-top: 1px solid var(--edge);
		padding-top: 12px;
		margin-top: 2px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	.detail h4 {
		margin: 0 0 8px;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
	}
	.qual dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 10px;
	}
	.qual dt {
		font-size: 0.78rem;
		color: var(--muted);
	}
	.qual dd {
		margin: 0;
		font-size: 0.78rem;
		color: var(--body);
		text-align: right;
	}
	.intent.hot {
		color: var(--mint);
		font-weight: 600;
	}
	.intent.warm {
		color: #93b4ff;
		font-weight: 600;
	}
	.timeline ol {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}
	.timeline li {
		position: relative;
		padding: 0 0 12px 18px;
		font-size: 0.78rem;
		color: var(--soft);
	}
	.timeline li::before {
		content: '';
		position: absolute;
		left: 3px;
		top: 4px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--mint);
	}
	.timeline li::after {
		content: '';
		position: absolute;
		left: 6.5px;
		top: 12px;
		bottom: 0;
		width: 1px;
		background: var(--edge);
	}
	.timeline li:last-child::after {
		display: none;
	}
	.timeline li.todo {
		color: var(--warn);
	}
	.timeline li.todo::before {
		background: transparent;
		border: 1.5px solid var(--warn);
	}
	.contacts {
		grid-column: 1 / -1;
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
		font-size: 0.78rem;
		color: var(--muted);
	}

	/* Empty state */
	.empty-cta {
		text-align: center;
		max-width: 520px;
		margin: 20px auto;
	}
	.empty-ic {
		width: 56px;
		height: 56px;
		margin: 0 auto 14px;
		border-radius: 16px;
		display: grid;
		place-items: center;
		background: rgba(var(--gold-rgb), 0.12);
		color: var(--mint);
	}
	.empty-ic svg {
		width: 26px;
		height: 26px;
	}
	.empty-cta h2 {
		margin: 0 0 6px;
	}
	.empty-cta p {
		color: var(--muted);
		margin: 0 0 18px;
	}

	@media (max-width: 900px) {
		.kpis {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 640px) {
		.lead-grid {
			grid-template-columns: 1fr;
		}
		.detail {
			grid-template-columns: 1fr;
		}
		.kpis {
			grid-template-columns: 1fr 1fr;
		}
		.toolbar {
			position: sticky;
			top: 0;
			z-index: 5;
			background: var(--ink);
			padding: 8px 0;
		}
	}
</style>
