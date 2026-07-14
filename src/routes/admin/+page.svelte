<script>
	import { readableInk } from '$lib/luminance.js';
	export let data;
	const initials = (name) =>
		(name ?? '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	const statusBadge = (s) =>
		s === 'active' ? '' : s === 'past_due' ? 'off' : s === 'canceled' ? 'off' : 'neutral';
	$: t = data.totals;
</script>

<div class="page-head">
	<div>
		<h1>Dashboard</h1>
		<div class="sub">Every business is a tenant scoped by <code>client_id</code>. Here's how the fleet is doing.</div>
	</div>
	<div class="actions">
		<a class="btn" href="/admin/clients/new">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
			Add client
		</a>
	</div>
</div>

{#if data.loadError}<div class="notice err">Could not load data: {data.loadError}</div>{/if}

{#if t}
	<div class="stat-grid">
		<div class="tile"><div class="k">Clients</div><div class="v">{t.clients}</div><div class="foot">{t.active} active</div></div>
		<div class="tile"><div class="k">Conversations</div><div class="v">{t.conversationsMonth}</div><div class="foot">{t.conversations} all-time · ~${(t.aiCostMonth ?? 0).toFixed(2)} AI cost</div></div>
		<div class="tile"><div class="k">Leads captured</div><div class="v">{t.leads}</div><div class="foot">{t.leadsMonth} this month</div></div>
		<div class="tile"><div class="k">Knowledge items</div><div class="v">{t.items}</div><div class="foot">across all catalogues</div></div>
	</div>
{/if}

<h2 class="section">Clients</h2>

{#if data.clients.length === 0}
	<div class="card empty">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
		<h3>No clients yet</h3>
		<p>Onboard your first business to start answering its customers.</p>
		<a class="btn" href="/admin/clients/new">Add your first client</a>
	</div>
{:else}
	<div class="cards">
		{#each data.clients as c}
			<a class="client-card" href={`/admin/clients/${c.slug}`}>
				<div class="top">
					<div class="avatar" style={`background:${c.brand_color ?? '#37e0a6'};color:${readableInk(c.brand_color ?? '#37e0a6')}`}>{initials(c.name)}</div>
					<div style="min-width:0">
						<div class="name">{c.name}</div>
						<div class="meta">{c.slug}{c.business_type ? ` · ${c.business_type}` : ''} · {c.plan}</div>
					</div>
					<div style="margin-left:auto;text-align:right;display:flex;flex-direction:column;gap:.25rem;align-items:flex-end">
						<span class="badge dot {c.is_active ? '' : 'off'}">{c.is_active ? 'active' : 'paused'}</span>
						<span class="badge {statusBadge(c.subscription_status)}">{c.subscription_status}</span>
					</div>
				</div>
				<div class="mini">
					<div><b>{c.conversationsMonth}</b>conversations / mo</div>
					<div><b>{c.leads}</b>leads</div>
					<div><b>{c.items}</b>knowledge items</div>
				</div>
			</a>
		{/each}
	</div>
{/if}
