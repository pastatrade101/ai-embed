<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	export let form;
	$: verified = $page.url.searchParams.get('verified') === '1';
	let showPw = false;
</script>

<div class="auth-wrap">
	<div class="auth-card">
		<div class="auth-logo">
			<img src="/ICON-AI.png" alt="Makutano AI" />
		</div>
		<h1>Sign in</h1>
		<p class="muted" style="margin-top:-.4rem">Operators and admins use the same login.</p>

		{#if verified}<div class="notice ok">Email confirmed — sign in to open your workspace.</div>{/if}
		{#if form?.error}<div class="notice err">{form.error}</div>{/if}

		<form class="grid" method="POST" use:enhance>
			<div>
				<label for="email">Email</label>
				<input id="email" name="email" type="email" required autocomplete="username" value={form?.email ?? ''} />
			</div>
			<div>
				<label for="password">Password</label>
				<div class="pw-field">
					<input id="password" name="password" type={showPw ? 'text' : 'password'} required autocomplete="current-password" />
					<button
						type="button"
						class="pw-toggle"
						on:click={() => (showPw = !showPw)}
						aria-label={showPw ? 'Hide password' : 'Show password'}
						title={showPw ? 'Hide password' : 'Show password'}
					>
						{#if showPw}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
						{/if}
					</button>
				</div>
			</div>
			<button type="submit" style="width:100%;justify-content:center">Sign in</button>
		</form>
	</div>
	<p class="auth-foot muted">AI site assistant · multi-tenant platform</p>
</div>

<style>
	.pw-field {
		position: relative;
	}
	.pw-field input {
		width: 100%;
		padding-right: 2.75rem;
	}
	.pw-toggle {
		position: absolute;
		top: 50%;
		right: 0.45rem;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		border-radius: 8px;
		transition: color 0.15s, background 0.15s;
	}
	.pw-toggle:hover {
		color: var(--mint);
		background: rgba(var(--gold-rgb), 0.12);
	}
	.pw-toggle svg {
		width: 18px;
		height: 18px;
	}
</style>
