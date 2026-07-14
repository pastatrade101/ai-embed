<script>
	import { enhance } from '$app/forms';
	export let items = [];
	export let departures = {};
	export let form = null;

	const isTour = (item) => (item.category ?? '').toLowerCase().includes('tour');
	const depsOf = (item) => departures[item.id] ?? [];

	let editing = null;
	let showImport = false;
	const closeAfter = () => async ({ update }) => {
		await update();
		editing = null;
	};

	// Render a metadata object to "Key: value" lines for the edit form.
	function mdText(md) {
		if (!md || typeof md !== 'object' || Array.isArray(md)) return '';
		return Object.entries(md)
			.filter(([, v]) => v != null && v !== '')
			.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
			.join('\n');
	}
	function mdChips(md) {
		if (!md || typeof md !== 'object' || Array.isArray(md)) return [];
		return Object.entries(md).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
	}

	const csvExample = `title,category,price,currency,body,duration,group_size,includes,best_season
"5-Day Serengeti Safari",tour,1450,USD,"Full itinerary across the northern circuit…","5 days","max 6","park fees, meals, guide","Jun–Oct"`;
</script>

<p class="muted" style="margin-top:-.4rem">The clean, verified catalogue the assistant answers from. Prices and details below are injected exactly — the assistant never guesses them. Editing an item re-embeds it automatically.</p>

{#if form?.section === 'item'}
	{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}
{/if}
{#if form?.section === 'departure'}
	{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}
{/if}
{#if form?.section === 'import'}
	{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}
		<div class="notice">{form.ok}
			{#if form?.failed?.length}
				<ul style="margin:.4rem 0 0;padding-left:1.1rem">{#each form.failed as f}<li>{f}</li>{/each}</ul>
			{/if}
		</div>
	{/if}
{/if}

<!-- Bulk import ------------------------------------------------------------->
<div class="card">
	<div class="rowflex" style="justify-content:space-between">
		<div>
			<strong>Bulk import</strong>
			<div class="muted" style="font-size:.84rem">Paste a CSV or JSON list to add many products / itineraries at once.</div>
		</div>
		<div class="rowflex">
			<a class="btn ghost sm" href="/knowledge-template.csv" download>Download CSV template</a>
			<button type="button" class="ghost sm" on:click={() => (showImport = !showImport)}>{showImport ? 'Hide' : 'Import'}</button>
		</div>
	</div>

	{#if showImport}
		<form class="grid" method="POST" action="?/bulkImport" use:enhance style="margin-top:.85rem">
			<div>
				<label for="import-input">CSV or JSON</label>
				<textarea id="import-input" name="input" style="min-height:150px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.82rem" placeholder={csvExample}></textarea>
				<div class="hint">Columns: <code>title</code> (required), <code>category</code>, <code>price</code>, <code>currency</code>, <code>body</code>. Any extra column (e.g. <code>duration</code>, <code>includes</code>, <code>best_season</code>) becomes a searchable detail. JSON works too — an array of objects with those keys (plus an optional <code>metadata</code> object).</div>
			</div>
			<div><button type="submit">Import items</button></div>
		</form>
	{/if}
</div>

{#if items.length === 0}
	<div class="card empty">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
		<h3>Empty catalogue</h3>
		<p>Add a tour, menu item, or service below — or bulk-import several. Each is chunked and embedded so the assistant can ground its answers.</p>
	</div>
{/if}

{#each items as item (item.id)}
	<div class="card">
		{#if editing === item.id}
			<form class="grid" method="POST" action="?/updateItem" use:enhance={closeAfter}>
				<input type="hidden" name="id" value={item.id} />
				<div class="row">
					<div><label for={`t-${item.id}`}>Title</label><input id={`t-${item.id}`} name="title" value={item.title} required /></div>
					<div><label for={`c-${item.id}`}>Category</label><input id={`c-${item.id}`} name="category" value={item.category ?? ''} /></div>
				</div>
				<div class="row">
					<div><label for={`p-${item.id}`}>Price (exact figure — injected, never guessed)</label><input id={`p-${item.id}`} name="price_amount" value={item.price_amount ?? ''} inputmode="decimal" /></div>
					<div><label for={`cur-${item.id}`}>Currency</label><input id={`cur-${item.id}`} name="price_currency" value={item.price_currency ?? 'USD'} style="max-width:120px" /></div>
				</div>
				<div><label for={`d-${item.id}`}>Details (one per line, e.g. <code>Duration: 5 days</code>)</label><textarea id={`d-${item.id}`} name="details" style="min-height:90px">{mdText(item.metadata)}</textarea></div>
				<div><label for={`b-${item.id}`}>Body</label><textarea id={`b-${item.id}`} name="body">{item.body ?? ''}</textarea></div>
				<div class="rowflex">
					<button type="submit">Save &amp; re-embed</button>
					<button type="button" class="ghost" on:click={() => (editing = null)}>Cancel</button>
				</div>
			</form>
		{:else}
			<div class="rowflex" style="justify-content:space-between;align-items:flex-start">
				<div style="min-width:0">
					<div class="rowflex">
						<strong>{item.title}</strong>
						{#if item.category}<span class="badge neutral">{item.category}</span>{/if}
						{#if item.price_amount != null}<span class="badge">{item.price_currency ?? 'USD'} {item.price_amount}</span>{/if}
					</div>
					{#if mdChips(item.metadata).length}
						<div class="rowflex" style="gap:.35rem;margin-top:.4rem">
							{#each mdChips(item.metadata) as chip}<span class="badge neutral" style="text-transform:none">{chip}</span>{/each}
						</div>
					{/if}
					<div class="muted" style="font-size:.86rem;margin-top:.35rem;white-space:pre-wrap">{(item.body ?? '').slice(0, 240)}{(item.body ?? '').length > 240 ? '…' : ''}</div>
				</div>
				<div class="rowflex" style="flex-shrink:0">
					<button class="ghost sm" type="button" on:click={() => (editing = item.id)}>Edit</button>
					<form method="POST" action="?/deleteItem" use:enhance>
						<input type="hidden" name="id" value={item.id} />
						<button class="danger sm" type="submit">Delete</button>
					</form>
				</div>
			</div>

			{#if isTour(item)}
				<div style="border-top:1px solid var(--line-2);margin-top:.85rem;padding-top:.8rem">
					<div class="rowflex" style="justify-content:space-between">
						<strong style="font-size:.9rem">Departures</strong>
						<span class="muted" style="font-size:.8rem">{depsOf(item).length} scheduled · powers "available in September?" answers</span>
					</div>
					{#if depsOf(item).length}
						<div style="margin-top:.5rem;display:flex;flex-direction:column;gap:.3rem">
							{#each depsOf(item) as d}
								<div class="rowflex" style="justify-content:space-between;font-size:.85rem">
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
						<button class="ghost sm" type="submit">Add departure</button>
					</form>
				</div>
			{/if}
		{/if}
	</div>
{/each}

<div class="card">
	<h2 class="section">Add an item</h2>
	<form class="grid" method="POST" action="?/addItem" use:enhance>
		<div class="row">
			<div><label for="new-title">Title</label><input id="new-title" name="title" required placeholder="5-Day Serengeti & Ngorongoro Safari" /></div>
			<div><label for="new-cat">Category</label><input id="new-cat" name="category" placeholder="tour" /></div>
		</div>
		<div class="row">
			<div><label for="new-price">Price (exact figure)</label><input id="new-price" name="price_amount" inputmode="decimal" placeholder="1450" /></div>
			<div><label for="new-cur">Currency</label><input id="new-cur" name="price_currency" value="USD" style="max-width:120px" /></div>
		</div>
		<div><label for="new-details">Details (one per line, e.g. <code>Duration: 5 days</code>)</label><textarea id="new-details" name="details" style="min-height:90px" placeholder={"Duration: 5 days\nGroup size: max 6\nIncludes: park fees, meals, guide\nBest season: Jun–Oct"}></textarea></div>
		<div><label for="new-body">Body</label><textarea id="new-body" name="body" placeholder="Full itinerary, what's included, group size, fitness level, best months…"></textarea></div>
		<div><button type="submit">Add &amp; embed</button></div>
	</form>
</div>
