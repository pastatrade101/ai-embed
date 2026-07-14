<script>
	import { page } from '$app/stores';
	import AppShell from '$lib/components/AppShell.svelte';
	import { readableInk } from '$lib/luminance.js';
	export let data;

	$: routeId = $page.route?.id ?? '';
	$: client = data.client;
	// Take routeId as an arg so the template expression depends on it directly —
	// otherwise the class binding never re-evaluates on client-side navigation.
	const active = (rid, base, exact = false) => (exact ? rid === base : rid?.startsWith(base));
	const initials = (n) => (n ?? '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	$: userInitials = (data.user?.name ?? data.user?.email ?? 'O').trim().charAt(0).toUpperCase();
</script>

<AppShell user={data.user} initials={userInitials}>
	<a class="side-brand" href="/portal" slot="brand">
		<span class="mark" style={`background:${client.brand_color ?? '#37e0a6'};border-color:transparent;color:${readableInk(client.brand_color ?? '#37e0a6')}`}>{initials(client.name)}</span>
		<span><b>{client.name}</b><span class="sub">Operator portal</span></span>
	</a>

	<svelte:fragment slot="nav">
		<div class="nav-group">
			<p class="nav-heading">Manage</p>
			<a href="/portal" class="nav-item" title="Overview" aria-label="Overview" class:active={active(routeId, '/portal', true)}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg></span>
				<span class="nav-label">Overview</span>
			</a>
			<a href="/portal/knowledge" class="nav-item" title="Knowledge" aria-label="Knowledge" class:active={active(routeId, '/portal/knowledge')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
				<span class="nav-label">Knowledge</span>
			</a>
			<a href="/portal/leads" class="nav-item" title="Leads" aria-label="Leads" class:active={active(routeId, '/portal/leads')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>
				<span class="nav-label">Leads</span>
			</a>
			<a href="/portal/conversations" class="nav-item" title="Conversations" aria-label="Conversations" class:active={active(routeId, '/portal/conversations')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
				<span class="nav-label">Conversations</span>
			</a>
		</div>
		<div class="nav-group">
			<p class="nav-heading">Account</p>
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

	<span slot="topbar" class="badge dot {client.is_active ? '' : 'off'}">{client.is_active ? 'assistant live' : 'assistant paused'}</span>

	<slot />
</AppShell>
