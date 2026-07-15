<script>
	// Dark/light switch for the dashboard shell. The actual theme is a `data-theme`
	// attribute on <html>; an inline script in app.html sets it before first paint
	// (from localStorage) to avoid a flash. Here we just flip + persist it.
	import { onMount } from 'svelte';
	let theme = 'dark';
	onMount(() => {
		theme = document.documentElement.getAttribute('data-theme') || 'dark';
	});
	function apply(next) {
		theme = next;
		const el = document.documentElement;
		el.setAttribute('data-theme', next);
		try {
			localStorage.setItem('mk_theme', next);
		} catch (e) {}
		// Keep the anti-flash background colour in sync with the theme.
		const bg = next === 'light' ? '#f6f7f4' : '#0a231b';
		el.style.background = bg;
		if (document.body) document.body.style.background = bg;
	}
	const toggle = () => apply(theme === 'light' ? 'dark' : 'light');
</script>

<button
	class="theme-toggle"
	type="button"
	on:click={toggle}
	title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
	aria-label="Toggle light and dark theme"
>
	{#if theme === 'light'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
	{:else}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
	{/if}
</button>

<style>
	.theme-toggle {
		display: inline-grid;
		place-items: center;
		width: 36px;
		height: 36px;
		flex: none;
		border-radius: 10px;
		border: 1px solid var(--edge);
		background: var(--panel-2);
		color: var(--muted);
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
	}
	.theme-toggle svg {
		width: 17px;
		height: 17px;
	}
	.theme-toggle:hover {
		color: var(--mint);
		border-color: rgba(var(--gold-rgb), 0.4);
		background: rgba(var(--gold-rgb), 0.1);
	}
</style>
