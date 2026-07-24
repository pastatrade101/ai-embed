<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	export let form;
	$: verified = $page.url.searchParams.get('verified') === '1';
	let showPw = false;
	let submitting = false;

	const perks = [
		'Manage all your AI conversations in real time',
		'Configure channels: WhatsApp, web, email & more',
		'View analytics and response performance',
		'Escalate and hand off to your human team'
	];
</script>

<svelte:head>
	<title>Sign in — Makutano AI</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="auth">
	<!-- LEFT BRAND PANEL -->
	<aside class="brand-panel">
		<div class="bp-grid"></div>
		<div class="bp-glow"></div>

		<a class="bp-logo" href="/">
			<img src="/ICON-AI.png" alt="" width="36" height="36" />
			<span>Makutano&nbsp;AI</span>
		</a>

		<div class="bp-mid">
			<span class="bp-badge"><span class="dot"></span> AI assistant · multi-tenant platform</span>
			<h2>Your AI team is ready.<br /><span class="accent">Sign in to deploy it.</span></h2>
			<p class="bp-sub">Operators and admins share a single login — everything you need to manage your AI assistant, channels and conversations, in one place.</p>
			<ul class="checks">
				{#each perks as p}
					<li>
						<span class="check-ico">
							<svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6.2 4.6 9 10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
						</span>
						<span>{p}</span>
					</li>
				{/each}
			</ul>
		</div>

		<p class="bp-foot">Built for businesses &amp; public institutions across East Africa.</p>
	</aside>

	<!-- RIGHT FORM PANEL -->
	<main class="form-panel">
		<div class="fp-top">
			<a class="m-logo" href="/"><img src="/ICON-AI.png" alt="" width="30" height="30" /><span>Makutano&nbsp;AI</span></a>
			<a class="back" href="/">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3 5 8l5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
				Back to website
			</a>
		</div>

		<div class="fp-body">
			<div class="fp-card">
				<div class="fp-head">
					<h1>Welcome back</h1>
					<p>Sign in to your Makutano dashboard</p>
				</div>

				{#if verified}<div class="notice ok">Email confirmed — sign in to open your workspace.</div>{/if}
				{#if form?.error}<div class="notice err">{form.error}</div>{/if}

				<form
					method="POST"
					class="form"
					use:enhance={() => {
						submitting = true;
						return async ({ update }) => {
							await update();
							submitting = false;
						};
					}}
				>
					<div class="field">
						<label for="email">Email address</label>
						<div class="input-wrap">
							<span class="in-ico">
								<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" stroke-width="1.8" /><path d="M2 8l10 7 10-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
							</span>
							<input id="email" name="email" type="email" required autocomplete="username" placeholder="you@organization.com" value={form?.email ?? ''} />
						</div>
					</div>

					<div class="field">
						<label for="password">Password</label>
						<div class="input-wrap">
							<span class="in-ico">
								<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.8" /><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
							</span>
							<input id="password" name="password" type={showPw ? 'text' : 'password'} required autocomplete="current-password" placeholder="••••••••••" />
							<button type="button" class="pw-toggle" on:click={() => (showPw = !showPw)} tabindex="-1" aria-label={showPw ? 'Hide password' : 'Show password'} title={showPw ? 'Hide password' : 'Show password'}>
								{#if showPw}
									<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
								{:else}
									<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.8" /><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" /></svg>
								{/if}
							</button>
						</div>
					</div>

					<button type="submit" class="submit" class:loading={submitting} disabled={submitting}>
						{#if submitting}
							<svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" stroke-width="3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" stroke-width="3" stroke-linecap="round" /></svg>
							Signing in…
						{:else}
							Sign in to dashboard
						{/if}
					</button>
				</form>

				<p class="alt">New to Makutano? <a href="/onboarding">Create an account</a></p>

				<p class="terms">By signing in, you agree to Makutano's <a href="/privacy-policy">Privacy Policy</a>.</p>
			</div>
		</div>

		<div class="fp-bottom">
			<span>© {new Date().getFullYear()} Makutano&nbsp;AI</span>
			<span class="secure">
				<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.8" /><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
				Secure sign-in
			</span>
		</div>
	</main>
</div>

<style>
	.auth {
		--forest: #10362a;
		--forest2: #17493a;
		--ink: #0c2c22;
		--gold: #e0b24c;
		--gold2: #c9991a;
		--gold-soft: #ecca7d;
		--cream: #faf7f0;
		--text: #123528;
		--muted: #6b7c72;
		--border: #e7ded0;
		--line: #eef0ec;
		min-height: 100vh;
		display: flex;
		background: #fff;
		color: var(--text);
		font-family: 'Lexend Deca', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
		-webkit-font-smoothing: antialiased;
	}
	.auth :global(*) { box-sizing: border-box; }

	/* ── Left brand panel ── */
	.brand-panel {
		position: relative;
		width: 52%;
		max-width: 680px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 3.5rem 4rem;
		background: linear-gradient(160deg, #10362a 0%, #17493a 100%);
	}
	.bp-grid { position: absolute; inset: 0; opacity: 0.1; background-image: linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px); background-size: 48px 48px; }
	.bp-glow { position: absolute; bottom: 22%; left: 40%; width: 320px; height: 320px; border-radius: 50%; background: var(--gold); opacity: 0.14; filter: blur(90px); pointer-events: none; }

	.bp-logo { position: relative; display: inline-flex; align-items: center; gap: 0.6rem; text-decoration: none; }
	.bp-logo img { width: 36px; height: 36px; border-radius: 9px; }
	.bp-logo span { color: #fff; font-weight: 800; font-size: 1.15rem; }

	.bp-mid { position: relative; flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 3rem 0; }
	.bp-badge { display: inline-flex; align-items: center; gap: 0.5rem; align-self: flex-start; padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.76rem; font-weight: 500; color: var(--gold-soft); background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16); margin-bottom: 1.9rem; }
	.bp-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--gold); animation: pulse 2s infinite; }
	@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(224, 178, 76, 0.5); } 70% { box-shadow: 0 0 0 7px rgba(224, 178, 76, 0); } 100% { box-shadow: 0 0 0 0 rgba(224, 178, 76, 0); } }
	.bp-mid h2 { color: #fff; font-weight: 800; font-size: clamp(1.9rem, 2.6vw, 2.8rem); line-height: 1.12; letter-spacing: -0.02em; margin: 0 0 1.3rem; }
	.accent { color: var(--gold); }
	.bp-sub { color: rgba(255, 255, 255, 0.6); font-size: 1rem; line-height: 1.6; max-width: 400px; margin: 0 0 2.4rem; }
	.checks { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1rem; }
	.checks li { display: flex; align-items: center; gap: 0.8rem; color: rgba(255, 255, 255, 0.72); font-size: 0.9rem; }
	.check-ico { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; color: var(--gold); background: rgba(224, 178, 76, 0.18); border: 1px solid rgba(224, 178, 76, 0.4); flex-shrink: 0; }
	.bp-foot { position: relative; color: rgba(255, 255, 255, 0.4); font-size: 0.8rem; margin: 0; }

	/* ── Right form panel ── */
	.form-panel { flex: 1; display: flex; flex-direction: column; background: #fff; }
	.fp-top { display: flex; align-items: center; justify-content: flex-end; gap: 1rem; padding: 1.4rem 2rem; border-bottom: 1px solid var(--line); }
	.m-logo { display: none; align-items: center; gap: 0.5rem; margin-right: auto; text-decoration: none; }
	.m-logo img { width: 30px; height: 30px; border-radius: 8px; }
	.m-logo span { font-weight: 800; color: var(--text); }
	.back { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--muted); text-decoration: none; font-size: 0.88rem; transition: color 0.15s; }
	.back:hover { color: var(--text); }

	.fp-body { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2.5rem 2rem; }
	.fp-card { width: 100%; max-width: 400px; }
	.fp-head { margin-bottom: 2rem; }
	.fp-head h1 { font-weight: 800; font-size: 2rem; color: var(--ink); margin: 0 0 0.4rem; letter-spacing: -0.02em; }
	.fp-head p { color: var(--muted); margin: 0; }

	.notice { border-radius: 12px; padding: 0.8rem 1rem; font-size: 0.88rem; margin-bottom: 1rem; }
	.notice.err { background: #fef3f2; color: #b42318; border: 1px solid #fecdca; }
	.notice.ok { background: #f0f7f2; color: #10362a; border: 1px solid #cfe6d9; }

	.form { display: flex; flex-direction: column; gap: 1.15rem; }
	.field label { display: block; font-size: 0.86rem; font-weight: 600; color: var(--ink); margin-bottom: 0.5rem; }
	.input-wrap { position: relative; display: flex; align-items: center; border: 1px solid var(--border); border-radius: 12px; background: #fff; transition: border-color 0.15s, box-shadow 0.15s; }
	.input-wrap:focus-within { border-color: var(--forest); box-shadow: 0 0 0 3px rgba(16, 54, 42, 0.12); }
	.in-ico { position: absolute; left: 0.9rem; display: grid; place-items: center; color: var(--muted); pointer-events: none; }
	.input-wrap input { width: 100%; padding: 0.85rem 1rem 0.85rem 2.6rem; border: 0; background: transparent; outline: none; font-family: inherit; font-size: 0.92rem; color: var(--text); border-radius: 12px; }
	.input-wrap input::placeholder { color: #c3ccc6; }
	.pw-toggle { position: absolute; right: 0.55rem; display: grid; place-items: center; width: 2rem; height: 2rem; padding: 0; border: 0; background: transparent; color: var(--muted); cursor: pointer; border-radius: 8px; transition: color 0.15s, background 0.15s; }
	.pw-toggle:hover { color: var(--forest); background: rgba(224, 178, 76, 0.14); }

	.submit { margin-top: 0.4rem; width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.95rem 1rem; border: 0; border-radius: 12px; font-family: inherit; font-weight: 700; font-size: 0.95rem; cursor: pointer; color: var(--ink); background: linear-gradient(135deg, var(--gold), var(--gold2)); box-shadow: 0 10px 24px -12px rgba(201, 153, 26, 0.7); transition: filter 0.15s, box-shadow 0.15s, transform 0.15s; }
	.submit:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-1px); }
	.submit.loading { background: var(--forest); color: #fff; box-shadow: none; cursor: default; }
	.spin { animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	.alt { text-align: center; font-size: 0.88rem; color: var(--muted); margin: 1.5rem 0 0; }
	.alt a { color: var(--forest); font-weight: 600; text-decoration: none; }
	.alt a:hover { text-decoration: underline; }
	.terms { text-align: center; font-size: 0.76rem; color: var(--muted); margin: 1.6rem 0 0; line-height: 1.5; }
	.terms a { color: var(--muted); text-decoration: underline; }
	.terms a:hover { color: var(--text); }

	.fp-bottom { display: flex; align-items: center; justify-content: space-between; padding: 1.15rem 2rem; border-top: 1px solid var(--line); font-size: 0.78rem; color: var(--muted); }
	.secure { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--forest); }

	/* ── Responsive ── */
	@media (max-width: 1000px) {
		.brand-panel { display: none; }
		.m-logo { display: inline-flex; }
	}
	@media (max-width: 560px) {
		.fp-top, .fp-bottom { padding-left: 1.25rem; padding-right: 1.25rem; }
		.fp-body { padding: 1.75rem 1.25rem; }
		.fp-head h1 { font-size: 1.7rem; }
	}
	@media (prefers-reduced-motion: reduce) {
		.bp-badge .dot { animation: none; }
		.submit:hover:not(:disabled) { transform: none; }
	}
</style>
