<script>
	// Avatar button that opens a dropdown with the account, a light/dark switch,
	// and sign-out — replacing the loose top-bar icons on every screen size.
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	export let user = null;
	export let initials = '?';
	export let avatarColor = null;

	let open = false;
	let theme = 'dark';
	onMount(() => {
		theme = document.documentElement.getAttribute('data-theme') || 'dark';
	});

	function setTheme(next) {
		theme = next;
		const el = document.documentElement;
		el.setAttribute('data-theme', next);
		try {
			localStorage.setItem('mk_theme', next);
		} catch (e) {}
		const bg = next === 'light' ? '#f6f7f4' : '#0a231b';
		el.style.background = bg;
		if (document.body) document.body.style.background = bg;
	}
	const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
	const close = () => (open = false);

	function onDocClick(e) {
		if (open && !e.target.closest('.profile-menu')) close();
	}
	function onKey(e) {
		if (e.key === 'Escape') close();
	}
	onMount(() => {
		document.addEventListener('click', onDocClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('click', onDocClick);
			document.removeEventListener('keydown', onKey);
		};
	});
	afterNavigate(close);
</script>

<div class="profile-menu">
	<button
		class="pm-avatar"
		type="button"
		on:click={() => (open = !open)}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label="Account menu"
	>
		<span class="u-avatar" style={avatarColor ? `background:${avatarColor}` : ''}>{initials}</span>
	</button>

	{#if open}
		<div class="pm-dropdown" role="menu">
			<div class="pm-head">
				<span class="u-avatar lg" style={avatarColor ? `background:${avatarColor}` : ''}>{initials}</span>
				<div class="pm-id">
					<div class="pm-name">{user?.name ?? 'Account'}</div>
					<div class="pm-email">{user?.email ?? ''}</div>
				</div>
			</div>
			<div class="pm-sep"></div>
			<button type="button" class="pm-item" role="menuitem" on:click={toggleTheme}>
				{#if theme === 'light'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
					Dark mode
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
					Light mode
				{/if}
			</button>
			<div class="pm-sep"></div>
			<form method="POST" action="/logout">
				<button type="submit" class="pm-item danger" role="menuitem">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
					Sign out
				</button>
			</form>
		</div>
	{/if}
</div>

<style>
	.profile-menu {
		position: relative;
		flex: none;
	}
	.pm-avatar {
		border: 0;
		background: transparent;
		padding: 0;
		border-radius: 50%;
		cursor: pointer;
		line-height: 0;
	}
	.u-avatar {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--mint), var(--accent));
		color: var(--ink-text);
		font-weight: 800;
		font-size: 0.82rem;
		flex: none;
	}
	.u-avatar.lg {
		width: 38px;
		height: 38px;
	}
	.pm-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		min-width: 224px;
		background: var(--panel);
		border: 1px solid var(--edge);
		border-radius: 14px;
		padding: 0.4rem;
		z-index: 70;
	}
	.pm-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.6rem;
	}
	.pm-id {
		min-width: 0;
	}
	.pm-name {
		font-size: 0.86rem;
		font-weight: 650;
		color: var(--strong);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pm-email {
		font-size: 0.72rem;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pm-sep {
		height: 1px;
		background: var(--edge);
		margin: 0.3rem 0.2rem;
	}
	.profile-menu form {
		margin: 0;
	}
	.pm-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.6rem;
		border: 0;
		background: transparent;
		color: var(--body);
		font: inherit;
		font-size: 0.87rem;
		border-radius: 9px;
		cursor: pointer;
		text-align: left;
		transition: background 0.14s, color 0.14s;
	}
	.pm-item:hover {
		background: rgba(var(--fg-rgb), 0.06);
		color: var(--strong);
	}
	.pm-item svg {
		width: 17px;
		height: 17px;
		color: var(--muted);
		flex: none;
	}
	.pm-item:hover svg {
		color: var(--mint);
	}
	.pm-item.danger:hover,
	.pm-item.danger:hover svg {
		color: var(--danger);
	}
</style>
