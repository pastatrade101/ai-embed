<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	export let data; // data.client (layout) + data.guides (page load)
	$: client = data.client;

	const ORDER = ['wordpress', 'wix', 'squarespace', 'shopify', 'webflow', 'godaddy', 'other'];

	let website = data.client.website_url ?? '';
	let selectedPlatform = 'other';
	let detectedPlatform = null;

	let detecting = false;
	let detectError = '';

	let checking = false;
	let checkResult = null; // { status, message }

	let sending = false;
	let devSentTo = '';
	let devError = '';

	let copied = false;

	$: guide = data.guides[selectedPlatform] ?? data.guides.other;
	// `<\/script>` so this literal doesn't close the Svelte <script> block.
	$: snippet = `<script src="${$page.url.origin}/widget.js" data-client="${client.slug}"><\/script>`;

	async function copySnippet() {
		try {
			await navigator.clipboard.writeText(snippet);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch (e) {}
	}

	const detectEnhance = () => {
		detecting = true;
		detectError = '';
		return async ({ result }) => {
			detecting = false;
			if (result.type === 'success') {
				detectedPlatform = result.data.platform;
				selectedPlatform = result.data.platform;
				if (result.data.url) website = result.data.url;
			} else if (result.type === 'failure') {
				detectError = result.data?.error ?? 'Could not detect your platform.';
			}
		};
	};

	const checkEnhance = () => {
		checking = true;
		checkResult = null;
		return async ({ result }) => {
			checking = false;
			const d = result.data ?? {};
			checkResult = { status: d.status ?? 'missing', message: d.error ?? d.message ?? null };
		};
	};

	const sendEnhance = () => {
		sending = true;
		devError = '';
		devSentTo = '';
		return async ({ result }) => {
			sending = false;
			if (result.type === 'success') devSentTo = result.data.to;
			else devError = result.data?.error ?? 'Could not send the email.';
		};
	};
</script>

<div class="page-head">
	<div>
		<h1>Add to your website</h1>
		<div class="sub">Optional — your shareable link and QR already work without a website. This adds a chat button to a site you own.</div>
	</div>
	<div class="actions"><a class="btn ghost sm" href="/portal">← Back to dashboard</a></div>
</div>

<!-- 1. Detect -->
<div class="card">
	<h2 class="section" style="margin:0">What’s your website?</h2>
	<p class="muted" style="margin:.3rem 0 .9rem">We’ll figure out your platform and show the exact steps.</p>
	<form method="POST" action="?/detect" class="inst-row" use:enhance={detectEnhance}>
		<input name="url" bind:value={website} placeholder="yourbusiness.com" autocomplete="off" />
		<button type="submit" disabled={detecting}>{detecting ? 'Checking…' : 'Detect platform'}</button>
	</form>
	{#if detectError}<div class="notice err" style="margin:.8rem 0 0">{detectError}</div>{/if}
	{#if detectedPlatform}
		<div class="inst-detected">
			{#if detectedPlatform === 'other'}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
				<span>We couldn’t identify your platform — use the <b>Custom HTML</b> steps below, or send it to your web person.</span>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
				<span>Looks like <b>{data.guides[detectedPlatform]?.name ?? detectedPlatform}</b>. We’ve selected the right guide below.</span>
			{/if}
		</div>
	{/if}
</div>

<!-- 2. Code + guide -->
<div class="card">
	<h2 class="section" style="margin:0">1. Copy your code</h2>
	<p class="muted" style="margin:.3rem 0 .7rem">The same snippet works everywhere — you paste it once.</p>
	<pre class="code-block">{snippet}</pre>
	<button class="ghost sm" on:click={copySnippet}>{copied ? 'Copied!' : 'Copy code'}</button>

	<h2 class="section">2. Paste it into your site</h2>
	<div class="inst-tabs">
		{#each ORDER as p}
			<button class="inst-tab" class:active={selectedPlatform === p} on:click={() => (selectedPlatform = p)} type="button">
				{data.guides[p]?.name ?? p}
			</button>
		{/each}
	</div>

	<div class="inst-guide">
		<div class="inst-guide-head">
			<b>{guide.name}</b>
			<span class="badge neutral">≈ {guide.time}</span>
		</div>
		<ol class="inst-steps">
			{#each guide.steps as s}<li>{s}</li>{/each}
		</ol>
		{#if guide.note}<div class="inst-note">{guide.note}</div>{/if}
	</div>
</div>

<!-- 3. Send to developer -->
<div class="card">
	<h2 class="section" style="margin:0">Not doing it yourself?</h2>
	<p class="muted" style="margin:.3rem 0 .9rem">We’ll email your web person the code and step-by-step instructions.</p>
	{#if devSentTo}
		<div class="notice">Sent to <b>{devSentTo}</b> — they have everything they need. 🎉</div>
	{:else}
		<form method="POST" action="?/sendDev" class="inst-row" use:enhance={sendEnhance}>
			<input name="devEmail" type="email" placeholder="developer@email.com" autocomplete="off" />
			<input type="hidden" name="url" value={website} />
			<input type="hidden" name="platform" value={selectedPlatform} />
			<button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send instructions'}</button>
		</form>
		{#if devError}<div class="notice err" style="margin:.8rem 0 0">{devError}</div>{/if}
	{/if}
</div>

<!-- 4. Check install -->
<div class="card">
	<h2 class="section" style="margin:0">Check it’s working</h2>
	<p class="muted" style="margin:.3rem 0 .9rem">Once you’ve pasted the code and published, verify it’s live.</p>
	<form method="POST" action="?/check" class="inst-row" use:enhance={checkEnhance}>
		<input name="url" bind:value={website} placeholder="yourbusiness.com" autocomplete="off" />
		<button type="submit" class="ghost" disabled={checking}>{checking ? 'Checking…' : 'Check installation'}</button>
	</form>
	{#if checkResult}
		{#if checkResult.status === 'installed'}
			<div class="inst-result ok">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
				<div><b>Your assistant is live!</b><div class="muted" style="font-size:.85rem">The chat button is on your website and ready for customers.</div></div>
			</div>
		{:else}
			<div class="inst-result warn">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
				<div><b>{checkResult.status === 'wrong-id' ? 'Almost there' : 'Not detected yet'}</b><div class="muted" style="font-size:.85rem">{checkResult.message}</div></div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.inst-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.inst-row input {
		flex: 1;
		min-width: 200px;
	}
	.inst-row button {
		flex-shrink: 0;
	}
	.inst-detected {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.9rem;
		padding: 0.7rem 0.9rem;
		border-radius: 12px;
		background: rgba(var(--gold-rgb), 0.08);
		border: 1px solid rgba(var(--gold-rgb), 0.22);
		font-size: 0.9rem;
		color: var(--soft);
	}
	.inst-detected svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: var(--mint);
	}
	.inst-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}
	.inst-tab {
		background: rgba(var(--fg-rgb), 0.02);
		border: 1px solid var(--edge);
		color: var(--muted);
		font-size: 0.85rem;
		font-weight: 600;
		padding: 0.4rem 0.75rem;
		border-radius: 99px;
		cursor: pointer;
	}
	.inst-tab:hover {
		color: var(--strong);
		border-color: rgba(var(--gold-rgb), 0.3);
		background: rgba(var(--fg-rgb), 0.02);
	}
	.inst-tab.active {
		background: rgba(var(--gold-rgb), 0.14);
		border-color: rgba(var(--gold-rgb), 0.4);
		color: var(--mint);
	}
	.inst-guide {
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: var(--panel-2);
		padding: 1rem 1.1rem 1.1rem;
	}
	.inst-guide-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.6rem;
	}
	.inst-steps {
		margin: 0;
		padding-left: 1.3rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.inst-steps li {
		color: var(--soft);
		font-size: 0.92rem;
		line-height: 1.5;
		padding-left: 0.2rem;
	}
	.inst-note {
		margin-top: 0.9rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--line-2);
		font-size: 0.83rem;
		color: var(--faint);
		line-height: 1.5;
	}
	.inst-result {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin-top: 0.9rem;
		padding: 0.8rem 1rem;
		border-radius: 12px;
	}
	.inst-result svg {
		width: 26px;
		height: 26px;
		flex-shrink: 0;
	}
	.inst-result.ok {
		background: rgba(var(--gold-rgb), 0.1);
		border: 1px solid rgba(var(--gold-rgb), 0.3);
	}
	.inst-result.ok svg {
		color: var(--mint);
	}
	.inst-result.warn {
		background: rgba(255, 181, 71, 0.1);
		border: 1px solid rgba(255, 181, 71, 0.3);
	}
	.inst-result.warn svg {
		color: var(--warn);
	}
</style>
