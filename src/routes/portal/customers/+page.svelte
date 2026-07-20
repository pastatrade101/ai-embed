<script>
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	export let data;
	export let form;

	$: customers = data.customers || [];
	$: currency = data.currency || 'USD';
	const money = (n) => `${currency} ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
	const ago = (d) => {
		if (!d) return '—';
		const s = (Date.now() - new Date(d).getTime()) / 1000;
		if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
		if (s < 86400) return `${Math.round(s / 3600)}h ago`;
		return `${Math.round(s / 86400)}d ago`;
	};
	let search = data.search || '';
	let adding = false;
	function doSearch() { goto(`/portal/customers?q=${encodeURIComponent(search)}`); }
	function afterAdd() {
		return async ({ result, update }) => { await update(); if (result.type === 'success' && result.data?.ok) { adding = false; await invalidateAll(); } };
	}
</script>

<div class="page-head">
	<div>
		<h1>Customers</h1>
		<div class="sub">Everyone who's messaged or ordered — one record per WhatsApp number.</div>
	</div>
	<div class="actions"><button class="btn" on:click={() => (adding = true)}>+ Add customer</button></div>
</div>

{#if data.needsMigration}<div class="notice err">Run <code>db/026_customers.sql</code> in Supabase to enable customers.</div>{/if}
{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok} <a href={`/portal/customers/${form.customerId}`}>Open →</a></div>{/if}

<div class="toolbar">
	<form class="searchbar" on:submit|preventDefault={doSearch}><input placeholder="Search name or number…" bind:value={search} /><button class="btn ghost sm" type="submit">Search</button></form>
	<span class="count">{data.total} customer{data.total === 1 ? '' : 's'}</span>
</div>

{#if !customers.length}
	<div class="empty card"><div class="empty-ico">👤</div><h3>{data.search ? 'No matches' : 'No customers yet'}</h3><p>{data.search ? 'Try another search.' : 'Customers appear automatically when they message or order. You can also add one manually.'}</p></div>
{:else}
	<div class="card table-wrap">
		<table>
			<thead><tr><th>Customer</th><th>Number</th><th>Orders</th><th>Total spent</th><th>Last seen</th></tr></thead>
			<tbody>
				{#each customers as c (c.id)}
					<tr on:click={() => goto(`/portal/customers/${c.id}`)}>
						<td class="cname">{c.name || 'Unknown'}</td>
						<td class="mono">{c.phone}</td>
						<td>{c.order_count}</td>
						<td class="mono">{money(c.total_spent)}</td>
						<td>{ago(c.last_interaction_at)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if adding}
	<div class="scrim" on:click|self={() => (adding = false)} role="presentation">
		<div class="modal">
			<div class="modal-head"><h3>Add customer</h3><button class="x" on:click={() => (adding = false)}>✕</button></div>
			<form method="POST" action="?/add" use:enhance={afterAdd}>
				<input class="in" name="phone" placeholder="WhatsApp number (e.g. +255…)" required />
				<input class="in" name="name" placeholder="Name (optional)" />
				<div class="modal-foot"><button type="button" class="btn ghost" on:click={() => (adding = false)}>Cancel</button><button class="btn" type="submit">Add</button></div>
			</form>
		</div>
	</div>
{/if}

<style>
	.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin: 0.4rem 0 0.8rem; flex-wrap: wrap; }
	.searchbar { display: flex; gap: 0.5rem; flex: 1; max-width: 420px; }
	.searchbar input { flex: 1; background: rgba(var(--panel-rgb, 255, 255, 255), 0.04); border: 1px solid var(--edge); border-radius: 9px; padding: 0.5rem 0.75rem; color: var(--strong); font: inherit; }
	.searchbar input:focus { outline: none; border-color: var(--mint); }
	.count { color: var(--muted); font-size: 0.85rem; }
	.empty { text-align: center; padding: 3rem 1.5rem; }
	.empty-ico { font-size: 2.4rem; }
	.empty h3 { margin: 0.6rem 0 0.3rem; color: var(--strong); }
	.empty p { color: var(--muted); max-width: 44ch; margin: 0 auto; }
	.table-wrap { overflow-x: auto; padding: 0; }
	table { width: 100%; border-collapse: collapse; }
	th { text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); padding: 0.7rem 1rem; border-bottom: 1px solid var(--edge); }
	td { padding: 0.7rem 1rem; border-bottom: 1px solid var(--edge); color: var(--soft); font-size: 0.9rem; }
	tbody tr { cursor: pointer; }
	tbody tr:hover { background: rgba(var(--panel-rgb, 255, 255, 255), 0.03); }
	.cname { font-weight: 650; color: var(--strong); }
	.mono { font-family: ui-monospace, monospace; }
	.scrim { position: fixed; inset: 0; background: rgba(3, 12, 9, 0.62); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
	.modal { background: var(--body, #0d1f18); border: 1px solid var(--edge); border-radius: 18px; width: min(440px, 96vw); padding: 1.3rem; box-shadow: var(--shadow, 0 30px 60px -30px rgba(0,0,0,0.6)); }
	.modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.7rem; }
	.modal-head h3 { margin: 0; color: var(--strong); }
	.x { border: 0; background: transparent; color: var(--muted); font-size: 1rem; cursor: pointer; }
	.in { width: 100%; background: rgba(var(--panel-rgb, 255, 255, 255), 0.04); border: 1px solid var(--edge); border-radius: 10px; padding: 0.6rem 0.75rem; color: var(--strong); font: inherit; margin-bottom: 0.6rem; }
	.in:focus { outline: none; border-color: var(--mint); }
	.modal-foot { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.4rem; }
	code { background: rgba(var(--panel-rgb, 255, 255, 255), 0.08); padding: 0.05rem 0.3rem; border-radius: 5px; font-size: 0.85em; }
</style>
