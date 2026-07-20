<script>
	import { page } from '$app/stores';
	import AppShell from '$lib/components/AppShell.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import { readableInk } from '$lib/luminance.js';
	export let data;
	let palette;

	$: routeId = $page.route?.id ?? '';
	$: client = data.client;
	$: modules = data.enabledModules ?? [];
	$: hasModule = (k) => modules.includes(k);
	// Take routeId as an arg so the template expression depends on it directly —
	// otherwise the class binding never re-evaluates on client-side navigation.
	const active = (rid, base, exact = false) => (exact ? rid === base : rid?.startsWith(base));
	const initials = (n) => (n ?? '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	$: userInitials = (data.user?.name ?? data.user?.email ?? 'O').trim().charAt(0).toUpperCase();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<AppShell user={data.user} initials={userInitials}>
	<a class="side-brand" href="/portal" slot="brand">
		<span class="mark" style={`background:${client.brand_color ?? '#e0b24c'};border-color:transparent;color:${readableInk(client.brand_color ?? '#e0b24c')}`}>{initials(client.name)}</span>
		<span><b>{client.name}</b><span class="sub">Operator portal</span></span>
	</a>

	<svelte:fragment slot="nav">
		<div class="nav-group">
			<p class="nav-heading">Manage</p>
			<a href="/portal" class="nav-item" title="Overview" aria-label="Overview" class:active={active(routeId, '/portal', true)}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg></span>
				<span class="nav-label">Overview</span>
			</a>
			{#if hasModule('orders')}
				<a href="/portal/inbox" class="nav-item" title="Inbox" aria-label="Inbox" class:active={active(routeId, '/portal/inbox')}>
					<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></span>
					<span class="nav-label">Inbox</span>
				</a>
			{/if}
			<a href="/portal/knowledge" class="nav-item" title="Knowledge" aria-label="Knowledge" class:active={active(routeId, '/portal/knowledge')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
				<span class="nav-label">Knowledge</span>
			</a>
			<a href="/portal/leads" class="nav-item" title="Leads" aria-label="Leads" class:active={active(routeId, '/portal/leads')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>
				<span class="nav-label">Leads</span>
			</a>
			<a href="/portal/customers" class="nav-item" title="Customers" aria-label="Customers" class:active={active(routeId, '/portal/customers')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
				<span class="nav-label">Customers</span>
			</a>
			<a href="/portal/proposals" class="nav-item" title="Proposals" aria-label="Proposals" class:active={active(routeId, '/portal/proposals')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg></span>
				<span class="nav-label">Proposals</span>
			</a>
			{#if hasModule('orders')}
				<a href="/portal/orders" class="nav-item" title="Orders" aria-label="Orders" class:active={active(routeId, '/portal/orders')}>
					<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></span>
					<span class="nav-label">Orders</span>
				</a>
			{/if}
			{#if hasModule('inventory')}
				<a href="/portal/products" class="nav-item" title="Products & Inventory" aria-label="Products and Inventory" class:active={active(routeId, '/portal/products')}>
					<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4a2 2 0 0 1-1.11-1.79V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.79 0z"/><path d="M2.32 6.16 12 11l9.68-4.84"/><path d="M12 22.76V11"/></svg></span>
					<span class="nav-label">Products</span>
				</a>
			{/if}
			<a href="/portal/conversations" class="nav-item" title="Conversations" aria-label="Conversations" class:active={active(routeId, '/portal/conversations')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
				<span class="nav-label">Conversations</span>
			</a>
			<a href="/portal/insights" class="nav-item" title="AI Insights" aria-label="AI Insights" class:active={active(routeId, '/portal/insights')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z"/><path d="M9 21h6"/></svg></span>
				<span class="nav-label">AI Insights</span>
			</a>
		</div>
		<div class="nav-group">
			<p class="nav-heading">Account</p>
			<a href="/portal/modules" class="nav-item" title="Modules" aria-label="Modules" class:active={active(routeId, '/portal/modules')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
				<span class="nav-label">Modules</span>
			</a>
			<a href="/portal/whatsapp" class="nav-item" title="WhatsApp" aria-label="WhatsApp" class:active={active(routeId, '/portal/whatsapp')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>
				<span class="nav-label">WhatsApp</span>
			</a>
			<a href="/portal/settings" class="nav-item" title="Settings" aria-label="Settings" class:active={active(routeId, '/portal/settings')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
				<span class="nav-label">Settings</span>
			</a>
			<a href="/portal/billing" class="nav-item" title="Plan & billing" aria-label="Plan and billing" class:active={active(routeId, '/portal/billing')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></span>
				<span class="nav-label">Plan &amp; billing</span>
			</a>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="topbar">
		<button class="cmdk" on:click={() => palette?.openPalette()} title="Search — ⌘K" aria-label="Open command palette">
			<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
			<span>Search</span>
			<kbd>⌘K</kbd>
		</button>
		<span class="badge dot {client.is_active ? '' : 'off'}">{client.is_active ? 'assistant live' : 'assistant paused'}</span>
	</svelte:fragment>

	<slot />
</AppShell>

<CommandPalette bind:this={palette} modules={modules} />

<style>
	.cmdk { display: inline-flex; align-items: center; gap: 0.45rem; background: rgba(var(--panel-rgb, 255, 255, 255), 0.05); border: 1px solid var(--edge); border-radius: 9px; color: var(--muted); font: inherit; font-size: 0.85rem; padding: 0.35rem 0.7rem; cursor: pointer; }
	.cmdk:hover { border-color: var(--mint); color: var(--soft); }
	.cmdk kbd { font-size: 0.68rem; border: 1px solid var(--edge); border-radius: 4px; padding: 0.02rem 0.28rem; }
	@media (max-width: 640px) { .cmdk span { display: none; } }
</style>
