<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	export let data;
	export let form;

	$: orders = data.orders || [];
	$: statuses = data.statuses || [];
	$: currency = data.orders?.[0]?.currency || 'USD';

	let view = 'board'; // board | table
	let showAI = false;
	let showManual = false;

	const money = (n) => `${currency} ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
	const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');
	const smeta = (key) => statuses.find((s) => s.key === key) || { key, label: key, color: '#7c8b83' };

	// Board columns = the 5 order statuses, one to one.
	const COLUMNS = [
		{ id: 'draft', label: 'Draft', keys: ['draft'] },
		{ id: 'confirmed', label: 'Confirmed', keys: ['confirmed'] },
		{ id: 'processing', label: 'Processing', keys: ['processing'] },
		{ id: 'completed', label: 'Completed', keys: ['completed'] },
		{ id: 'cancelled', label: 'Cancelled', keys: ['cancelled'] }
	];
	const payLabel = { unpaid: 'Unpaid', pending: 'Pending', paid: 'Paid', failed: 'Failed' };
	$: byColumn = COLUMNS.map((c) => ({ ...c, items: orders.filter((o) => c.keys.includes(o.status)) }));

	// Manual order item editor.
	let mItems = [{ description: '', qty: 1, unit_price: 0 }];
	const addItem = () => (mItems = [...mItems, { description: '', qty: 1, unit_price: 0 }]);
	const rmItem = (i) => (mItems = mItems.filter((_, ix) => ix !== i));
	$: mItemsJson = JSON.stringify(mItems.filter((it) => String(it.description).trim()));
	$: mTotal = mItems.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);

	function afterSubmit() {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success' && result.data?.ok) {
				showAI = false;
				showManual = false;
				mItems = [{ description: '', qty: 1, unit_price: 0 }];
				await invalidateAll();
			}
		};
	}
</script>

<div class="page-head">
	<div>
		<h1>Orders</h1>
		<div class="sub">Turn a customer message into a confirmed order — the AI drafts, you approve.</div>
	</div>
	{#if data.enabled}
		<div class="actions">
			<div class="seg">
				<button class:on={view === 'board'} on:click={() => (view = 'board')}>Board</button>
				<button class:on={view === 'table'} on:click={() => (view = 'table')}>Table</button>
			</div>
			<button class="btn ghost" on:click={() => (showManual = true)}>New order</button>
			<button class="btn" on:click={() => (showAI = true)}>✨ AI draft</button>
		</div>
	{/if}
</div>

{#if !data.enabled}
	<div class="empty card">
		<div class="empty-ico">🧩</div>
		<h3>Orders isn't enabled</h3>
		<p>Turn on the Orders module to start turning customer messages into confirmed orders.</p>
		<div class="row"><a class="btn" href="/portal/modules">Enable in Modules →</a></div>
	</div>
{/if}
{#if data.enabled && data.needsMigration}
	<div class="notice err">Orders need a one-time database update — run <code>db/023_orders.sql</code> in Supabase.</div>
{/if}
{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok} <a href={`/portal/orders/${form.orderId}`}>Open →</a></div>{/if}

{#if data.enabled}
{#if !orders.length && !data.needsMigration}
	<div class="empty card">
		<div class="empty-ico">🧾</div>
		<h3>No orders yet</h3>
		<p>Paste a customer's WhatsApp message and let the AI draft the order for you, or create one manually.</p>
		<div class="row"><button class="btn" on:click={() => (showAI = true)}>✨ AI draft from a message</button><button class="btn ghost" on:click={() => (showManual = true)}>New order</button></div>
	</div>
{:else if view === 'board'}
	<div class="board">
		{#each byColumn as col}
			<div class="col">
				<div class="col-head"><span>{col.label}</span><span class="count">{col.items.length}</span></div>
				<div class="col-body">
					{#each col.items as o (o.id)}
						<a class="ocard" href={`/portal/orders/${o.id}`}>
							<div class="ocard-top">
								<span class="onum">{o.number}</span>
								<span class="dot" style={`--c:${smeta(o.status).color}`} title={smeta(o.status).label}></span>
							</div>
							<div class="oname">{o.customer_name || o.customer_phone || 'Unknown customer'}</div>
							<div class="oitems">{(o.items || []).length} item{(o.items || []).length === 1 ? '' : 's'}{o.delivery_date ? ` · ${fmtDate(o.delivery_date)}` : ''}</div>
							<div class="ocard-bot">
								<span class="ototal">{money(o.total)}</span>
								<span class="pay p-{o.payment_status || 'unpaid'}">{payLabel[o.payment_status] || 'Unpaid'}</span>
								{#if o.confidence != null && o.status === 'draft'}<span class="conf" class:low={o.confidence < 70}>AI {o.confidence}%</span>{/if}
							</div>
						</a>
					{/each}
					{#if !col.items.length}<div class="col-empty">—</div>{/if}
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="card table-wrap">
		<table>
			<thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Delivery</th><th>Total</th><th>Status</th></tr></thead>
			<tbody>
				{#each orders as o (o.id)}
					<tr on:click={() => (window.location.href = `/portal/orders/${o.id}`)}>
						<td class="mono">{o.number}{#if o.confidence != null}<span class="conf sm" class:low={o.confidence < 70}>AI {o.confidence}%</span>{/if}</td>
						<td>{o.customer_name || o.customer_phone || '—'}</td>
						<td>{(o.items || []).length}</td>
						<td>{o.delivery_date ? fmtDate(o.delivery_date) : '—'}</td>
						<td class="mono">{money(o.total)}</td>
						<td><span class="tag" style={`--c:${smeta(o.status).color}`}>{smeta(o.status).label}</span></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<!-- AI draft modal -->
{#if showAI}
	<div class="scrim" on:click|self={() => (showAI = false)} role="presentation">
		<div class="modal">
			<div class="modal-head"><h3>✨ AI draft from a message</h3><button class="x" on:click={() => (showAI = false)}>✕</button></div>
			<p class="hint">Paste what the customer wrote (e.g. “I need 20 bags of cement delivered to Mikocheni tomorrow”). The AI extracts the items, quantities and delivery, priced from your catalogue.</p>
			<form method="POST" action="?/extract" use:enhance={afterSubmit}>
				<textarea name="message" rows="4" placeholder="Paste the customer's message…" required></textarea>
				<input class="in" name="customer_phone" placeholder="Customer phone (optional)" />
				<div class="modal-foot"><button type="button" class="btn ghost" on:click={() => (showAI = false)}>Cancel</button><button class="btn" type="submit">Extract order</button></div>
			</form>
		</div>
	</div>
{/if}

<!-- Manual create modal -->
{#if showManual}
	<div class="scrim" on:click|self={() => (showManual = false)} role="presentation">
		<div class="modal">
			<div class="modal-head"><h3>New order</h3><button class="x" on:click={() => (showManual = false)}>✕</button></div>
			<form method="POST" action="?/create" use:enhance={afterSubmit}>
				<div class="grid2">
					<input class="in" name="customer_name" placeholder="Customer name" />
					<input class="in" name="customer_phone" placeholder="Phone" />
				</div>
				<div class="items">
					{#each mItems as it, i}
						<div class="item-row">
							<input class="in" placeholder="Item / product" bind:value={it.description} />
							<input class="in qty" type="number" min="1" placeholder="Qty" bind:value={it.qty} />
							<input class="in price" type="number" min="0" step="0.01" placeholder="Unit price" bind:value={it.unit_price} />
							<button type="button" class="rm" on:click={() => rmItem(i)} disabled={mItems.length === 1}>✕</button>
						</div>
					{/each}
					<button type="button" class="add" on:click={addItem}>+ Add item</button>
				</div>
				<div class="grid2">
					<input class="in" name="delivery_date" type="date" />
					<input class="in" name="delivery_address" placeholder="Delivery address" />
				</div>
				<input class="in" name="notes" placeholder="Notes (optional)" />
				<input type="hidden" name="items" value={mItemsJson} />
				<div class="modal-foot">
					<span class="mtotal">Total: <b>{money(mTotal)}</b></span>
					<button type="button" class="btn ghost" on:click={() => (showManual = false)}>Cancel</button>
					<button class="btn" type="submit" disabled={!mItemsJson || mItemsJson === '[]'}>Create order</button>
				</div>
			</form>
		</div>
	</div>
{/if}
{/if}

<style>
	.seg { display: inline-flex; background: rgba(var(--fg-rgb), 0.06); border: 1px solid var(--edge); border-radius: 10px; padding: 2px; }
	.seg button { border: 0; background: transparent; color: var(--muted); font-weight: 600; font-size: 0.85rem; padding: 0.35rem 0.8rem; border-radius: 8px; cursor: pointer; }
	.seg button.on { background: var(--mint); color: #06331c; }

	.empty { text-align: center; padding: 3rem 1.5rem; }
	.empty-ico { font-size: 2.4rem; }
	.empty h3 { margin: 0.6rem 0 0.3rem; color: var(--strong); }
	.empty p { color: var(--muted); max-width: 44ch; margin: 0 auto 1.2rem; }
	.empty .row, .row { display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap; }

	.board { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(210px, 1fr); gap: 0.8rem; overflow-x: auto; padding-bottom: 0.5rem; }
	.col { background: rgba(var(--panel-rgb, 255, 255, 255), 0.03); border: 1px solid var(--edge); border-radius: 14px; min-height: 120px; display: flex; flex-direction: column; }
	.col-head { display: flex; align-items: center; justify-content: space-between; padding: 0.7rem 0.9rem; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--soft); border-bottom: 1px solid var(--edge); }
	.col-head .count { background: rgba(var(--panel-rgb, 255, 255, 255), 0.06); color: var(--muted); border-radius: 999px; padding: 0.05rem 0.5rem; font-size: 0.72rem; }
	.col-body { padding: 0.6rem; display: flex; flex-direction: column; gap: 0.55rem; }
	.col-empty { color: var(--faint); text-align: center; padding: 1rem 0; font-size: 0.85rem; }

	.ocard { display: block; background: var(--panel); border: 1px solid var(--edge); border-radius: 11px; padding: 0.7rem 0.8rem; text-decoration: none; transition: border-color 0.15s, transform 0.1s; }
	.ocard:hover { border-color: var(--mint); transform: translateY(-1px); }
	.ocard-top { display: flex; align-items: center; justify-content: space-between; }
	.onum { font-family: ui-monospace, monospace; font-size: 0.76rem; color: var(--muted); }
	.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 22%, transparent); }
	.oname { color: var(--strong); font-weight: 650; margin: 0.35rem 0 0.15rem; font-size: 0.95rem; }
	.oitems { color: var(--muted); font-size: 0.8rem; }
	.ocard-bot { display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem; }
	.ototal { font-weight: 700; color: var(--strong); font-size: 0.9rem; }
	.conf { font-size: 0.68rem; font-weight: 700; color: #6ee7a8; background: rgba(22, 163, 74, 0.16); padding: 0.1rem 0.4rem; border-radius: 999px; }
	.conf.low { color: #fcd34d; background: rgba(245, 158, 11, 0.16); }
	.conf.sm { margin-left: 0.5rem; }
	.pay { font-size: 0.66rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 999px; }
	.pay.p-unpaid { color: var(--muted); background: rgba(var(--panel-rgb, 255, 255, 255), 0.08); }
	.pay.p-pending { color: #fcd34d; background: rgba(245, 158, 11, 0.16); }
	.pay.p-paid { color: #6ee7a8; background: rgba(22, 163, 74, 0.16); }
	.pay.p-failed { color: #fca5a5; background: rgba(220, 38, 38, 0.16); }

	.table-wrap { overflow-x: auto; padding: 0; }
	table { width: 100%; border-collapse: collapse; }
	th { text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); padding: 0.8rem 1rem; border-bottom: 1px solid var(--edge); }
	td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--edge); color: var(--soft); font-size: 0.9rem; }
	tbody tr { cursor: pointer; }
	tbody tr:hover { background: rgba(var(--panel-rgb, 255, 255, 255), 0.03); }
	.mono { font-family: ui-monospace, monospace; }
	.tag { font-size: 0.75rem; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); padding: 0.15rem 0.55rem; border-radius: 999px; }

	.scrim { position: fixed; inset: 0; background: rgba(3, 12, 9, 0.62); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
	.modal { background: var(--panel); border: 1px solid var(--edge); border-radius: 18px; width: min(560px, 96vw); max-height: 90vh; overflow-y: auto; padding: 1.3rem; box-shadow: var(--shadow, 0 30px 60px -30px rgba(0,0,0,0.6)); }
	.modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; }
	.modal-head h3 { margin: 0; color: var(--strong); }
	.x { border: 0; background: transparent; color: var(--muted); font-size: 1rem; cursor: pointer; }
	.hint { color: var(--muted); font-size: 0.88rem; margin: 0 0 0.8rem; line-height: 1.5; }
	textarea, .in { width: 100%; background: rgba(var(--fg-rgb), 0.06); border: 1px solid var(--edge); border-radius: 10px; padding: 0.6rem 0.75rem; color: var(--strong); font: inherit; margin-bottom: 0.6rem; }
	textarea { resize: vertical; }
	.in:focus, textarea:focus { outline: none; border-color: var(--mint); }
	.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
	.items { border: 1px solid var(--edge); border-radius: 10px; padding: 0.6rem; margin-bottom: 0.6rem; }
	.item-row { display: grid; grid-template-columns: 1fr 70px 100px 28px; gap: 0.4rem; align-items: center; margin-bottom: 0.4rem; }
	.item-row .in { margin: 0; }
	.rm { border: 0; background: transparent; color: var(--muted); cursor: pointer; }
	.rm:disabled { opacity: 0.3; cursor: default; }
	.add { border: 1px dashed var(--edge); background: transparent; color: var(--mint); border-radius: 8px; padding: 0.4rem; width: 100%; cursor: pointer; font-weight: 600; }
	.modal-foot { display: flex; align-items: center; justify-content: flex-end; gap: 0.6rem; margin-top: 0.4rem; }
	.mtotal { margin-right: auto; color: var(--muted); font-size: 0.9rem; }
	.mtotal b { color: var(--strong); }
	code { background: rgba(var(--panel-rgb, 255, 255, 255), 0.08); padding: 0.05rem 0.3rem; border-radius: 5px; font-size: 0.85em; }
	@media (max-width: 620px) { .grid2 { grid-template-columns: 1fr; } .item-row { grid-template-columns: 1fr 56px 84px 24px; } }
</style>
