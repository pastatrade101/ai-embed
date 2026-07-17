<script>
	// On success the server load() redirects to /portal, so this page only ever
	// renders when the confirmation link was invalid or expired.
	export let data;
</script>

<svelte:head>
	<title>Confirm your email — Makutano AI</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="vf">
	<header class="vf-top">
		<a class="brand" href="/">
			<img src="/ICON-AI.png" alt="" />
			<span>Makutano&nbsp;AI</span>
		</a>
	</header>

	<div class="vf-wrap">
		<div class="vf-card">
			<div class="vf-mark">⚠️</div>
			<div class="eyebrow">Link problem</div>
			<h1>We couldn't confirm your email</h1>
			<p class="desc">{data.error}</p>
			<div class="vf-actions">
				<a class="go" href="/onboarding">Sign up again</a>
				<a class="ghost" href="/login">Sign in</a>
			</div>
		</div>
	</div>
</div>

<style>
	.vf {
		--forest: #10362a;
		--forest-2: #0c2c22;
		--gold: #e0b24c;
		--gold-soft: #ecca7d;
		--gold-ink: #23180a;
		--cream: #f7f2e8;
		min-height: 100vh;
		background: radial-gradient(80% 60% at 80% -10%, rgba(224, 178, 76, 0.14), transparent 55%),
			linear-gradient(170deg, var(--forest), var(--forest-2) 70%, #0a231b);
		color: var(--cream);
		font-family: 'Geist', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
		-webkit-font-smoothing: antialiased;
		letter-spacing: -0.011em;
	}
	.vf :global(a) {
		color: inherit;
		text-decoration: none;
	}
	.vf-top {
		border-bottom: 1px solid rgba(247, 242, 232, 0.1);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-weight: 660;
		font-size: 0.95rem;
		max-width: 1060px;
		margin: 0 auto;
		padding: 1.1rem 1.5rem;
	}
	.brand img {
		width: 32px;
		height: 32px;
		border-radius: 9px;
	}
	.vf-wrap {
		max-width: 1060px;
		margin: 0 auto;
		padding: 4rem 1.5rem;
		display: grid;
		place-items: center;
	}
	.vf-card {
		width: 100%;
		max-width: 500px;
		border: 1px solid rgba(247, 242, 232, 0.1);
		background: rgba(247, 242, 232, 0.03);
		border-radius: 24px;
		padding: 2.5rem;
		text-align: center;
	}
	.vf-mark {
		font-size: 2.4rem;
		line-height: 1;
		margin-bottom: 1.1rem;
	}
	.eyebrow {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--gold);
	}
	.vf-card h1 {
		margin: 0.6rem 0 0;
		font-size: clamp(1.4rem, 3vw, 1.9rem);
		font-weight: 640;
		color: inherit;
	}
	.desc {
		margin: 0.75rem 0 0;
		color: rgba(247, 242, 232, 0.7);
		font-size: 0.98rem;
		line-height: 1.5;
	}
	.vf-actions {
		margin-top: 1.75rem;
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}
	.go {
		background: var(--gold);
		color: var(--gold-ink);
		border-radius: 999px;
		padding: 0.8rem 1.5rem;
		font-size: 0.92rem;
		font-weight: 650;
		transition: background 0.15s, transform 0.15s;
	}
	.go:hover {
		background: var(--gold-soft);
		transform: translateY(-1px);
	}
	.ghost {
		border: 1px solid rgba(247, 242, 232, 0.2);
		border-radius: 999px;
		padding: 0.8rem 1.5rem;
		font-size: 0.92rem;
		font-weight: 600;
		color: rgba(247, 242, 232, 0.8);
	}
	.ghost:hover {
		border-color: var(--gold);
		color: var(--cream);
	}
</style>
