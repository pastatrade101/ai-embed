<script>
	// Shared logged-in shell: dark sidebar (brand + grouped nav + user card) and
	// a glass topbar. Adapted from the Pastatrade dashboard layout.
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { afterNavigate } from '$app/navigation';
	import ProfileMenu from '$lib/components/ProfileMenu.svelte';
	export let user = null; // { name, email }
	export let initials = '?';
	export let avatarColor = null; // override the user-card avatar gradient

	// Collapse the sidebar to an icon rail (desktop). Persisted across reloads.
	let collapsed = false;
	// On phones the sidebar is an off-canvas drawer opened by the hamburger.
	let mobileNavOpen = false;
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
	// Any navigation closes the mobile drawer.
	afterNavigate(() => {
		mobileNavOpen = false;
	});
</script>

<div class="app-shell" class:collapsed>
	<aside class="sidebar" class:open={mobileNavOpen}>
		<slot name="brand" />

		<nav class="side-nav">
			<slot name="nav" />
		</nav>
	</aside>
	<button
		class="nav-backdrop"
		class:show={mobileNavOpen}
		type="button"
		on:click={() => (mobileNavOpen = false)}
		aria-label="Close menu"
		tabindex="-1"
	></button>

	<div class="main">
		<div class="topbar">
			<button
				class="hamburger"
				type="button"
				on:click={() => (mobileNavOpen = !mobileNavOpen)}
				aria-label="Menu"
				aria-expanded={mobileNavOpen}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
			</button>
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
			<div class="top-right">
				<slot name="actions" />
				<ProfileMenu {user} {initials} {avatarColor} />
			</div>
		</div>
		{#key $page.url.pathname}
			<div class="content content-anim"><slot /></div>
		{/key}
	</div>
</div>
