<script>
	import { enhance } from '$app/forms';
	export let form;
</script>

<div class="auth-wrap">
	<div class="auth-card">
		<div class="auth-brand">
			<svg class="logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 12v8"/><path d="M12 12 6 5"/><path d="M12 12l6-7"/></svg>
			<b>Makutano Digital</b>
		</div>
		<h1>Sign in</h1>
		<p class="muted" style="margin-top:-.4rem">Operators and admins use the same login.</p>

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
