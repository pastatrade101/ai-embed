<script>
	import { enhance } from '$app/forms';
	import ShareCard from '$lib/components/ShareCard.svelte';
	export let data; // data.client from the portal layout (select *)
	$: client = data.client;
	$: terms = data.industry?.terms ?? { item: 'tour', items: 'tours' };

	// All step fields live in one form and stay in the DOM (hidden via CSS) so a
	// single submit patches everything. Prefilled from current values.
	let step = 1;
	const TOTAL = 3;

	// Read initial values from data.client directly (the reactive `client` above
	// isn't assigned yet when these `let` initializers run).
	let name = data.client.name ?? '';
	let whatsapp_number = data.client.whatsapp_number ?? '';
	let contact_email = data.client.contact_email ?? '';
	let phone = data.client.phone ?? '';
	let address = data.client.address ?? '';
	let languages = data.client.languages ?? '';
	let logo_url = data.client.logo_url ?? '';
	let assistant_name = data.client.assistant_name ?? '';
	let welcome_message = data.client.welcome_message ?? '';
	let channel = 'none'; // client-side only — tailors the final screen

	let saving = false;
	let errorMsg = '';

	const CHANNELS = [
		{ id: 'website', label: 'I have a website', ico: 'globe' },
		{ id: 'instagram', label: 'Instagram', ico: 'ig' },
		{ id: 'whatsapp', label: 'WhatsApp', ico: 'wa' },
		{ id: 'facebook', label: 'Facebook', ico: 'fb' },
		{ id: 'google', label: 'Google Business Profile', ico: 'pin' },
		{ id: 'none', label: "I don't have a website", ico: 'spark' }
	];

	const TIPS = {
		website: 'Want a chat button on your website too? We’ll show you exactly how — one click below.',
		instagram: 'Paste your link into your Instagram bio so followers can chat and book in one tap.',
		whatsapp: 'Share your link on WhatsApp Status and send it to contacts — every chat becomes a qualified lead.',
		facebook: 'Add the link to your Facebook page button and posts.',
		google: 'Add the link to your Google Business Profile so people who find you on Maps can chat instantly.',
		none: "No website? Perfect — this page is all you need. Share the link or print the QR anywhere."
	};

	function next() {
		if (step === 1 && !name.trim()) {
			errorMsg = 'Please enter your business name.';
			return;
		}
		errorMsg = '';
		if (step < TOTAL) step += 1;
	}
	function back() {
		errorMsg = '';
		if (step > 1) step -= 1;
	}
</script>

<div class="wz-wrap">
	{#if step <= TOTAL}
		<div class="card wz">
			<div class="wz-top">
				<div class="wz-steps">
					{#each Array(TOTAL) as _, i}
						<span class="wz-dot" class:active={i + 1 === step} class:done={i + 1 < step}></span>
					{/each}
				</div>
				<span class="faint mono" style="font-size:.78rem">Step {step} of {TOTAL}</span>
			</div>

			{#if errorMsg}<div class="notice err" style="margin-bottom:1rem">{errorMsg}</div>{/if}

			<form
				method="POST"
				action="?/save"
				use:enhance={() => {
					saving = true;
					return async ({ result, update }) => {
						saving = false;
						await update({ reset: false });
						if (result.type === 'success') {
							step = TOTAL + 1; // success / go-live screen
						} else if (result.type === 'failure') {
							errorMsg = result.data?.error ?? 'Something went wrong. Please try again.';
						}
					};
				}}
			>
				<!-- Step 1 — Business information -->
				<section class="wz-step" class:hidden={step !== 1}>
					<h1 class="wz-h">Tell us about your business</h1>
					<p class="wz-sub">This is what your assistant uses to greet and help customers.</p>

					<label for="wz-name">Business name</label>
					<input id="wz-name" name="name" bind:value={name} placeholder="e.g. Emnel Adventures" required />

					<div class="row">
						<div>
							<label for="wz-wa">WhatsApp number</label>
							<input id="wz-wa" name="whatsapp_number" bind:value={whatsapp_number} placeholder="+255 7XX XXX XXX" />
							<div class="hint">Where the assistant sends you leads.</div>
						</div>
						<div>
							<label for="wz-email">Contact email</label>
							<input id="wz-email" name="contact_email" type="email" bind:value={contact_email} placeholder="you@business.com" />
						</div>
					</div>
					<div class="row">
						<div>
							<label for="wz-phone">Phone (optional)</label>
							<input id="wz-phone" name="phone" bind:value={phone} placeholder="+255 ..." />
						</div>
						<div>
							<label for="wz-lang">Languages (optional)</label>
							<input id="wz-lang" name="languages" bind:value={languages} placeholder="English, Swahili" />
						</div>
					</div>
					<label for="wz-addr">City / location (optional)</label>
					<input id="wz-addr" name="address" bind:value={address} placeholder="Arusha, Tanzania" />
				</section>

				<!-- Step 2 — Where do customers find you -->
				<section class="wz-step" class:hidden={step !== 2}>
					<h1 class="wz-h">Where do your customers find you?</h1>
					<p class="wz-sub">We'll set up the easiest way for you to go live.</p>
					<div class="wz-channels">
						{#each CHANNELS as c}
							<label class="wz-channel" class:sel={channel === c.id}>
								<input type="radio" name="_channel" value={c.id} bind:group={channel} />
								<span class="wz-channel-label">{c.label}</span>
								{#if channel === c.id}
									<svg class="wz-channel-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
								{/if}
							</label>
						{/each}
					</div>
				</section>

				<!-- Step 3 — Personalize -->
				<section class="wz-step" class:hidden={step !== 3}>
					<h1 class="wz-h">Personalize your assistant</h1>
					<p class="wz-sub">Give it a name and a friendly greeting. You can change these anytime in Settings.</p>

					<div class="row">
						<div>
							<label for="wz-aname">Assistant name (optional)</label>
							<input id="wz-aname" name="assistant_name" bind:value={assistant_name} placeholder="e.g. Amani" />
						</div>
						<div>
							<label for="wz-logo">Logo URL (optional)</label>
							<input id="wz-logo" name="logo_url" bind:value={logo_url} placeholder="https://.../logo.png" />
						</div>
					</div>
					<label for="wz-welcome">Welcome message (optional)</label>
					<textarea id="wz-welcome" name="welcome_message" bind:value={welcome_message} rows="3" placeholder={`Hi! 👋 Ask me anything about our ${terms.items} and I'll help you.`}></textarea>
				</section>

				<div class="wz-nav">
					{#if step > 1}
						<button type="button" class="ghost" on:click={back}>Back</button>
					{:else}
						<a class="btn ghost" href="/portal">Skip for now</a>
					{/if}
					<div class="wz-nav-r">
						{#if step < TOTAL}
							<button type="button" on:click={next}>Continue</button>
						{:else}
							<button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Finish & go live'}</button>
						{/if}
					</div>
				</div>
			</form>
		</div>
	{:else}
		<!-- Step 4 — You're live -->
		<div class="card wz wz-success-head">
			<span class="wz-badge">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
			</span>
			<h1 class="wz-h" style="margin:.6rem 0 .2rem">You're live, {client.name}! 🎉</h1>
			<p class="wz-sub" style="margin:0">{TIPS[channel] ?? TIPS.none}</p>
		</div>

		<ShareCard slug={client.slug} name={client.name} />

		<div class="wz-done-actions">
			{#if channel === 'website'}
				<a class="btn" href="/portal/install">Add to your website</a>
				<a class="btn ghost" href="/portal">Go to dashboard</a>
			{:else}
				<a class="btn" href="/portal">Go to dashboard</a>
				<a class="btn ghost" href="/portal/knowledge">Add more {terms.items}</a>
			{/if}
		</div>
	{/if}
</div>

<style>
	.wz-wrap {
		max-width: 640px;
		margin: 0 auto;
	}
	.wz {
		padding: 1.5rem 1.6rem;
	}
	.wz-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.4rem;
	}
	.wz-steps {
		display: flex;
		gap: 0.4rem;
	}
	.wz-dot {
		width: 30px;
		height: 5px;
		border-radius: 99px;
		background: var(--edge);
		transition: background 0.2s;
	}
	.wz-dot.active,
	.wz-dot.done {
		background: var(--mint);
	}
	.wz-step.hidden {
		display: none;
	}
	.wz-h {
		font-size: 1.35rem;
		margin: 0 0 0.3rem;
		letter-spacing: -0.02em;
		color: var(--strong);
	}
	.wz-sub {
		color: var(--muted);
		font-size: 0.92rem;
		margin: 0 0 1.3rem;
	}
	.wz-step label {
		margin-top: 0.9rem;
	}
	.wz-step .row label {
		margin-top: 0;
	}
	.wz-step .row {
		margin-top: 0.9rem;
	}

	.wz-channels {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.wz-channel {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: var(--panel-2);
		cursor: pointer;
		margin: 0;
		transition: border-color 0.14s, background 0.14s;
	}
	.wz-channel:hover {
		border-color: rgba(var(--gold-rgb), 0.35);
	}
	.wz-channel.sel {
		border-color: var(--mint);
		background: rgba(var(--gold-rgb), 0.1);
	}
	.wz-channel input {
		width: auto;
		accent-color: var(--mint);
		flex-shrink: 0;
	}
	.wz-channel-label {
		flex: 1;
		font-weight: 600;
		color: var(--soft);
		font-size: 0.95rem;
	}
	.wz-channel.sel .wz-channel-label {
		color: var(--strong);
	}
	.wz-channel-check {
		width: 17px;
		height: 17px;
		color: var(--mint);
		flex-shrink: 0;
	}

	.wz-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 1.6rem;
		gap: 0.75rem;
	}
	.wz-nav-r {
		margin-left: auto;
	}

	.wz-success-head {
		text-align: center;
		margin-bottom: 0.85rem;
	}
	.wz-badge {
		display: inline-grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: rgba(var(--gold-rgb), 0.16);
		border: 1px solid rgba(var(--gold-rgb), 0.4);
		color: var(--mint);
	}
	.wz-badge svg {
		width: 26px;
		height: 26px;
	}
	.wz-done-actions {
		display: flex;
		gap: 0.6rem;
		justify-content: center;
		margin-top: 1rem;
		flex-wrap: wrap;
	}
</style>
