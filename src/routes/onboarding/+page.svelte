<script>
	import { enhance } from '$app/forms';
	export let form;

	const STAGES = [
		{ key: 'business', label: 'Your business', hint: 'Tell us who you are' },
		{ key: 'tours', label: 'Your tours', hint: 'What you sell' },
		{ key: 'channels', label: 'Channels', hint: 'Where customers reach you' },
		{ key: 'account', label: 'Create account', hint: 'Save & go live' }
	];

	const REGIONS = ['Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'South Africa', 'Other'];
	const CURRENCIES = ['USD', 'EUR', 'GBP', 'TZS', 'KES'];
	const FOCUS = ['Safari', 'Kilimanjaro', 'Zanzibar', 'Gorilla trekking', 'Cultural', 'Honeymoon', 'Family', 'Budget', 'Luxury'];
	const CHANNELS = ['WhatsApp', 'Instagram', 'Facebook', 'Google Business', 'Website', 'QR Code'];
	const SUGGESTIONS = [
		'A boutique safari operator in Arusha specializing in Serengeti & Ngorongoro',
		'Family-friendly Tanzania tours with Zanzibar beach extensions',
		'Luxury Kilimanjaro climbs with private guides',
		'Budget group departures to Masai Mara from Nairobi'
	];

	let stageIdx = 0;
	let submitting = false;

	// Form state (bound to visible inputs; mirrored into hidden named inputs).
	let brandName = form?.values?.brandName ?? '';
	let description = form?.values?.description ?? '';
	let region = form?.values?.region ?? 'Tanzania';
	let tourFocus = [];
	let currency = form?.values?.currency ?? 'USD';
	let channels = ['WhatsApp'];
	let whatsapp = form?.values?.whatsapp ?? '';
	let fullName = form?.values?.fullName ?? '';
	let email = form?.values?.email ?? '';
	let password = '';

	// If a submit failed, jump back to the account step to show the error.
	$: if (form?.error && stageIdx < STAGES.length - 1) stageIdx = STAGES.length - 1;

	$: stage = STAGES[stageIdx];
	$: progress = ((stageIdx + 1) / (STAGES.length + 1)) * 100;

	const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

	$: canContinue =
		stage.key === 'business'
			? brandName.trim() && description.trim().length > 10
			: stage.key === 'tours'
				? tourFocus.length > 0
				: stage.key === 'channels'
					? channels.length > 0 && whatsapp.trim()
					: stage.key === 'account'
						? fullName.trim() && /.+@.+\..+/.test(email) && password.length >= 8
						: true;

	function nextStep() {
		if (!canContinue || stage.key === 'account') return;
		stageIdx = Math.min(stageIdx + 1, STAGES.length - 1);
	}
	function back() {
		stageIdx = Math.max(stageIdx - 1, 0);
	}

	const submit = () => {
		submitting = true;
		return async ({ update }) => {
			await update(); // follows the redirect on success; sets `form` on failure
			submitting = false;
		};
	};
</script>

<svelte:head>
	<title>Get started — Makutano AI</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="ob">
	<header class="ob-top">
		<div class="ob-bar">
			<a class="brand" href="/">
				<img src="/ICON-AI.png" alt="" />
				<span>Makutano&nbsp;AI</span>
			</a>
			<div class="step-count">Step {stageIdx + 1} of {STAGES.length}</div>
		</div>
		<div class="track"><div class="fill" style="width:{progress}%"></div></div>
	</header>

	<div class="ob-grid">
		<!-- Stepper -->
		<ol class="stepper">
			{#each STAGES as s, i}
				{@const state = i < stageIdx ? 'done' : i === stageIdx ? 'current' : 'upcoming'}
				<li class="stp {state}">
					<span class="stp-n">{state === 'done' ? '✓' : i + 1}</span>
					<div>
						<div class="stp-l">{s.label}</div>
						<div class="stp-h">{s.hint}</div>
					</div>
				</li>
			{/each}
		</ol>

		<!-- Panel -->
		<form class="panel" method="POST" action="?/signup" use:enhance={submit}>
			<!-- Hidden fields carry all collected state to the action -->
			<input type="hidden" name="brandName" value={brandName} />
			<input type="hidden" name="description" value={description} />
			<input type="hidden" name="region" value={region} />
			<input type="hidden" name="tourFocus" value={tourFocus.join(', ')} />
			<input type="hidden" name="currency" value={currency} />
			<input type="hidden" name="channels" value={channels.join(', ')} />
			<input type="hidden" name="whatsapp" value={whatsapp} />
			<input type="hidden" name="fullName" value={fullName} />
			<input type="hidden" name="email" value={email} />
			<input type="hidden" name="password" value={password} />
			<input type="text" name="company_website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true" />

			{#if form?.error}<div class="err">{form.error}</div>{/if}

			{#if stage.key === 'business'}
				<div class="eyebrow">Step 1 · Your business</div>
				<h1>Tell us about your tour business</h1>
				<p class="desc">Your assistant will speak in your voice using this context.</p>
				<div class="fields">
					<label>Business name<input bind:value={brandName} placeholder="e.g. Kilima Safaris" /></label>
					<label>What do you do?<textarea rows="3" bind:value={description} placeholder="Describe your tours, style, and where you operate…"></textarea></label>
					<div>
						<div class="mini">Try one</div>
						<div class="tags">
							{#each SUGGESTIONS as s}
								<button type="button" class="tag" class:on={description === s} on:click={() => (description = s)}>{s}</button>
							{/each}
						</div>
					</div>
					<label>Primary region<select bind:value={region}>{#each REGIONS as r}<option>{r}</option>{/each}</select></label>
				</div>
			{:else if stage.key === 'tours'}
				<div class="eyebrow">Step 2 · Your tours</div>
				<h1>What kinds of tours do you sell?</h1>
				<p class="desc">Pick everything that applies — you can upload the full catalogue later.</p>
				<div class="fields">
					<div>
						<div class="mini">Tour focus</div>
						<div class="chips">
							{#each FOCUS as f}
								<button type="button" class="chip" class:on={tourFocus.includes(f)} on:click={() => (tourFocus = toggle(tourFocus, f))}>{tourFocus.includes(f) ? '✓ ' : ''}{f}</button>
							{/each}
						</div>
					</div>
					<label>Default currency<select bind:value={currency}>{#each CURRENCIES as c}<option>{c}</option>{/each}</select></label>
					<div class="note">📎 <b>Upload later:</b> CSV, JSON, or paste your itineraries — add them from your dashboard once you're in.</div>
				</div>
			{:else if stage.key === 'channels'}
				<div class="eyebrow">Step 3 · Channels</div>
				<h1>Where should customers reach you?</h1>
				<p class="desc">Booking-ready leads always land in your WhatsApp.</p>
				<div class="fields">
					<div>
						<div class="mini">Enabled channels</div>
						<div class="ch-grid">
							{#each CHANNELS as c}
								<button type="button" class="ch" class:on={channels.includes(c)} on:click={() => (channels = toggle(channels, c))}>
									<span>{c}</span>
									<span class="ch-dot" class:on={channels.includes(c)}></span>
								</button>
							{/each}
						</div>
					</div>
					<label>WhatsApp number for handoff<input bind:value={whatsapp} placeholder="+255 712 345 678" inputmode="tel" /></label>
				</div>
			{:else if stage.key === 'account'}
				<div class="eyebrow">Step 4 · Create account</div>
				<h1>One last thing — create your account</h1>
				<p class="desc">We'll save your setup and take you straight to your dashboard.</p>
				<div class="fields">
					<label>Your full name<input bind:value={fullName} placeholder="Amina Njoroge" autocomplete="name" /></label>
					<label>Work email<input type="email" bind:value={email} placeholder="you@yourcompany.com" autocomplete="username" /></label>
					<label>Password<input type="password" bind:value={password} placeholder="At least 8 characters" autocomplete="new-password" /></label>
					<p class="terms">By creating an account you agree to our terms & privacy policy. No credit card required.</p>
				</div>
			{/if}

			<div class="actions">
				<button type="button" class="back" on:click={back} disabled={stageIdx === 0 || submitting}>← Back</button>
				{#if stage.key === 'account'}
					<button type="submit" class="go" disabled={!canContinue || submitting}>
						{submitting ? 'Creating your account…' : 'Create account & finish'}
					</button>
				{:else}
					<button type="button" class="go" on:click={nextStep} disabled={!canContinue}>Continue →</button>
				{/if}
			</div>
		</form>
	</div>

	<p class="signin-foot">Already have an account? <a href="/login">Sign in</a></p>
</div>

<style>
	.ob {
		--forest: #10362a;
		--forest-2: #0c2c22;
		--gold: #e0b24c;
		--gold-soft: #ecca7d;
		--gold-ink: #23180a;
		--cream: #f7f2e8;
		min-height: 100vh;
		background: radial-gradient(80% 60% at 80% -10%, rgba(224, 178, 76, 0.14), transparent 55%), linear-gradient(170deg, var(--forest), var(--forest-2) 70%, #0a231b);
		color: var(--cream);
		font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
		-webkit-font-smoothing: antialiased;
		letter-spacing: -0.011em;
	}
	.ob :global(a) {
		color: inherit;
		text-decoration: none;
	}
	.ob :global(h1),
	.ob :global(b),
	.ob :global(strong) {
		color: inherit;
	}
	.ob :global(input),
	.ob :global(textarea),
	.ob :global(select) {
		color-scheme: dark;
	}

	.ob-top {
		border-bottom: 1px solid rgba(247, 242, 232, 0.1);
	}
	.ob-bar {
		max-width: 1060px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.1rem 1.5rem;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-weight: 660;
		font-size: 0.95rem;
	}
	.brand img {
		width: 32px;
		height: 32px;
		border-radius: 9px;
	}
	.step-count {
		font-size: 0.78rem;
		color: rgba(247, 242, 232, 0.6);
	}
	.track {
		height: 4px;
		background: rgba(247, 242, 232, 0.1);
	}
	.fill {
		height: 100%;
		background: var(--gold);
		transition: width 0.5s ease;
	}

	.ob-grid {
		max-width: 1060px;
		margin: 0 auto;
		display: grid;
		gap: 2.5rem;
		padding: 3rem 1.5rem 1.5rem;
	}
	@media (min-width: 820px) {
		.ob-grid {
			grid-template-columns: 240px 1fr;
			padding: 4rem 1.5rem 2rem;
		}
	}

	.stepper {
		display: none;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	@media (min-width: 820px) {
		.stepper {
			display: flex;
		}
	}
	.stp {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		border: 1px solid rgba(247, 242, 232, 0.1);
		border-radius: 12px;
		padding: 0.75rem;
	}
	.stp.current {
		border-color: var(--gold);
		background: rgba(224, 178, 76, 0.1);
	}
	.stp.done {
		border-color: rgba(247, 242, 232, 0.15);
		background: rgba(247, 242, 232, 0.05);
	}
	.stp-n {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		flex: none;
		border-radius: 50%;
		font-size: 0.7rem;
		font-weight: 700;
		border: 1px solid rgba(247, 242, 232, 0.2);
		color: rgba(247, 242, 232, 0.5);
	}
	.stp.current .stp-n {
		background: var(--gold);
		color: var(--gold-ink);
		border-color: var(--gold);
	}
	.stp.done .stp-n {
		background: rgba(247, 242, 232, 0.2);
		color: var(--cream);
		border-color: transparent;
	}
	.stp-l {
		font-size: 0.88rem;
		font-weight: 550;
	}
	.stp-h {
		font-size: 0.75rem;
		color: rgba(247, 242, 232, 0.5);
	}

	.panel {
		border: 1px solid rgba(247, 242, 232, 0.1);
		background: rgba(247, 242, 232, 0.03);
		border-radius: 24px;
		padding: 1.6rem;
	}
	@media (min-width: 640px) {
		.panel {
			padding: 2.5rem;
		}
	}
	.eyebrow {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--gold);
	}
	.panel h1 {
		margin: 0.75rem 0 0;
		font-size: clamp(1.5rem, 3vw, 2.1rem);
		font-weight: 640;
		line-height: 1.15;
	}
	.desc {
		margin: 0.75rem 0 0;
		color: rgba(247, 242, 232, 0.7);
		font-size: 0.98rem;
	}
	.err {
		margin-bottom: 1.2rem;
		background: rgba(255, 120, 120, 0.12);
		border: 1px solid rgba(255, 120, 120, 0.35);
		color: #ffc9c9;
		border-radius: 12px;
		padding: 0.7rem 0.9rem;
		font-size: 0.9rem;
	}
	.fields {
		margin-top: 2rem;
		display: grid;
		gap: 1.25rem;
	}
	.fields label {
		display: block;
	}
	.fields label {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(247, 242, 232, 0.6);
	}
	.fields input,
	.fields textarea,
	.fields select {
		display: block;
		width: 100%;
		margin-top: 0.5rem;
		border: 1px solid rgba(247, 242, 232, 0.15);
		background: rgba(16, 54, 42, 0.6);
		color: var(--cream);
		border-radius: 12px;
		padding: 0.8rem 1rem;
		font: inherit;
		font-size: 1rem;
		text-transform: none;
		letter-spacing: normal;
		outline: none;
	}
	.fields input::placeholder,
	.fields textarea::placeholder {
		color: rgba(247, 242, 232, 0.3);
	}
	.fields input:focus,
	.fields textarea:focus,
	.fields select:focus {
		border-color: var(--gold);
	}
	.hp {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.mini {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(247, 242, 232, 0.55);
		margin-bottom: 0.75rem;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.tag {
		border: 1px solid rgba(247, 242, 232, 0.15);
		background: transparent;
		color: rgba(247, 242, 232, 0.7);
		border-radius: 999px;
		padding: 0.4rem 0.75rem;
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}
	.tag:hover {
		border-color: rgba(247, 242, 232, 0.3);
	}
	.tag.on {
		border-color: var(--gold);
		background: rgba(224, 178, 76, 0.15);
		color: var(--gold);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.chip {
		border: 1px solid rgba(247, 242, 232, 0.2);
		background: transparent;
		color: rgba(247, 242, 232, 0.8);
		border-radius: 999px;
		padding: 0.5rem 1rem;
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.15s;
	}
	.chip:hover {
		border-color: rgba(247, 242, 232, 0.4);
	}
	.chip.on {
		border-color: var(--gold);
		background: var(--gold);
		color: var(--gold-ink);
	}
	.ch-grid {
		display: grid;
		gap: 0.5rem;
	}
	@media (min-width: 560px) {
		.ch-grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.ch {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border: 1px solid rgba(247, 242, 232, 0.15);
		background: transparent;
		color: rgba(247, 242, 232, 0.7);
		border-radius: 12px;
		padding: 0.8rem 1rem;
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		text-align: left;
	}
	.ch.on {
		border-color: var(--gold);
		background: rgba(224, 178, 76, 0.1);
		color: var(--cream);
	}
	.ch-dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 1px solid rgba(247, 242, 232, 0.3);
	}
	.ch-dot.on {
		border-color: var(--gold);
		background: var(--gold);
	}
	.note {
		border: 1px dashed rgba(247, 242, 232, 0.2);
		background: rgba(247, 242, 232, 0.05);
		border-radius: 12px;
		padding: 1rem 1.1rem;
		font-size: 0.88rem;
		color: rgba(247, 242, 232, 0.7);
	}
	.note b {
		color: var(--cream);
	}
	.terms {
		font-size: 0.78rem;
		color: rgba(247, 242, 232, 0.5);
		margin: 0;
	}

	.actions {
		margin-top: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-top: 1px solid rgba(247, 242, 232, 0.1);
		padding-top: 1.5rem;
	}
	.back {
		background: transparent;
		border: 0;
		color: rgba(247, 242, 232, 0.7);
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0.5rem 0.5rem;
	}
	.back:hover:not(:disabled) {
		color: var(--cream);
	}
	.back:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.go {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--gold);
		color: var(--gold-ink);
		border: 0;
		border-radius: 999px;
		padding: 0.85rem 1.6rem;
		font: inherit;
		font-size: 0.92rem;
		font-weight: 650;
		cursor: pointer;
		transition: background 0.15s, transform 0.15s;
	}
	.go:hover:not(:disabled) {
		background: var(--gold-soft);
		transform: translateY(-1px);
	}
	.go:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.signin-foot {
		text-align: center;
		padding: 1rem 1.5rem 2.5rem;
		font-size: 0.88rem;
		color: rgba(247, 242, 232, 0.55);
	}
	.signin-foot a {
		color: var(--gold);
		font-weight: 600;
	}
</style>
