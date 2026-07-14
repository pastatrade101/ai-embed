<script>
	// Shared logged-in shell: dark sidebar (brand + grouped nav + user card) and
	// a glass topbar. Adapted from the Pastatrade dashboard layout.
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	export let user = null; // { name, email }
	export let initials = '?';
	export let avatarColor = null; // override the user-card avatar gradient

	// Collapse the sidebar to an icon rail. Persisted so it survives navigation
	// and reloads. Desktop-only — on mobile the sidebar is a horizontal bar.
	let collapsed = false;
	onMount(() => {
		try {
			collapsed = localStorage.getItem('mk_nav_collapsed') === '1';
		} catch (e) {}
	});
	function toggleNav() {
		collapsed = !collapsed;
		try {
			localStorage.setItem('mk_nav_collapsed', collapsed ? '1' : '0');
		} catch (e) {}
	}
</script>

<div class="app-shell" class:collapsed>
	<aside class="sidebar">
		<slot name="brand" />

		<nav class="side-nav">
			<slot name="nav" />
		</nav>

		<div class="side-user">
			<div class="u-card">
				<span class="u-avatar" style={avatarColor ? `background:${avatarColor}` : ''}>{initials}</span>
				<div class="u-meta">
					<div class="u-name">{user?.name ?? 'Account'}</div>
					<div class="u-email">{user?.email ?? ''}</div>
				</div>
				<form method="POST" action="/logout">
					<button class="ghost sm" type="submit" title="Sign out" aria-label="Sign out">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
					</button>
				</form>
			</div>
		</div>
	</aside>

	<div class="main">
		<div class="topbar">
			<button
				class="nav-toggle"
				type="button"
				on:click={toggleNav}
				aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				aria-pressed={collapsed}
				title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
			</button>
			<div class="crumbs"><slot name="topbar" /></div>
			<div class="spacer"></div>
			<slot name="actions" />
		</div>
		{#key $page.url.pathname}
			<div class="content content-anim"><slot /></div>
		{/key}
	</div>
</div>
