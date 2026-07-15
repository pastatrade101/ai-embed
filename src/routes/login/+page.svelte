<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	export let form;
	$: verified = $page.url.searchParams.get('verified') === '1';
</script>

<div class="auth-wrap">
	<div class="auth-card">
		<div class="auth-logo">
			<img src="/Makutano_AI_Logo.png" alt="Makutano AI" />
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
				<input id="password" name="password" type="password" required autocomplete="current-password" />
			</div>
			<button type="submit" style="width:100%;justify-content:center">Sign in</button>
		</form>
	</div>
	<p class="auth-foot muted">AI site assistant · multi-tenant platform</p>
</div>
