<script>
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	export let data;
	export let form;

	$: products = data.products || [];
	$: currency = data.currency || 'USD';
	const zero = new Set(['JPY', 'KRW', 'VND', 'UGX', 'RWF', 'XOF', 'XAF']);
	const per = () => (zero.has(currency) ? 1 : 100);
	const money = (minor) => `${currency} ${((Number(minor) || 0) / per()).toLocaleString('en-US', { minimumFractionDigits: per() === 1 ? 0 : 2, maximumFractionDigits: per() === 1 ? 0 : 2 })}`;
	const major = (minor) => (Number(minor) || 0) / per();

	let editing = null; // product object or {} for new
	let adjusting = null;
	let search = data.search || '';

	function openNew() { editing = { unit: 'unit', track_inventory: true, active: true, tax_rate: 0, min_stock: 0 }; }
	function openEdit(p) { editing = { ...p, price: major(p.price_minor), cost: major(p.cost_minor), aliases: (p.aliases || []).join(', ') }; }

	function afterSubmit() {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success' && result.data?.ok) { editing = null; adjusting = null; await invalidateAll(); }
		};
	}
	function doSearch() { goto(`/portal/products?q=${encodeURIComponent(search)}`); }

	// Move the modal to <body> so its fixed backdrop covers the full viewport (the
	// AppShell's transformed content wrapper would otherwise clip it).
	function portal(node) {
		document.body.appendChild(node);
		return { destroy() { node.parentNode && node.parentNode.removeChild(node); } };
	}
</script>

<div class="page-head">
	<div>
		<h1>Products & Inventory</h1>
		<div class="sub">Your catalogue and live stock. The AI matches WhatsApp orders against these products.</div>
	</div>
	{#if data.enabled}
		<div class="actions">
			{#if data.low > 0}<a class="badge warn" href="#low" title="Products at or below minimum">{data.low} low stock</a>{/if}
			<button class="btn" on:click={openNew}>+ New product</button>
		</div>
	{/if}
</div>

{#if !data.enabled}
	<div class="empty card">
		<div class="empty-ico">📦</div>
		<h3>Inventory isn't enabled</h3>
		<p>Turn on Products & Inventory to build your catalogue and control stock.</p>
		<a class="btn" href="/portal/modules">Enable in Modules →</a>
	</div>
{:else}
	{#if data.needsMigration}<div class="notice err">Run <code>db/024_inventory.sql</code> in Supabase to enable products & stock.</div>{/if}
	{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}

	<div class="toolbar">
		<form class="searchbar" on:submit|preventDefault={doSearch}>
			<input placeholder="Search products, SKU, brand…" bind:value={search} />
			<button class="btn ghost sm" type="submit">Search</button>
		</form>
		<span class="count">{data.total} product{data.total === 1 ? '' : 's'}</span>
	</div>

	{#if !products.length}
		<div class="empty card"><div class="empty-ico">🧺</div><h3>{data.search ? 'No matches' : 'No products yet'}</h3><p>{data.search ? 'Try a different search.' : 'Add your first product so the AI can turn WhatsApp messages into orders.'}</p>{#if !data.search}<button class="btn" on:click={openNew}>+ New product</button>{/if}</div>
	{:else}
		<div class="card table-wrap">
			<table>
				<thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Available</th><th>On hand</th><th>Reserved</th><th></th></tr></thead>
				<tbody>
					{#each products as p (p.id)}
						<tr class:inactive={!p.active} class:low={p.track_inventory && p.stock.available <= (p.min_stock || 0)}>
							<td><div class="pname">{p.name}{#if !p.active}<span class="off">inactive</span>{/if}</div><div class="pmeta">{p.brand || ''} {p.unit ? `· per ${p.unit}` : ''}</div></td>
							<td class="mono">{p.sku || '—'}</td>
							<td class="mono">{money(p.price_minor)}</td>
							<td>{#if p.track_inventory}<b class:danger={p.stock.available <= (p.min_stock || 0)}>{p.stock.available}</b>{:else}<span class="untracked">not tracked</span>{/if}</td>
							<td>{p.track_inventory ? p.stock.on_hand : '—'}</td>
							<td>{p.track_inventory ? p.stock.reserved : '—'}</td>
							<td class="row-actions">
								{#if p.track_inventory}<button class="link" on:click={() => (adjusting = p)}>Stock</button>{/if}
								<button class="link" on:click={() => openEdit(p)}>Edit</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}

<!-- Create / edit modal -->
{#if editing}
	<div class="scrim" use:portal on:click|self={() => (editing = null)} role="presentation">
		<div class="modal">
			<div class="modal-head"><h3>{editing.id ? 'Edit product' : 'New product'}</h3><button class="x" on:click={() => (editing = null)}>✕</button></div>
			<form method="POST" action={editing.id ? '?/update' : '?/create'} use:enhance={afterSubmit}>
				{#if editing.id}<input type="hidden" name="id" value={editing.id} />{/if}
				<input class="in" name="name" placeholder="Product name" value={editing.name || ''} required />
				<div class="grid3">
					<label class="fld"><span>Price ({currency})</span><input class="in" name="price" type="number" min="0" step="0.01" value={editing.price ?? ''} /></label>
					<label class="fld"><span>Unit</span><input class="in" name="unit" placeholder="bag" value={editing.unit || 'unit'} /></label>
					<label class="fld"><span>SKU</span><input class="in" name="sku" placeholder="optional" value={editing.sku || ''} /></label>
				</div>
				<div class="grid3">
					<label class="fld"><span>Min stock</span><input class="in" name="min_stock" type="number" min="0" value={editing.min_stock ?? 0} /></label>
					{#if !editing.id}<label class="fld"><span>Opening stock</span><input class="in" name="opening_stock" type="number" min="0" value="0" /></label>{/if}
				</div>
				<input class="in" name="image" placeholder="Image URL (optional)" value={(editing.images && editing.images[0]) || ''} />
				<input class="in" name="aliases" placeholder="AI aliases / WhatsApp names (comma-separated)" value={editing.aliases || ''} />
				<textarea class="in" name="description" rows="2" placeholder="Description (optional)">{editing.description || ''}</textarea>
				<div class="switches">
					<label class="sw-l"><input type="checkbox" name="track_inventory" checked={editing.track_inventory !== false} /> Track stock</label>
					{#if editing.id}<label class="sw-l"><input type="checkbox" name="active" checked={editing.active !== false} /> Active</label>{/if}
				</div>
				<div class="modal-foot"><button type="button" class="btn ghost" on:click={() => (editing = null)}>Cancel</button><button class="btn" type="submit">{editing.id ? 'Save' : 'Add product'}</button></div>
			</form>
		</div>
	</div>
{/if}

<!-- Stock adjust modal -->
{#if adjusting}
	<div class="scrim" use:portal on:click|self={() => (adjusting = null)} role="presentation">
		<div class="modal sm">
			<div class="modal-head"><h3>Adjust stock — {adjusting.name}</h3><button class="x" on:click={() => (adjusting = null)}>✕</button></div>
			<p class="hint">On hand <b>{adjusting.stock.on_hand}</b> · reserved <b>{adjusting.stock.reserved}</b> · available <b>{adjusting.stock.available}</b></p>
			<form method="POST" action="?/adjust" use:enhance={afterSubmit}>
				<input type="hidden" name="product_id" value={adjusting.id} />
				<div class="grid2">
					<label class="fld"><span>Type</span>
						<select class="in" name="type">
							<option value="purchase">Purchase / receive (+)</option>
							<option value="adjustment">Adjustment (+/−)</option>
							<option value="damage">Damage (−)</option>
							<option value="expiry">Expiry (−)</option>
						</select>
					</label>
					<label class="fld"><span>Quantity</span><input class="in" name="qty" type="number" placeholder="e.g. 50 or -3" required /></label>
				</div>
				<input class="in" name="reason" placeholder="Reason (optional)" />
				<div class="modal-foot"><button type="button" class="btn ghost" on:click={() => (adjusting = null)}>Cancel</button><button class="btn" type="submit">Apply</button></div>
			</form>
		</div>
	</div>
{/if}

<style>
	.empty { text-align: center; padding: 3rem 1.5rem; }
	.empty-ico { font-size: 2.4rem; }
	.empty h3 { margin: 0.6rem 0 0.3rem; color: var(--strong); }
	.empty p { color: var(--muted); max-width: 44ch; margin: 0 auto 1.2rem; }
	.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin: 0.4rem 0 0.8rem; flex-wrap: wrap; }
	.searchbar { display: flex; gap: 0.5rem; flex: 1; max-width: 460px; }
	.searchbar input { flex: 1; background: rgba(var(--fg-rgb), 0.06); border: 1px solid var(--edge); border-radius: 9px; padding: 0.5rem 0.75rem; color: var(--strong); font: inherit; }
	.searchbar input:focus { outline: none; border-color: var(--mint); }
	.count { color: var(--muted); font-size: 0.85rem; }
	.badge.warn { background: rgba(224, 178, 76, 0.16); color: #fcd34d; text-decoration: none; }

	.table-wrap { overflow-x: auto; padding: 0; }
	table { width: 100%; border-collapse: collapse; }
	th { text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); padding: 0.7rem 1rem; border-bottom: 1px solid var(--edge); }
	td { padding: 0.6rem 1rem; border-bottom: 1px solid var(--edge); color: var(--soft); font-size: 0.9rem; }
	tr.inactive { opacity: 0.5; }
	tr.low td { background: rgba(224, 178, 76, 0.05); }
	.pname { font-weight: 650; color: var(--strong); }
	.pmeta { font-size: 0.78rem; color: var(--muted); }
	.off { font-size: 0.66rem; color: var(--muted); border: 1px solid var(--edge); border-radius: 4px; padding: 0 0.3rem; margin-left: 0.4rem; }
	.mono { font-family: ui-monospace, monospace; }
	.danger { color: #fca5a5; }
	.untracked { color: var(--faint); font-size: 0.82rem; }
	.row-actions { text-align: right; white-space: nowrap; }
	.link { border: 0; background: transparent; color: var(--mint); cursor: pointer; font-weight: 600; font-size: 0.84rem; margin-left: 0.6rem; }

	.scrim { position: fixed; inset: 0; background: rgba(3, 12, 9, 0.62); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
	.modal { background: var(--panel); border: 1px solid var(--edge); border-radius: 18px; width: min(560px, 96vw); max-height: 92vh; overflow-y: auto; padding: 1.3rem; box-shadow: var(--shadow, 0 30px 60px -30px rgba(0,0,0,0.6)); }
	.modal.sm { width: min(420px, 96vw); }
	.modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.7rem; }
	.modal-head h3 { margin: 0; color: var(--strong); font-size: 1.05rem; }
	.x { border: 0; background: transparent; color: var(--muted); font-size: 1rem; cursor: pointer; }
	.hint { color: var(--muted); font-size: 0.88rem; margin: 0 0 0.8rem; }
	.hint b { color: var(--soft); }
	.in { width: 100%; background: rgba(var(--fg-rgb), 0.06); border: 1px solid var(--edge); border-radius: 10px; padding: 0.55rem 0.7rem; color: var(--strong); font: inherit; margin-bottom: 0.6rem; }
	.in:focus { outline: none; border-color: var(--mint); }
	textarea.in { resize: vertical; }
	.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
	.grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.6rem; }
	.fld { display: flex; flex-direction: column; }
	.fld span { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 0.2rem; }
	.switches { display: flex; gap: 1.2rem; margin: 0.3rem 0 0.2rem; }
	.sw-l { display: flex; align-items: center; gap: 0.4rem; color: var(--soft); font-size: 0.9rem; }
	.modal-foot { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.6rem; }
	code { background: rgba(var(--panel-rgb, 255, 255, 255), 0.08); padding: 0.05rem 0.3rem; border-radius: 5px; font-size: 0.85em; }
	@media (max-width: 620px) { .grid3 { grid-template-columns: 1fr; } .grid2 { grid-template-columns: 1fr; } }
</style>
