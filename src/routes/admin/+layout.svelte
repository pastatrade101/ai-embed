<script>
	import { page } from '$app/stores';
	import AppShell from '$lib/components/AppShell.svelte';
	export let data;

	$: routeId = $page.route?.id ?? '';
	// Take routeId as an arg so the template expression depends on it directly —
	// otherwise the class binding never re-evaluates on client-side navigation.
	const active = (rid, base, exact = false) => (exact ? rid === base : rid?.startsWith(base));
	$: initials = (data.user?.name ?? data.user?.email ?? 'A').trim().charAt(0).toUpperCase();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<AppShell user={data.user} {initials}>
	<a class="side-brand" href="/admin" slot="brand">
		<span class="mark">
			<img src="/ICON-AI.png" alt="Makutano" />
		</span>
		<span><b>Makutano</b><span class="sub">Admin console</span></span>
	</a>

	<svelte:fragment slot="nav">
		<div class="nav-group">
			<p class="nav-heading">Platform</p>
			<a href="/admin" class="nav-item" title="Dashboard" aria-label="Dashboard" class:active={active(routeId, '/admin', true)}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg></span>
				<span class="nav-label">Dashboard</span>
			</a>
			<a href="/admin/revenue" class="nav-item" title="Revenue" aria-label="Revenue" class:active={active(routeId, '/admin/revenue')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
				<span class="nav-label">Revenue</span>
			</a>
			<a href="/admin/industries" class="nav-item" title="Industry intelligence" aria-label="Industry intelligence" class:active={active(routeId, '/admin/industries')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg></span>
				<span class="nav-label">Industries</span>
			</a>
			<a href="/admin/ai" class="nav-item" title="AI operations" aria-label="AI operations" class:active={active(routeId, '/admin/ai')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 10.1 8.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg></span>
				<span class="nav-label">AI operations</span>
			</a>
			<a href="/admin/plans" class="nav-item" title="Plans & billing" aria-label="Plans and billing" class:active={active(routeId, '/admin/plans')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg></span>
				<span class="nav-label">Plans &amp; billing</span>
			</a>
			<a href="/admin/settings" class="nav-item" title="Settings" aria-label="Settings" class:active={active(routeId, '/admin/settings')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
				<span class="nav-label">Settings</span>
			</a>
			<a href="/admin/whatsapp" class="nav-item" title="WhatsApp" aria-label="WhatsApp" class:active={active(routeId, '/admin/whatsapp') && !active(routeId, '/admin/whatsapp/conversations')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>
				<span class="nav-label">WhatsApp</span>
			</a>
			<a href="/admin/whatsapp/conversations" class="nav-item" title="WhatsApp chats" aria-label="WhatsApp chats" class:active={active(routeId, '/admin/whatsapp/conversations')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
				<span class="nav-label">WhatsApp chats</span>
			</a>
		</div>
		<div class="nav-group">
			<p class="nav-heading">Tenants</p>
			<a href="/admin/clients" class="nav-item" title="Clients" aria-label="Clients" class:active={active(routeId, '/admin/clients') && !active(routeId, '/admin/clients/new')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
				<span class="nav-label">Clients</span>
			</a>
			<a href="/admin/clients/new" class="nav-item" title="Add client" aria-label="Add client" class:active={active(routeId, '/admin/clients/new')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg></span>
				<span class="nav-label">Add client</span>
			</a>
		</div>
	</svelte:fragment>

	<span slot="topbar" class="badge neutral">super admin</span>

	<a slot="actions" class="btn sm ghost topbar-cta" href="/admin/clients/new" title="New client" aria-label="New client">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
		<span class="cta-lbl">New client</span>
	</a>

	<slot />
</AppShell>
