<script>
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	export let items = [];
	export let departures = {};
	export let questions = [];
	export let slug = '';
	export let form = null;

	const isTour = (item) => (item.category ?? '').toLowerCase().includes('tour');
	const depsOf = (item) => departures[item.id] ?? [];

	// Quick-add categories (the stored category is free text; these just pre-fill).
	const ADD_TYPES = ['Tour', 'Destination', 'Day Trip', 'Climb', 'Accommodation', 'Transport', 'FAQ', 'Policy', 'Travel Tip'];

	let search = '';
	let filter = 'all';
	let editing = null;
	let showImport = false;
	let adding = false;
	let addMenuOpen = false;

	// Add-form fields (bound so presets / customer questions can pre-fill them).
	let newTitle = '';
	let newCategory = '';
	let newPrice = '';
	let newCurrency = 'USD';
	let newDetails = '';
	let newBody = '';
	let addForm;

	$: categories = ['all', ...Array.from(new Set(items.map((i) => (i.category ?? '').trim()).filter(Boolean).map((c) => c.toLowerCase())))];
	const titleCase = (s) => s.replace(/\b\w/g, (m) => m.toUpperCase());

	$: q = search.trim().toLowerCase();
	$: filtered = items.filter((it) => {
		if (filter !== 'all' && (it.category ?? '').toLowerCase() !== filter) return false;
		if (!q) return true;
		const hay = `${it.title} ${it.category ?? ''} ${it.body ?? ''} ${JSON.stringify(it.metadata ?? {})}`.toLowerCase();
		return hay.includes(q);
	});

	const metaVal = (md, ...keys) => {
		if (!md || typeof md !== 'object' || Array.isArray(md)) return null;
		for (const k of Object.keys(md)) {
			if (keys.some((w) => k.toLowerCase().includes(w))) {
				const v = md[k];
				if (v != null && String(v).trim()) return Array.isArray(v) ? v.join(', ') : String(v);
			}
		}
		return null;
	};

	function ago(iso) {
		if (!iso) return '—';
		const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
		if (days <= 0) return 'today';
		if (days === 1) return 'yesterday';
		if (days < 30) return `${days} days ago`;
		const months = Math.floor(days / 30);
		if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
		return `${Math.floor(months / 12)}y ago`;
	}
	const isStale = (iso) => iso && Date.now() - new Date(iso).getTime() > 180 * 86400000;

	// Metadata → "Key: value" lines for the edit form.
	function mdText(md) {
		if (!md || typeof md !== 'object' || Array.isArray(md)) return '';
		return Object.entries(md)
			.filter(([, v]) => v != null && v !== '')
			.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
			.join('\n');
	}

	async function startAdd(type) {
		adding = true;
		addMenuOpen = false;
		newCategory = type === 'Other' ? '' : type;
		await tick();
		addForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		addForm?.querySelector('input[name="title"]')?.focus();
	}
	async function startAnswer(question) {
		newTitle = question;
		newCategory = 'FAQ';
		adding = true;
		await tick();
		addForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		addForm?.querySelector('textarea[name="body"]')?.focus();
	}

	const closeAfter = () => async ({ update }) => {
		await update();
		editing = null;
	};
	const addEnhance = () => async ({ result, update }) => {
		await update({ reset: false });
		if (result.type === 'success' && !result.data?.error) {
			adding = false;
			newTitle = newPrice = newDetails = newBody = newCategory = '';
			newCurrency = 'USD';
		}
	};

	const csvExample = `title,category,price,currency,body,duration,group_size,includes,best_season
"5-Day Serengeti Safari",tour,1450,USD,"Northern circuit itinerary…","5 days","max 6","park fees, meals, guide","Jun–Oct"`;
</script>

<!-- Toolbar: search + filters + add ---------------------------------------->
<div class="kb-toolbar">
	<div class="kb-search">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
		<input type="text" bind:value={search} placeholder="Search tours, FAQs, destinations…" aria-label="Search knowledge" />
	</div>
	<div class="kb-actions">
		{#if slug}<a class="btn ghost sm" href={`/c/${slug}`} target="_blank" rel="noopener">Test your AI</a>{/if}
		<div class="add-wrap">
			<button class="sm add-btn" on:click={() => (addMenuOpen = !addMenuOpen)} aria-expanded={addMenuOpen}>
				<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
				Add knowledge
			</button>
			{#if addMenuOpen}
				<button type="button" class="add-backdrop" on:click={() => (addMenuOpen = false)} aria-label="Close"></button>
				<div class="add-menu">
					{#each ADD_TYPES as t}<button type="button" on:click={() => startAdd(t)}>Add {t}</button>{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

{#if categories.length > 1}
	<div class="kb-chips">
		{#each categories as c}
			<button type="button" class="kb-chip" class:on={filter === c} on:click={() => (filter = c)}>
				{c === 'all' ? 'All' : titleCase(c)}
				{#if c !== 'all'}<span class="chip-n">{items.filter((i) => (i.category ?? '').toLowerCase() === c).length}</span>{/if}
			</button>
		{/each}
	</div>
{/if}

<!-- Notices ---------------------------------------------------------------->
{#if form?.section === 'item' || form?.section === 'departure' || form?.section === 'import'}
	{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}
		<div class="notice">{form.ok}{#if form?.failed?.length}<ul style="margin:.4rem 0 0;padding-left:1.1rem">{#each form.failed as f}<li>{f}</li>{/each}</ul>{/if}</div>
	{/if}
{/if}

<!-- What customers ask about ----------------------------------------------->
{#if questions.length}
	<div class="card">
		<h2 class="section" style="margin:0 0 .2rem">Frequently asked by customers</h2>
		<p class="muted" style="font-size:.85rem;margin:0 0 .8rem">Real questions from your chats. Add an answer so your AI always has one ready.</p>
		<div class="q-list">
			{#each questions as item}
				<div class="q-row">
					<span class="q-text">{item.q}{#if item.count > 1}<span class="q-count">×{item.count}</span>{/if}</span>
					<button class="btn ghost sm" type="button" on:click={() => startAnswer(item.q)}>Add answer</button>
				</div>
			{/each}
		</div>
	</div>
{/if}

<!-- Add form (revealed) ---------------------------------------------------->
{#if adding}
	<div class="card add-card" bind:this={addForm}>
		<div class="rowflex" style="justify-content:space-between">
			<h2 class="section" style="margin:0">Add {newCategory || 'knowledge'}</h2>
			<button class="ghost sm" type="button" on:click={() => (adding = false)}>Cancel</button>
		</div>
		<form class="grid" method="POST" action="?/addItem" use:enhance={addEnhance} style="margin-top:.8rem">
			<div class="row">
				<div><label for="new-title">Name</label><input id="new-title" name="title" bind:value={newTitle} required placeholder="e.g. 5-Day Serengeti & Ngorongoro Safari" /></div>
				<div><label for="new-cat">Category</label><input id="new-cat" name="category" bind:value={newCategory} placeholder="Tour" /></div>
			</div>
			<div class="row">
				<div><label for="new-price">Price (optional)</label><input id="new-price" name="price_amount" bind:value={newPrice} inputmode="decimal" placeholder="1450" /></div>
				<div><label for="new-cur">Currency</label><input id="new-cur" name="price_currency" bind:value={newCurrency} style="max-width:120px" /></div>
			</div>
			<div><label for="new-details">Key details (one per line)</label><textarea id="new-details" name="details" bind:value={newDetails} style="min-height:88px" placeholder={'Duration: 5 days\nGroup size: max 6\nIncludes: park fees, meals, guide\nBest season: Jun–Oct'}></textarea></div>
			<div><label for="new-body">Description</label><textarea id="new-body" name="body" bind:value={newBody} placeholder="Full itinerary, what's included, fitness level, best months…"></textarea></div>
			<div><button type="submit">Add to catalogue</button></div>
		</form>
	</div>
{/if}

<!-- Empty state ------------------------------------------------------------>
{#if items.length === 0}
	<div class="card empty">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
		<h3>Your catalogue is empty</h3>
		<p>Your AI can only recommend tours and answer questions that exist here. Add your first item to get started.</p>
		<div class="rowflex" style="justify-content:center;gap:.5rem">
			<button class="sm" type="button" on:click={() => startAdd('Tour')}>Add a tour</button>
			<button class="ghost sm" type="button" on:click={() => (showImport = true)}>Import tours</button>
		</div>
	</div>
{:else if filtered.length === 0}
	<div class="card empty">
		<h3>No matches</h3>
		<p>Nothing matches your search or filter.</p>
		<button class="ghost sm" type="button" on:click={() => { search = ''; filter = 'all'; }}>Clear</button>
	</div>
{/if}

<!-- Item cards ------------------------------------------------------------->
{#each filtered as item (item.id)}
	<div class="card kb-item">
		{#if editing === item.id}
			<form class="grid" method="POST" action="?/updateItem" use:enhance={closeAfter}>
				<input type="hidden" name="id" value={item.id} />
				<div class="row">
					<div><label for={`t-${item.id}`}>Name</label><input id={`t-${item.id}`} name="title" value={item.title} required /></div>
					<div><label for={`c-${item.id}`}>Category</label><input id={`c-${item.id}`} name="category" value={item.category ?? ''} /></div>
				</div>
				<div class="row">
					<div><label for={`p-${item.id}`}>Price</label><input id={`p-${item.id}`} name="price_amount" value={item.price_amount ?? ''} inputmode="decimal" /></div>
					<div><label for={`cur-${item.id}`}>Currency</label><input id={`cur-${item.id}`} name="price_currency" value={item.price_currency ?? 'USD'} style="max-width:120px" /></div>
				</div>
				<div><label for={`d-${item.id}`}>Key details (one per line)</label><textarea id={`d-${item.id}`} name="details" style="min-height:88px">{mdText(item.metadata)}</textarea></div>
				<div><label for={`b-${item.id}`}>Description</label><textarea id={`b-${item.id}`} name="body">{item.body ?? ''}</textarea></div>
				<div class="rowflex">
					<button type="submit">Save changes</button>
					<button type="button" class="ghost" on:click={() => (editing = null)}>Cancel</button>
				</div>
			</form>
		{:else}
			<div class="item-head">
				<div style="min-width:0;flex:1">
					<div class="item-title-row">
						<span class="item-title">{item.title}</span>
						{#if item.category}<span class="badge neutral">{titleCase(item.category)}</span>{/if}
						{#if item.price_amount != null}<span class="badge">{item.price_currency ?? 'USD'} {Number(item.price_amount).toLocaleString()}</span>{/if}
						{#if isStale(item.updated_at)}<span class="badge off">⚠ Review</span>{/if}
					</div>
					{#if metaVal(item.metadata, 'duration') || metaVal(item.metadata, 'season', 'month') || metaVal(item.metadata, 'group', 'max')}
						<div class="item-facts">
							{#if metaVal(item.metadata, 'duration')}<span>⏱ {metaVal(item.metadata, 'duration')}</span>{/if}
							{#if metaVal(item.metadata, 'season', 'month')}<span>📅 {metaVal(item.metadata, 'season', 'month')}</span>{/if}
							{#if metaVal(item.metadata, 'group', 'max')}<span>👥 {metaVal(item.metadata, 'group', 'max')}</span>{/if}
						</div>
					{/if}
					{#if metaVal(item.metadata, 'includes', 'included')}
						<div class="item-includes"><b>Includes:</b> {metaVal(item.metadata, 'includes', 'included')}</div>
					{/if}
					{#if item.body}<div class="item-body">{item.body.slice(0, 200)}{item.body.length > 200 ? '…' : ''}</div>{/if}
				</div>
			</div>
			<div class="item-foot">
				<span class="faint" style="font-size:.78rem">Updated {ago(item.updated_at)}</span>
				<div class="item-actions">
					<button class="ghost sm" type="button" on:click={() => (editing = item.id)}>Edit</button>
					<form method="POST" action="?/duplicateItem" use:enhance style="display:inline"><input type="hidden" name="id" value={item.id} /><button class="ghost sm" type="submit">Duplicate</button></form>
					<form method="POST" action="?/deleteItem" use:enhance style="display:inline"><input type="hidden" name="id" value={item.id} /><button class="danger sm" type="submit">Delete</button></form>
				</div>
			</div>

			{#if isTour(item)}
				<div class="deps">
					<div class="rowflex" style="justify-content:space-between">
						<strong style="font-size:.88rem">Dates &amp; availability</strong>
						<span class="muted" style="font-size:.78rem">{depsOf(item).length} scheduled · lets your AI answer "available in September?"</span>
					</div>
					{#if depsOf(item).length}
						<div style="margin-top:.5rem;display:flex;flex-direction:column;gap:.3rem">
							{#each depsOf(item) as d}
								<div class="rowflex" style="justify-content:space-between;font-size:.84rem">
									<span class="mono">{d.start_date}{d.end_date ? `–${d.end_date}` : ''}{d.price_amount != null ? ` · ${d.currency ?? 'USD'} ${d.price_amount}pp` : ''}{d.seats_available != null ? ` · ${d.seats_available} seats` : ''}{d.status && d.status !== 'open' ? ` · ${d.status}` : ''}</span>
									<form method="POST" action="?/deleteDeparture" use:enhance><input type="hidden" name="id" value={d.id} /><button class="danger sm" type="submit">Remove</button></form>
								</div>
							{/each}
						</div>
					{/if}
					<form class="rowflex" method="POST" action="?/addDeparture" use:enhance style="margin-top:.55rem;gap:.4rem;flex-wrap:wrap;align-items:flex-end">
						<input type="hidden" name="item_id" value={item.id} />
						<div><label style="font-size:.72rem">Start date</label><input name="start_date" type="date" required style="width:auto" /></div>
						<div><label style="font-size:.72rem">Price pp</label><input name="price_amount" placeholder="1450" inputmode="decimal" style="width:100px" /></div>
						<div><label style="font-size:.72rem">Seats</label><input name="seats_available" placeholder="6" inputmode="numeric" style="width:80px" /></div>
						<div><label style="font-size:.72rem">Status</label><select name="status" style="width:auto"><option value="open">open</option><option value="limited">limited</option><option value="sold_out">sold out</option></select></div>
						<button class="ghost sm" type="submit">Add date</button>
					</form>
				</div>
			{/if}
		{/if}
	</div>
{/each}

<!-- Bulk import (secondary) ------------------------------------------------->
<div class="card">
	<div class="rowflex" style="justify-content:space-between;flex-wrap:wrap;gap:.5rem">
		<div>
			<strong>Import many at once</strong>
			<div class="muted" style="font-size:.84rem">Have a spreadsheet? Paste a CSV to add lots of tours in one go.</div>
		</div>
		<div class="rowflex">
			<a class="btn ghost sm" href="/knowledge-template.csv" download>CSV template</a>
			<button type="button" class="ghost sm" on:click={() => (showImport = !showImport)}>{showImport ? 'Hide' : 'Import tours'}</button>
		</div>
	</div>
	{#if showImport}
		<form class="grid" method="POST" action="?/bulkImport" use:enhance style="margin-top:.85rem">
			<div>
				<label for="import-input">Paste CSV or JSON</label>
				<textarea id="import-input" name="input" style="min-height:150px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.82rem" placeholder={csvExample}></textarea>
				<div class="hint">Columns: <code>title</code> (required), plus <code>category</code>, <code>price</code>, <code>currency</code>, <code>body</code>, and any detail like <code>duration</code>, <code>includes</code>, <code>best_season</code>.</div>
			</div>
			<div><button type="submit">Import</button></div>
		</form>
	{/if}
</div>

<!-- Floating add (mobile) -------------------------------------------------->
<button class="fab-add" on:click={() => (addMenuOpen = !addMenuOpen)} aria-label="Add knowledge">
	<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
</button>

<style>
	.kb-toolbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 0.85rem;
	}
	.kb-search {
		position: relative;
		flex: 1;
		min-width: 220px;
	}
	.kb-search > svg {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		width: 16px;
		height: 16px;
		color: var(--faint);
		pointer-events: none;
	}
	.kb-search input {
		padding-left: 2.2rem;
	}
	.kb-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.add-wrap {
		position: relative;
	}
	.add-btn {
		gap: 0.35rem;
	}
	.add-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: default;
	}
	.add-menu {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		z-index: 41;
		min-width: 180px;
		background: var(--panel);
		border: 1px solid var(--edge);
		border-radius: 12px;
		box-shadow: var(--shadow);
		padding: 0.35rem;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.add-menu button {
		background: transparent;
		border: 0;
		color: var(--body);
		text-align: left;
		font-weight: 500;
		font-size: 0.88rem;
		padding: 0.5rem 0.65rem;
		border-radius: 8px;
		justify-content: flex-start;
	}
	.add-menu button:hover {
		background: var(--panel-2);
		color: var(--strong);
	}

	.kb-chips {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
		overflow-x: auto;
	}
	.kb-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--edge);
		color: var(--muted);
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.35rem 0.7rem;
		border-radius: 99px;
		white-space: nowrap;
	}
	.kb-chip:hover {
		color: var(--soft);
		border-color: rgba(55, 224, 166, 0.3);
	}
	.kb-chip.on {
		background: rgba(55, 224, 166, 0.14);
		border-color: rgba(55, 224, 166, 0.4);
		color: var(--mint);
	}
	.chip-n {
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
		font-size: 0.75rem;
	}

	.q-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.q-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.5rem 0.7rem;
		border-radius: 10px;
		background: var(--panel-2);
		border: 1px solid var(--edge);
	}
	.q-text {
		font-size: 0.88rem;
		color: var(--body);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.q-count {
		color: var(--faint);
		margin-left: 0.4rem;
		font-size: 0.78rem;
	}
	.q-row .btn {
		flex-shrink: 0;
	}

	.add-card {
		border-color: rgba(55, 224, 166, 0.35);
	}

	.item-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.item-title {
		font-size: 1rem;
		font-weight: 700;
		color: var(--strong);
	}
	.item-facts {
		display: flex;
		gap: 0.9rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
		font-size: 0.83rem;
		color: var(--soft);
	}
	.item-includes {
		margin-top: 0.45rem;
		font-size: 0.84rem;
		color: var(--muted);
		line-height: 1.4;
	}
	.item-includes b {
		color: var(--soft);
	}
	.item-body {
		margin-top: 0.45rem;
		font-size: 0.86rem;
		color: var(--muted);
		line-height: 1.45;
		white-space: pre-wrap;
	}
	.item-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.85rem;
		flex-wrap: wrap;
	}
	.item-actions {
		display: flex;
		gap: 0.4rem;
	}
	.deps {
		border-top: 1px solid var(--line-2);
		margin-top: 0.85rem;
		padding-top: 0.8rem;
	}

	.fab-add {
		display: none;
		position: fixed;
		bottom: 1.1rem;
		right: 1.1rem;
		z-index: 30;
		width: 54px;
		height: 54px;
		border-radius: 50%;
		align-items: center;
		justify-content: center;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	}
	@media (max-width: 720px) {
		.fab-add {
			display: flex;
		}
		.kb-actions .add-wrap .add-btn {
			display: none;
		}
		.add-menu {
			position: fixed;
			right: 1.1rem;
			bottom: 4.6rem;
			top: auto;
		}
	}
</style>
