<script>
	// Global command palette (⌘K / Ctrl+K). Module-aware: destinations are built from
	// the tenant's enabled modules so it only ever offers what's actually on. Keyboard
	// driven (↑ ↓ Enter, Esc). Purely client-side navigation — no data of its own.
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	export let modules = [];

	let open = false;
	let query = '';
	let active = 0;
	let inputEl;

	// key → destination + label + hint + which module gates it (null = always shown).
	const ALL = [
		{ label: 'Overview', hint: 'Dashboard', href: '/portal', module: null, icon: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z' },
		{ label: 'Orders', hint: 'Order board', href: '/portal/orders', module: 'orders', icon: 'M9 22a1 1 0 100-2 1 1 0 000 2z M20 22a1 1 0 100-2 1 1 0 000 2z M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6' },
		{ label: 'AI draft an order', hint: 'From a customer message', href: '/portal/orders?new=ai', module: 'orders', icon: 'M12 2v20 M2 12h20' },
		{ label: 'Leads', hint: 'CRM pipeline', href: '/portal/leads', module: null, icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z' },
		{ label: 'Quotations', hint: 'Proposals', href: '/portal/proposals', module: null, icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6' },
		{ label: 'Knowledge', hint: 'What the AI knows', href: '/portal/knowledge', module: null, icon: 'M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z' },
		{ label: 'Conversations', hint: 'All chats', href: '/portal/conversations', module: null, icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
		{ label: 'AI Insights', hint: 'Analytics', href: '/portal/insights', module: null, icon: 'M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z M9 21h6' },
		{ label: 'Modules', hint: 'Marketplace', href: '/portal/modules', module: null, icon: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z' },
		{ label: 'WhatsApp', hint: 'Connect your number', href: '/portal/whatsapp', module: null, icon: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z' },
		{ label: 'Settings', hint: 'Workspace', href: '/portal/settings', module: null, icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.82 1.17V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4' },
		{ label: 'Plan & billing', hint: 'Subscription', href: '/portal/billing', module: null, icon: 'M2 5h20v14H2z M2 10h20' }
	];

	$: available = ALL.filter((c) => !c.module || modules.includes(c.module));
	$: results = query.trim()
		? available.filter((c) => (c.label + ' ' + c.hint).toLowerCase().includes(query.trim().toLowerCase()))
		: available;
	$: if (active >= results.length) active = 0;

	function toggle() {
		open = !open;
		if (open) {
			query = '';
			active = 0;
			setTimeout(() => inputEl?.focus(), 20);
		}
	}
	// Callable from a parent (e.g. a topbar search button) via bind:this.
	export function openPalette() { if (!open) toggle(); }
	function close() { open = false; }
	function choose(c) { close(); goto(c.href); }

	function onKey(e) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(); return; }
		if (!open) return;
		if (e.key === 'Escape') { e.preventDefault(); close(); }
		else if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % results.length; }
		else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + results.length) % results.length; }
		else if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active]); }
	}
	onMount(() => {
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

{#if open}
	<div class="cp-scrim" on:click|self={close} role="presentation">
		<div class="cp" role="dialog" aria-label="Command palette">
			<div class="cp-input">
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
				<input bind:this={inputEl} bind:value={query} placeholder="Search or jump to…" aria-label="Search" />
				<kbd>esc</kbd>
			</div>
			<div class="cp-list">
				{#each results as c, i}
					<button class="cp-item" class:active={i === active} on:click={() => choose(c)} on:mouseenter={() => (active = i)}>
						<span class="cp-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d={c.icon} /></svg></span>
						<span class="cp-label">{c.label}</span>
						<span class="cp-hint">{c.hint}</span>
					</button>
				{/each}
				{#if !results.length}<div class="cp-empty">No matches for “{query}”.</div>{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.cp-scrim { position: fixed; inset: 0; background: rgba(3, 12, 9, 0.55); backdrop-filter: blur(4px); z-index: 120; display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; }
	.cp { width: min(560px, 94vw); background: var(--body, #0d1f18); border: 1px solid var(--edge); border-radius: 16px; box-shadow: 0 40px 80px -30px rgba(0, 0, 0, 0.7); overflow: hidden; }
	.cp-input { display: flex; align-items: center; gap: 0.6rem; padding: 0.9rem 1rem; border-bottom: 1px solid var(--edge); color: var(--muted); }
	.cp-input input { flex: 1; background: transparent; border: 0; color: var(--strong); font: inherit; font-size: 1rem; outline: none; }
	kbd { font-size: 0.68rem; color: var(--muted); border: 1px solid var(--edge); border-radius: 5px; padding: 0.1rem 0.35rem; }
	.cp-list { max-height: 52vh; overflow-y: auto; padding: 0.4rem; }
	.cp-item { display: flex; align-items: center; gap: 0.7rem; width: 100%; text-align: left; background: transparent; border: 0; border-radius: 10px; padding: 0.6rem 0.7rem; cursor: pointer; color: var(--soft); }
	.cp-item.active { background: rgba(46, 204, 113, 0.12); }
	.cp-ico { width: 30px; height: 30px; border-radius: 8px; background: rgba(var(--panel-rgb, 255, 255, 255), 0.05); display: grid; place-items: center; color: var(--mint); flex: none; }
	.cp-ico svg { width: 16px; height: 16px; }
	.cp-label { font-weight: 600; color: var(--strong); }
	.cp-hint { margin-left: auto; color: var(--muted); font-size: 0.8rem; }
	.cp-empty { color: var(--muted); text-align: center; padding: 1.5rem; font-size: 0.9rem; }
</style>
