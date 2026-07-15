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
			<a href="/admin/plans" class="nav-item" title="Plans & billing" aria-label="Plans and billing" class:active={active(routeId, '/admin/plans')}>
				<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg></span>
				<span class="nav-label">Plans &amp; billing</span>
			</a>
		</div>
		<div class="nav-group">
			<p class="nav-heading">Tenants</p>
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
