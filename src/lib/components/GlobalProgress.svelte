<script>
	// App-wide interaction feedback, mounted once in the root layout:
	//  1. A top progress bar whenever SvelteKit is navigating (page loads, form
	//     redirects) — so screen changes never feel sudden.
	//  2. A submit guard: the moment any form is submitted, its button gets an
	//     instant "loading" state and is locked, preventing the double-clicks that
	//     happen when nothing appears to react. Cleared when the navigation or the
	//     form action finishes (or a safety timeout).
	// Opt a form out with `data-no-busy` (e.g. the chat composer, which manages its
	// own state).
	import { onMount } from 'svelte';
	import { navigating, page } from '$app/stores';

	$: loading = !!$navigating;

	const busy = new Set();
	function markBusy(btn) {
		if (!btn || btn.hasAttribute('data-no-busy') || btn.classList.contains('is-loading')) return;
		btn.classList.add('is-loading');
		btn.setAttribute('aria-busy', 'true');
		busy.add(btn);
		setTimeout(() => clearOne(btn), 12000); // safety net
	}
	function clearOne(btn) {
		btn.classList.remove('is-loading');
		btn.removeAttribute('aria-busy');
		busy.delete(btn);
	}
	function clearAll() {
		for (const b of [...busy]) clearOne(b);
	}

	onMount(() => {
		const onSubmit = (e) => {
			const form = e.target;
			if (!(form instanceof HTMLFormElement) || form.hasAttribute('data-no-busy')) return;
			const btn = e.submitter || form.querySelector('button[type="submit"], button:not([type])');
			markBusy(btn);
		};
		document.addEventListener('submit', onSubmit, true);
		return () => document.removeEventListener('submit', onSubmit, true);
	});

	// Clear busy states when a navigation completes...
	let wasNavigating = false;
	$: {
		if ($navigating) wasNavigating = true;
		else if (wasNavigating) {
			wasNavigating = false;
			clearAll();
		}
	}
	// ...or when an enhanced form action returns (staying on the page).
	let lastForm;
	$: if ($page.form !== lastForm) {
		lastForm = $page.form;
		if (!$navigating) clearAll();
	}
</script>

<div class="nav-progress" class:on={loading} aria-hidden="true"><span></span></div>

<style>
	.nav-progress {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 2.5px;
		z-index: 9999;
		overflow: hidden;
		opacity: 0;
		transition: opacity 0.2s;
		pointer-events: none;
	}
	.nav-progress.on {
		opacity: 1;
	}
	.nav-progress span {
		display: block;
		height: 100%;
		width: 40%;
		border-radius: 0 3px 3px 0;
		background: linear-gradient(90deg, transparent, var(--mint, #e0b24c), transparent);
		box-shadow: none;
		animation: nav-slide 1s ease-in-out infinite;
	}
	@keyframes nav-slide {
		0% {
			transform: translateX(-105%);
		}
		100% {
			transform: translateX(320%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.nav-progress span {
			animation-duration: 2s;
		}
	}
</style>
