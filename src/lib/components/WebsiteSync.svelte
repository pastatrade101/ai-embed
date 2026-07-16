<script>
	// Website Knowledge Sync — operator connects their site; the assistant then
	// answers from live website pages alongside AI Knowledge. No crawler jargon.
	import { enhance } from '$app/forms';
	export let websiteUrl = '';
	export let items = [];
	export let health = null;
	export let conflicts = [];
	export let form = null;

	let url = websiteUrl || '';
	let scanning = false;
	let importing = false;
	let resolving = false;
	let selectedUrls = [];
	let seenScan = null;

	// The scan result comes back on `form`; reset the selection when a fresh scan
	// arrives (each scan action returns a new object), then leave it to the user.
	$: scan = form?.section === 'website' && form?.scan ? form.scan : null;
	$: if (scan && scan !== seenScan) {
		seenScan = scan;
		selectedUrls = scan.pages.map((p) => p.url);
	}
	$: allSelected = scan && selectedUrls.length === scan.pages.length;
	$: connected = (items ?? []).filter((i) => i?.metadata?.source === 'website');

	const toggle = (u) => (selectedUrls = selectedUrls.includes(u) ? selectedUrls.filter((x) => x !== u) : [...selectedUrls, u]);
	const toggleAll = () => (selectedUrls = allSelected ? [] : scan.pages.map((p) => p.url));

	const scanSubmit = () => {
		scanning = true;
		return async ({ update }) => {
			await update();
			scanning = false;
		};
	};
	const importSubmit = () => {
		importing = true;
		return async ({ update }) => {
			await update();
			importing = false;
		};
	};
	const resolveSubmit = () => {
		resolving = true;
		return async ({ update }) => {
			await update();
			resolving = false;
		};
	};

	function relTime(iso) {
		if (!iso) return '';
		const d = (Date.now() - new Date(iso).getTime()) / 1000;
		if (d < 60) return 'just now';
		if (d < 3600) return `${Math.floor(d / 60)}m ago`;
		if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
		return `${Math.floor(d / 86400)}d ago`;
	}
</script>

<section class="card ws">
	<div class="ws-head">
		<div>
			<h3>Website Knowledge Sync <span class="pill">Premium</span></h3>
			<p class="muted">Connect your website and your assistant answers from your live pages too — no copy-paste. Works with Wix, WordPress, Webflow, Squarespace &amp; custom sites.</p>
		</div>
		{#if connected.length}
			<div class="ws-stat"><b>{connected.length}</b><span>page{connected.length === 1 ? '' : 's'} connected</span></div>
		{/if}
	</div>

	{#if health && health.connected > 0}
		<div class="ws-health">
			<span class="wh"><span class="wh-dot"></span> Website connected</span>
			<span class="wh"><b>{health.connected}</b> page{health.connected === 1 ? '' : 's'} indexed</span>
			<span class="wh"><b>{health.lastSync ? relTime(health.lastSync) : '—'}</b> last sync</span>
			<span class="wh" class:warn={health.conflicts > 0}><b>{health.conflicts}</b> conflict{health.conflicts === 1 ? '' : 's'}</span>
		</div>
	{/if}

	{#if conflicts?.length}
		<div class="ws-conflicts">
			<div class="wc-head">⚠ Price mismatch detected — your website and AI Knowledge disagree. Review before customers see it.</div>
			{#each conflicts as c}
				<div class="wc-row">
					<div class="wc-title">{c.knowledge.title}</div>
					<div class="wc-vals">
						<span class="wc-val">Website <b>{c.currency} {c.website.amount.toLocaleString()}</b></span>
						<span class="wc-sep">vs</span>
						<span class="wc-val">AI Knowledge <b>{c.currency} {c.knowledge.amount.toLocaleString()}</b></span>
					</div>
					<form method="POST" action="?/resolveConflict" use:enhance={resolveSubmit} class="wc-actions">
						<input type="hidden" name="websiteId" value={c.website.id} />
						<input type="hidden" name="knowledgeId" value={c.knowledge.id} />
						<button class="btn sm" type="submit" name="action" value="useWebsite" disabled={resolving}>Use website</button>
						<button class="btn sm ghost" type="submit" name="action" value="keepKnowledge" disabled={resolving}>Keep AI Knowledge</button>
					</form>
				</div>
			{/each}
		</div>
	{/if}

	<form method="POST" action="?/scanWebsite" use:enhance={scanSubmit} class="ws-scan">
		<input name="url" type="url" bind:value={url} placeholder="https://yourbusiness.com" autocomplete="url" />
		<button class="btn" type="submit" disabled={scanning || !url.trim()}>{scanning ? 'Scanning…' : 'Scan website'}</button>
	</form>

	{#if form?.section === 'website' && form?.error}
		<div class="notice err">{form.error}</div>
	{/if}
	{#if form?.section === 'website' && form?.ok}
		<div class="notice">
			{form.ok}
			{#if form.failed?.length}
				<details class="ws-skipped"><summary>{form.failed.length} skipped</summary><ul>{#each form.failed as f}<li>{f}</li>{/each}</ul></details>
			{/if}
		</div>
	{/if}

	{#if scan}
		<div class="ws-preview">
			<div class="ws-summary">
				<b>Scan complete</b> — {scan.total} page{scan.total === 1 ? '' : 's'} found{#each Object.entries(scan.counts) as [cat, n]} · {n}
					{cat.toLowerCase()}{/each}
			</div>
			<label class="ws-selall"><input type="checkbox" checked={allSelected} on:change={toggleAll} /> Select all</label>
			<div class="ws-list">
				{#each scan.pages as p}
					<label class="ws-row" class:on={selectedUrls.includes(p.url)}>
						<input type="checkbox" checked={selectedUrls.includes(p.url)} on:change={() => toggle(p.url)} />
						<span class="ws-cat">{p.category}</span>
						<span class="ws-label">{p.label}</span>
						<span class="ws-url">{p.url}</span>
					</label>
				{/each}
			</div>
			<form method="POST" action="?/importWebsite" use:enhance={importSubmit} class="ws-approve">
				<input type="hidden" name="urls" value={JSON.stringify(selectedUrls)} />
				<button class="btn" type="submit" disabled={importing || !selectedUrls.length}>
					{importing ? 'Connecting…' : `Approve & connect ${selectedUrls.length} page${selectedUrls.length === 1 ? '' : 's'}`}
				</button>
				<span class="hint">Nothing goes live until you approve it.</span>
			</form>
		</div>
	{/if}

	{#if connected.length}
		<div class="ws-connected">
			<div class="ws-sub">Connected pages</div>
			{#each connected as c}
				<div class="ws-crow">
					<span class="ws-cat">{c.category ?? 'Page'}</span>
					<a class="ws-clabel" href={c.metadata?.source_url} target="_blank" rel="noopener">{c.title}</a>
					<span class="ws-sync">Synced {relTime(c.metadata?.last_synced)}</span>
				</div>
			{/each}
			<form method="POST" action="?/importWebsite" use:enhance={importSubmit}>
				<input type="hidden" name="urls" value={JSON.stringify(connected.map((c) => c.metadata?.source_url).filter(Boolean))} />
				<button class="btn ghost sm" type="submit" disabled={importing}>{importing ? 'Re-syncing…' : 'Re-sync all'}</button>
			</form>
		</div>
	{/if}
</section>

<style>
	.ws {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.ws-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.ws-head h3 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.05rem;
	}
	.ws-head .muted {
		margin: 0.35rem 0 0;
		font-size: 0.88rem;
		max-width: 52ch;
	}
	.pill {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold-ink, #23180a);
		background: var(--mint);
		border-radius: 999px;
		padding: 0.15rem 0.5rem;
	}
	.ws-stat {
		text-align: center;
		flex: none;
	}
	.ws-stat b {
		display: block;
		font-size: 1.5rem;
		color: var(--strong);
	}
	.ws-stat span {
		font-size: 0.72rem;
		color: var(--muted);
	}
	.ws-scan {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.ws-scan input {
		flex: 1;
		min-width: 220px;
	}
	.ws-health {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.2rem;
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: var(--panel-2);
		font-size: 0.82rem;
		color: var(--muted);
	}
	.wh b {
		color: var(--strong);
	}
	.wh {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.wh.warn b {
		color: var(--warn);
	}
	.wh-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--mint);
	}
	.ws-conflicts {
		border: 1px solid rgba(255, 181, 71, 0.4);
		background: rgba(255, 181, 71, 0.08);
		border-radius: 12px;
		padding: 0.8rem 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.wc-head {
		font-size: 0.86rem;
		font-weight: 600;
		color: var(--warn);
	}
	.wc-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		flex-wrap: wrap;
		border-top: 1px solid rgba(255, 181, 71, 0.2);
		padding-top: 0.6rem;
	}
	.wc-title {
		font-weight: 600;
		color: var(--strong);
		font-size: 0.9rem;
		flex: 1;
		min-width: 140px;
	}
	.wc-vals {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.wc-val b {
		color: var(--strong);
	}
	.wc-sep {
		color: var(--faint);
	}
	.wc-actions {
		display: inline-flex;
		gap: 0.5rem;
	}
	.ws-preview {
		border-top: 1px solid var(--edge);
		padding-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.ws-summary {
		font-size: 0.92rem;
		color: var(--body);
	}
	.ws-selall {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.82rem;
		color: var(--muted);
		cursor: pointer;
	}
	.ws-list {
		display: flex;
		flex-direction: column;
		max-height: 340px;
		overflow-y: auto;
		border: 1px solid var(--edge);
		border-radius: 12px;
	}
	.ws-row {
		display: grid;
		grid-template-columns: auto 96px 1fr;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.7rem;
		border-bottom: 1px solid var(--line-2);
		cursor: pointer;
		font-size: 0.85rem;
	}
	.ws-row:last-child {
		border-bottom: none;
	}
	.ws-row.on {
		background: rgba(var(--gold-rgb), 0.06);
	}
	.ws-cat {
		font-size: 0.66rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--mint);
		background: rgba(var(--gold-rgb), 0.12);
		border-radius: 999px;
		padding: 0.15rem 0.5rem;
		text-align: center;
		white-space: nowrap;
	}
	.ws-label {
		color: var(--strong);
		font-weight: 550;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ws-url {
		display: none;
	}
	.ws-approve {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		flex-wrap: wrap;
	}
	.ws-approve .hint {
		font-size: 0.78rem;
		color: var(--faint);
	}
	.ws-connected {
		border-top: 1px solid var(--edge);
		padding-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.ws-sub {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}
	.ws-crow {
		display: grid;
		grid-template-columns: 96px 1fr auto;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.85rem;
	}
	.ws-clabel {
		color: var(--body);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ws-sync {
		font-size: 0.74rem;
		color: var(--faint);
		white-space: nowrap;
	}
	.ws-skipped {
		margin-top: 0.4rem;
		font-size: 0.8rem;
	}
	.ws-skipped ul {
		margin: 0.3rem 0 0;
		padding-left: 1.1rem;
	}
	@media (min-width: 720px) {
		.ws-url {
			display: block;
			grid-column: 3;
			color: var(--faint);
			font-size: 0.74rem;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.ws-row {
			grid-template-columns: auto 96px minmax(0, 1fr) minmax(0, 1.3fr);
		}
	}
</style>
