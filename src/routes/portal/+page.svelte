<script>
	import { onMount } from 'svelte';
	import ShareCard from '$lib/components/ShareCard.svelte';
	import OnboardingChecklist from '$lib/components/OnboardingChecklist.svelte';
	export let data;
	$: client = data.client;
	$: stats = data.stats;
	$: dash = data.dash;

	$: firstName = (data.user?.name || client.name || '').trim().split(/\s+/)[0] || 'there';
	function greetingWord() {
		const h = new Date().getHours();
		return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
	}

	// Live-ish relative time (refreshes each minute).
	let now = Date.now();
	onMount(() => {
		const i = setInterval(() => (now = Date.now()), 60000);
		return () => clearInterval(i);
	});
	function ago(iso) {
		if (!iso) return null;
		const s = Math.round((now - new Date(iso).getTime()) / 1000);
		if (s < 45) return 'just now';
		const m = Math.round(s / 60);
		if (m < 60) return `${m} min ago`;
		const h = Math.round(m / 60);
		if (h < 24) return `${h}h ago`;
		const d = Math.round(h / 24);
		if (d < 7) return `${d}d ago`;
		return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
	}
	const money = (n, cur) => `${cur === 'USD' ? '$' : cur + ' '}${Number(n).toLocaleString()}`;

	$: conversionRate = stats.conversations ? Math.round((stats.leads / stats.conversations) * 100) : 0;
	$: highIntent = dash.pipeline.tiers.hot + dash.pipeline.tiers.warm;
	$: cap = client.monthly_conversation_cap ?? 0;
	$: usagePct = cap > 0 ? Math.min(100, Math.round((stats.conversationsMonth / cap) * 100)) : 0;
	$: health = !client.is_active
		? { label: 'Paused', cls: 'off', dot: 'off' }
		: stats.items === 0
			? { label: 'Needs setup', cls: 'warn', dot: 'warn' }
			: { label: 'Healthy', cls: 'ok', dot: 'on' };

	const replyLink = (l) => (l.whatsapp ? 'https://wa.me/' + String(l.whatsapp).replace(/[^0-9]/g, '') : l.email ? 'mailto:' + l.email : null);

	// Milestone celebration (dismissible, client-side only).
	$: celebration =
		stats.conversations >= 100
			? { key: 'c100', text: '100 conversations answered!', sub: 'Your AI is a booking machine.' }
			: stats.leads >= 10
				? { key: 'l10', text: '10 leads captured!', sub: 'Momentum is building.' }
				: stats.leads >= 1
					? { key: 'l1', text: 'You captured your first lead!', sub: 'Your AI is turning visitors into enquiries.' }
					: null;
	let dismissed = new Set();
	onMount(() => {
		try {
			dismissed = new Set(JSON.parse(localStorage.getItem('mk_celebrated') || '[]'));
		} catch (e) {}
	});
	$: showCelebration = celebration && !dismissed.has(celebration.key);
	function dismissCelebration() {
		if (!celebration) return;
		dismissed = new Set([...dismissed, celebration.key]);
		try {
			localStorage.setItem('mk_celebrated', JSON.stringify([...dismissed]));
		} catch (e) {}
	}

	// Website embed (kept, secondary).
	const embedSnippet = () => `<script src="https://app.makutano.digital/widget.js" data-client="${client.slug}"><\/script>`;
	let showEmbed = false;
	let copied = false;
	async function copyEmbed() {
		try {
			await navigator.clipboard.writeText(embedSnippet());
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch (e) {}
	}
</script>

<!-- Greeting + today's summary -->
<div class="greet">
	<h1>{greetingWord()}, {firstName} <span class="wave">👋</span></h1>
	<p class="greet-sub">Your AI assistant has been working while you were away.</p>
	<div class="today">
		<span><b>{dash.convToday}</b> conversations today</span>
		<span class="dot-sep">·</span>
		<span><b>{dash.leadsToday}</b> new {dash.leadsToday === 1 ? 'lead' : 'leads'}</span>
		{#if dash.lastConversationAt}
			<span class="dot-sep">·</span>
			<span>last customer {ago(dash.lastConversationAt)}</span>
		{/if}
	</div>
</div>

{#if showCelebration}
	<div class="celebrate">
		<span class="celebrate-emoji">🎉</span>
		<div><b>{celebration.text}</b> <span class="muted">{celebration.sub}</span></div>
		<button class="celebrate-x" on:click={dismissCelebration} aria-label="Dismiss">
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
		</button>
	</div>
{/if}

<!-- 1. AI status -->
<div class="card ai-status">
	<div class="ai-status-head">
		<span class="ai-live"><span class="live-dot {health.dot}"></span>{client.is_active ? 'AI Assistant is Live' : 'AI Assistant is Paused'}</span>
		<span class="badge {health.cls === 'ok' ? '' : health.cls === 'off' ? 'off' : 'neutral'}">{health.label}</span>
	</div>
	<p class="muted" style="margin:.35rem 0 1rem">
		{client.is_active
			? 'Answering customer questions, recommending tours, qualifying leads, and collecting enquiries 24/7 — even while you sleep.'
			: 'Your assistant is paused and not answering visitors. Reactivate it in Settings.'}
	</p>
	<div class="status-grid">
		<div><span class="k">Last conversation</span><span class="v">{ago(dash.lastConversationAt) ?? 'none yet'}</span></div>
		<div><span class="k">Last lead</span><span class="v">{ago(dash.lastLeadAt) ?? 'none yet'}</span></div>
		<div><span class="k">Knowledge updated</span><span class="v">{ago(dash.knowledgeUpdatedAt) ?? '—'}</span></div>
		<div><span class="k">Assistant</span><span class="v">{stats.items} {stats.items === 1 ? 'item' : 'items'} ready</span></div>
	</div>
</div>

<!-- 2. Business KPIs -->
<div class="kpi-grid">
	<div class="card kpi">
		<div class="k">Conversations today</div>
		<div class="v">{dash.convToday}</div>
		<div class="foot">{stats.conversations.toLocaleString()} all-time</div>
	</div>
	<div class="card kpi">
		<div class="k">Qualified leads</div>
		<div class="v">{stats.leads}</div>
		<div class="foot">{dash.leadsToday} captured today</div>
	</div>
	<div class="card kpi">
		<div class="k">Conversion rate</div>
		<div class="v">{conversionRate}<span class="unit">%</span></div>
		<div class="foot">chats that became leads</div>
	</div>
	<div class="card kpi">
		{#if dash.pipeline.value > 0}
			<div class="k">Est. pipeline value</div>
			<div class="v" style="font-size:1.5rem">~{money(dash.pipeline.value, dash.pipeline.currency)}</div>
			<div class="foot">from {dash.pipeline.matched} tour-matched {dash.pipeline.matched === 1 ? 'lead' : 'leads'}</div>
		{:else}
			<div class="k">High-intent leads</div>
			<div class="v">{highIntent}</div>
			<div class="foot">ready-to-book + high interest</div>
		{/if}
	</div>
</div>

<!-- 3 & 4. AI insights + tasks -->
<div class="two-col">
	<div class="card">
		<h2 class="section" style="margin:0 0 .2rem">AI insights</h2>
		<p class="muted" style="font-size:.85rem;margin:0 0 .9rem">What your customers keep asking about.</p>
		{#if dash.interests.length}
			<div class="insight-list">
				{#each dash.interests as it}
					<div class="insight-row">
						<span class="insight-term">{it.term}</span>
						<span class="insight-bar"><span style={`width:${Math.min(100, (it.count / dash.interests[0].count) * 100)}%`}></span></span>
						<span class="insight-count mono">{it.count}</span>
					</div>
				{/each}
			</div>
			<div class="insight-tip">
				<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></svg>
				<span>Most interest is in <b>{dash.interests[0].term}</b> — make sure that tour is easy to find and well-described in your knowledge.</span>
			</div>
		{:else}
			<p class="muted" style="font-size:.9rem">Not enough conversations yet to spot trends. As customers chat, the topics they care about most will show up here.</p>
		{/if}
	</div>

	<div class="card">
		<h2 class="section" style="margin:0 0 .2rem">Needs your attention</h2>
		<p class="muted" style="font-size:.85rem;margin:0 0 .9rem">Things your AI wants you to review.</p>
		{#if dash.tasks.length}
			<div class="task-list">
				{#each dash.tasks as t}
					<div class="task {t.level}">
						<span class="task-dot"></span>
						<span class="task-text">{t.text}</span>
						<a class="btn ghost sm" href={t.href}>{t.cta}</a>
					</div>
				{/each}
			</div>
		{:else}
			<div class="all-clear">
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
				<span>Nothing needs your attention — your AI is running smoothly.</span>
			</div>
		{/if}
	</div>
</div>

<!-- Setup progress (auto-collapses when complete) -->
<OnboardingChecklist {client} stats={data.stats} />

<!-- Share -->
<ShareCard slug={client.slug} name={client.name} />

<!-- Recent leads (cards) + activity -->
<div class="two-col">
	<div class="card">
		<div class="rowflex" style="justify-content:space-between;margin-bottom:.7rem"><h2 class="section" style="margin:0">Recent leads</h2><a class="btn ghost sm" href="/portal/leads">View all</a></div>
		{#if data.leads.length === 0}
			<div class="empty-inline">
				<p class="muted">No leads yet. Share your AI page and enquiries will land here — each one scored by how ready they are to book.</p>
				<a class="btn sm" href="#share" on:click|preventDefault={() => document.querySelector('.share-card')?.scrollIntoView({ behavior: 'smooth' })}>Share your page</a>
			</div>
		{:else}
			<div class="lead-cards">
				{#each data.leads.slice(0, 4) as l}
					<div class="lead-card">
						<div class="lead-top">
							<span class="lead-name">{l.name || 'Anonymous visitor'}</span>
							<span class="tier {l.tier.cls}">{l.tier.label}</span>
						</div>
						{#if l.interest}<div class="lead-interest">{l.interest}</div>{/if}
						<div class="lead-foot">
							<span class="faint mono">{ago(l.created_at)}</span>
							<div class="lead-actions">
								{#if replyLink(l)}<a class="btn ghost sm" href={replyLink(l)} target="_blank" rel="noopener">Reply</a>{/if}
								<a class="btn ghost sm" href="/portal/leads">View</a>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="card">
		<h2 class="section" style="margin:0 0 .7rem">AI activity</h2>
		{#if dash.activity.length}
			<ul class="feed">
				{#each dash.activity as e}
					<li class="feed-item {e.type}">
						<span class="feed-dot"></span>
						<div class="feed-body">
							<span class="feed-title">{e.title}</span>
							{#if e.detail}<span class="feed-detail">{e.detail}</span>{/if}
							<span class="feed-time faint mono">{ago(e.at)}</span>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted" style="font-size:.9rem">No activity yet. <a href="/c/{client.slug}" target="_blank" rel="noopener">Test your AI</a> to see it come alive here.</p>
		{/if}
	</div>
</div>

<!-- Recent conversations -->
<div class="card">
	<div class="rowflex" style="justify-content:space-between;margin-bottom:.5rem"><h2 class="section" style="margin:0">Recent conversations</h2><a class="btn ghost sm" href="/portal/conversations">View all</a></div>
	{#if data.conversations.length === 0}
		<p class="muted">No conversations yet — <a href="/c/{client.slug}" target="_blank" rel="noopener">try asking your AI something</a>.</p>
	{:else}
		{#each data.conversations.slice(0, 5) as conv}
			<a class="convo-row" href="/portal/conversations">
				<span class="convo-q">{(Array.isArray(conv.messages) ? conv.messages.find((x) => x.role === 'user')?.content : '') || '(no message)'}</span>
				<span class="faint mono">{ago(conv.created_at)}</span>
			</a>
		{/each}
	{/if}
</div>

<!-- Website (optional, secondary) -->
<div class="card">
	<div class="rowflex" style="justify-content:space-between;gap:.5rem;flex-wrap:wrap">
		<div>
			<h2 class="section" style="margin:0">Want a chat button on your website?</h2>
			<p class="muted" style="margin:.3rem 0 0;font-size:.9rem">Optional — your shareable link already works everywhere. Setup takes about two minutes.</p>
		</div>
		<div style="display:flex;gap:.5rem;flex-wrap:wrap">
			<a class="btn sm" href="/portal/install">Setup guide</a>
			<button class="ghost sm" on:click={() => (showEmbed = !showEmbed)} aria-expanded={showEmbed}>{showEmbed ? 'Hide' : 'Show code'}</button>
		</div>
	</div>
	{#if showEmbed}
		<pre class="code-block" style="margin-top:.9rem">{embedSnippet()}</pre>
		<button class="ghost sm" on:click={copyEmbed}>{copied ? 'Copied!' : 'Copy code'}</button>
	{/if}
</div>

<style>
	.greet {
		margin-bottom: 1.1rem;
	}
	.greet h1 {
		font-size: 1.6rem;
		margin: 0;
		letter-spacing: -0.02em;
		color: var(--strong);
	}
	.wave {
		display: inline-block;
		animation: wave 1.6s ease-in-out 1;
		transform-origin: 70% 70%;
	}
	@keyframes wave {
		0%, 100% { transform: rotate(0); }
		25% { transform: rotate(16deg); }
		50% { transform: rotate(-8deg); }
		75% { transform: rotate(12deg); }
	}
	.greet-sub {
		color: var(--muted);
		margin: 0.25rem 0 0.5rem;
	}
	.today {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--soft);
	}
	.today b {
		color: var(--strong);
	}
	.dot-sep {
		color: var(--faint);
	}

	.celebrate {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		border-radius: 14px;
		background: linear-gradient(90deg, rgba(55, 224, 166, 0.16), rgba(91, 140, 255, 0.08));
		border: 1px solid rgba(55, 224, 166, 0.3);
	}
	.celebrate-emoji {
		font-size: 1.35rem;
	}
	.celebrate-x {
		margin-left: auto;
		background: transparent;
		border: 0;
		color: var(--muted);
		padding: 0.2rem;
		border-radius: 7px;
	}
	.celebrate-x:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--strong);
	}

	.ai-status-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.ai-live {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--strong);
	}
	.live-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--mint);
		box-shadow: 0 0 10px var(--mint);
		animation: pulse 2s ease-in-out infinite;
	}
	.live-dot.warn {
		background: var(--warn);
		box-shadow: 0 0 10px var(--warn);
	}
	.live-dot.off {
		background: var(--danger);
		box-shadow: none;
		animation: none;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}
	.status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.9rem;
	}
	.status-grid > div {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.status-grid .k {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
		font-weight: 600;
	}
	.status-grid .v {
		font-size: 0.98rem;
		font-weight: 600;
		color: var(--strong);
	}

	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.85rem;
		margin: 0.85rem 0;
	}
	.kpi .k {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
		font-weight: 600;
	}
	.kpi .v {
		font-size: 2rem;
		font-weight: 800;
		color: var(--strong);
		letter-spacing: -0.02em;
		margin: 0.2rem 0 0.1rem;
	}
	.kpi .v .unit {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--faint);
	}
	.kpi .foot {
		font-size: 0.78rem;
		color: var(--faint);
	}

	.two-col {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.85rem;
		margin-bottom: 0.85rem;
	}
	@media (max-width: 820px) {
		.two-col {
			grid-template-columns: 1fr;
		}
	}

	.insight-list {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.insight-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.insight-term {
		width: 110px;
		flex-shrink: 0;
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--body);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.insight-bar {
		flex: 1;
		height: 7px;
		border-radius: 99px;
		background: var(--panel-2);
		overflow: hidden;
	}
	.insight-bar > span {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: linear-gradient(90deg, var(--mint), var(--accent));
	}
	.insight-count {
		font-size: 0.8rem;
		color: var(--muted);
		width: 22px;
		text-align: right;
	}
	.insight-tip {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
		padding: 0.7rem 0.85rem;
		border-radius: 11px;
		background: rgba(55, 224, 166, 0.08);
		border: 1px solid rgba(55, 224, 166, 0.2);
		font-size: 0.86rem;
		color: var(--soft);
		line-height: 1.4;
	}
	.insight-tip svg {
		flex-shrink: 0;
		color: var(--mint);
		margin-top: 1px;
	}

	.task-list {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.task {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.65rem 0.8rem;
		border-radius: 11px;
		background: var(--panel-2);
		border: 1px solid var(--edge);
	}
	.task-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--accent);
	}
	.task.warn .task-dot {
		background: var(--warn);
	}
	.task.danger .task-dot {
		background: var(--danger);
	}
	.task-text {
		flex: 1;
		font-size: 0.86rem;
		color: var(--body);
		line-height: 1.35;
	}
	.task .btn {
		flex-shrink: 0;
	}
	.all-clear {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--soft);
		font-size: 0.9rem;
	}
	.all-clear svg {
		color: var(--mint);
		flex-shrink: 0;
	}

	.lead-cards {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.lead-card {
		padding: 0.75rem 0.85rem;
		border-radius: 12px;
		background: var(--panel-2);
		border: 1px solid var(--edge);
	}
	.lead-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.lead-name {
		font-weight: 600;
		color: var(--strong);
		font-size: 0.92rem;
	}
	.tier {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.12rem 0.5rem;
		border-radius: 99px;
		white-space: nowrap;
	}
	.tier.hot {
		background: rgba(55, 224, 166, 0.16);
		color: var(--mint);
		border: 1px solid rgba(55, 224, 166, 0.3);
	}
	.tier.warm {
		background: rgba(91, 140, 255, 0.16);
		color: #8fb0ff;
		border: 1px solid rgba(91, 140, 255, 0.3);
	}
	.tier.cool {
		background: rgba(255, 181, 71, 0.14);
		color: var(--warn);
		border: 1px solid rgba(255, 181, 71, 0.28);
	}
	.tier.cold {
		background: rgba(255, 255, 255, 0.05);
		color: var(--muted);
		border: 1px solid var(--edge);
	}
	.lead-interest {
		font-size: 0.85rem;
		color: var(--soft);
		margin: 0.4rem 0;
		line-height: 1.35;
	}
	.lead-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.4rem;
	}
	.lead-actions {
		display: flex;
		gap: 0.4rem;
	}
	.empty-inline {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.7rem;
	}

	.feed {
		list-style: none;
		margin: 0;
		padding: 0;
		position: relative;
	}
	.feed-item {
		display: flex;
		gap: 0.7rem;
		padding: 0 0 0.85rem;
		position: relative;
	}
	.feed-item:not(:last-child) .feed-dot::after {
		content: '';
		position: absolute;
		top: 12px;
		left: 3.5px;
		bottom: -6px;
		width: 1px;
		background: var(--line-2);
	}
	.feed-dot {
		position: relative;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-top: 4px;
		flex-shrink: 0;
		background: var(--muted);
	}
	.feed-item.lead .feed-dot {
		background: var(--mint);
	}
	.feed-item.summary .feed-dot {
		background: var(--accent);
	}
	.feed-body {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}
	.feed-title {
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--body);
	}
	.feed-detail {
		font-size: 0.8rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
	.feed-time {
		font-size: 0.72rem;
	}

	.convo-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0.2rem;
		border-bottom: 1px solid var(--line-2);
		text-decoration: none;
		color: inherit;
	}
	.convo-row:last-child {
		border-bottom: 0;
	}
	.convo-row:hover {
		background: rgba(255, 255, 255, 0.02);
	}
	.convo-q {
		font-size: 0.88rem;
		color: var(--body);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.convo-row .mono {
		flex-shrink: 0;
		font-size: 0.76rem;
	}
</style>
