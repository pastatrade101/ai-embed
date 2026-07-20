<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	export let data;
	export let form;

	$: o = data.order;
	$: statuses = data.statuses || [];
	$: paymentStatuses = data.paymentStatuses || [];
	$: invoice = data.invoice;
	$: invoiceUrl = invoice && data.hostedBase ? `${data.hostedBase}/p/${invoice.public_token}` : null;
	$: timeline = data.timeline || [];
	$: currency = o?.currency || 'USD';
	const money = (n) => `${currency} ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
	const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
	const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
	const smeta = (key) => statuses.find((s) => s.key === key) || { key, label: key, color: '#7c8b83' };

	// Editable item rows (seeded from the order).
	let items = [];
	let editing = false;
	$: if (o && !editing) items = (o.items || []).map((it) => ({ ...it }));
	const addItem = () => (items = [...items, { description: '', qty: 1, unit_price: 0 }]);
	const rmItem = (i) => (items = items.filter((_, ix) => ix !== i));
	$: itemsJson = JSON.stringify(items.filter((it) => String(it.description).trim()));
	$: liveSubtotal = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);

	// The forward pipeline for the primary CTA (Draft → Confirmed → Processing → Completed).
	const NEXT = { draft: 'confirmed', confirmed: 'completed' };
	$: nextStatus = NEXT[o?.status];

	function afterSave() {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') { editing = false; await invalidateAll(); }
		};
	}
</script>

<a class="back" href="/portal/orders">← Orders</a>

{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}

<div class="head">
	<div>
		<div class="num">{o.number}</div>
		<h1>{o.customer_name || o.customer_phone || 'Order'}</h1>
		<div class="meta">
			<span class="tag" style={`--c:${smeta(o.status).color}`}>{smeta(o.status).label}</span>
			<span class="src">via {o.source}</span>
			{#if o.confidence != null}<span class="conf" class:low={o.confidence < 70}>AI {o.confidence}%</span>{/if}
			<span class="src">· {fmt(o.created_at)}</span>
		</div>
	</div>
	<div class="head-actions">
		{#if nextStatus}
			<form method="POST" action="?/status" use:enhance={afterSave} style="display:inline">
				<input type="hidden" name="status" value={nextStatus} />
				<button class="btn">{o.status === 'draft' ? '✓ Confirm order' : `→ ${smeta(nextStatus).label}`}</button>
			</form>
		{/if}
		<select class="statussel" on:change={(e) => { const f = e.target.closest('.head-actions').querySelector('form.jump'); f.querySelector('[name=status]').value = e.target.value; f.requestSubmit(); }}>
			<option disabled selected>Set status…</option>
			{#each statuses as s}<option value={s.key}>{s.label}</option>{/each}
		</select>
		<form class="jump" method="POST" action="?/status" use:enhance={afterSave} style="display:none"><input type="hidden" name="status" /></form>
	</div>
</div>

{#if data.rememberable > 0}
	<div class="remember">
		<span>✨ You priced {data.rememberable} item{data.rememberable === 1 ? '' : 's'} the AI didn’t recognise. Remember {data.rememberable === 1 ? 'it' : 'them'} so it auto-fills next time?</span>
		<form method="POST" action="?/remember" use:enhance={afterSave}><button class="btn sm" type="submit">Remember price{data.rememberable === 1 ? '' : 's'}</button></form>
	</div>
{/if}

<div class="cols">
	<div class="main">
		<div class="card">
			<div class="card-h"><h3>Items</h3>{#if !editing}<button class="link" on:click={() => (editing = true)}>Edit</button>{/if}</div>
			{#if editing}
				<div class="items-edit">
					{#each items as it, i}
						<div class="item-row">
							<input class="in" placeholder="Item" bind:value={it.description} />
							<input class="in qty" type="number" min="1" bind:value={it.qty} />
							<input class="in price" type="number" min="0" step="0.01" bind:value={it.unit_price} />
							<button type="button" class="rm" on:click={() => rmItem(i)} disabled={items.length === 1}>✕</button>
						</div>
					{/each}
					<button type="button" class="add" on:click={addItem}>+ Add item</button>
				</div>
				<form method="POST" action="?/save" use:enhance={afterSave} class="save-row">
					<input type="hidden" name="items" value={itemsJson} />
					<input type="hidden" name="customer_name" value={o.customer_name || ''} />
					<input type="hidden" name="customer_phone" value={o.customer_phone || ''} />
					<input type="hidden" name="delivery_date" value={o.delivery_date || ''} />
					<input type="hidden" name="delivery_address" value={o.delivery_address || ''} />
					<input type="hidden" name="notes" value={o.notes || ''} />
					<input type="hidden" name="internal_notes" value={o.internal_notes || ''} />
					<span class="live">Subtotal {money(liveSubtotal)}</span>
					<button type="button" class="btn ghost" on:click={() => { editing = false; items = (o.items || []).map((x) => ({ ...x })); }}>Cancel</button>
					<button class="btn" type="submit">Save items</button>
				</form>
			{:else}
				<table class="items">
					<thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead>
					<tbody>
						{#each o.items || [] as it}
							<tr><td>{it.description}</td><td>{it.qty}</td><td class="mono">{money(it.unit_price)}</td><td class="mono">{money(it.amount)}</td></tr>
						{/each}
						{#if !(o.items || []).length}<tr><td colspan="4" class="empty">No items.</td></tr>{/if}
					</tbody>
				</table>
				<div class="totals">
					<div><span>Subtotal</span><b>{money(o.subtotal)}</b></div>
					{#if Number(o.discount)}<div><span>Discount</span><b>−{money(o.discount)}</b></div>{/if}
					{#if Number(o.tax)}<div><span>Tax</span><b>{money(o.tax)}</b></div>{/if}
					<div class="grand"><span>Total</span><b>{money(o.total)}</b></div>
				</div>
			{/if}
		</div>

		{#if o.notes}<div class="card"><div class="card-h"><h3>Notes</h3></div><p class="body">{o.notes}</p></div>{/if}

		<div class="card">
			<div class="card-h"><h3>Timeline</h3></div>
			<ul class="tl">
				{#each timeline as e}
					<li><span class="tl-dot"></span><span class="tl-t">{e.type.replace(/_/g, ' ').replace('status ', '')}</span><span class="tl-at">{fmt(e.at)}</span></li>
				{/each}
				{#if !timeline.length}<li class="empty">No events yet.</li>{/if}
			</ul>
		</div>
	</div>

	<aside class="side">
		<div class="card">
			<div class="card-h"><h3>Customer</h3></div>
			<dl>
				<div><dt>Name</dt><dd>{o.customer_name || '—'}</dd></div>
				<div><dt>Phone</dt><dd>{o.customer_phone || '—'}</dd></div>
				<div><dt>Email</dt><dd>{o.customer_email || '—'}</dd></div>
			</dl>
		</div>
		<div class="card">
			<div class="card-h"><h3>Delivery</h3></div>
			<dl>
				<div><dt>Date</dt><dd>{fmtDay(o.delivery_date)}</dd></div>
				<div><dt>Address</dt><dd>{o.delivery_address || '—'}</dd></div>
			</dl>
		</div>
		<div class="card">
			<div class="card-h"><h3>Payment</h3><span class="pay p-{o.payment_status || 'unpaid'}">{(o.payment_status || 'unpaid').charAt(0).toUpperCase() + (o.payment_status || 'unpaid').slice(1)}</span></div>
			<div class="paybtns">
				{#each paymentStatuses as ps}
					<form method="POST" action="?/pay" use:enhance={afterSave} style="display:inline">
						<input type="hidden" name="payment_status" value={ps.key} />
						<button class="paybtn" class:on={o.payment_status === ps.key} type="submit">{ps.label}</button>
					</form>
				{/each}
			</div>
		</div>

		<div class="card">
			<div class="card-h"><h3>Invoice</h3></div>
			{#if invoice}
				<div class="inv"><span class="inv-num">{invoice.number}</span><span class="inv-total">{money(invoice.total)}</span></div>
				{#if invoiceUrl}
					<div class="inv-actions">
						<a class="btn ghost sm" href={invoiceUrl} target="_blank" rel="noopener noreferrer">View</a>
						<button class="btn ghost sm" on:click={() => { navigator.clipboard?.writeText(invoiceUrl); }}>Copy link</button>
						{#if o.customer_phone}<a class="btn sm" href={`https://wa.me/${o.customer_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Here's your invoice ${invoice.number}: ${invoiceUrl}`)}`} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>{/if}
					</div>
				{/if}
			{:else}
				<p class="muted-sm">No invoice yet.</p>
				<form method="POST" action="?/invoice" use:enhance={afterSave}><button class="btn" type="submit">Generate invoice</button></form>
			{/if}
		</div>

		{#if o.meta?.reasoning}
			<div class="card ai">
				<div class="card-h"><h3>✨ AI understood</h3></div>
				<p class="body">{o.meta.reasoning}</p>
				{#if o.meta.raw_message}<p class="raw">“{o.meta.raw_message}”</p>{/if}
			</div>
		{/if}
		<form method="POST" action="?/remove" use:enhance on:submit={(e) => { if (!confirm('Delete this order?')) e.preventDefault(); }}>
			<button class="btn ghost danger" type="submit">Delete order</button>
		</form>
	</aside>
</div>

<style>
	.back { color: var(--muted); text-decoration: none; font-size: 0.88rem; font-weight: 600; }
	.back:hover { color: var(--mint); }
	.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin: 0.8rem 0 1.2rem; flex-wrap: wrap; }
	.num { font-family: ui-monospace, monospace; color: var(--muted); font-size: 0.8rem; }
	.head h1 { margin: 0.2rem 0 0.4rem; color: var(--strong); }
	.meta { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
	.tag { font-size: 0.75rem; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); padding: 0.15rem 0.6rem; border-radius: 999px; }
	.src { color: var(--muted); font-size: 0.82rem; }
	.conf { font-size: 0.7rem; font-weight: 700; color: #6ee7a8; background: rgba(22, 163, 74, 0.16); padding: 0.1rem 0.45rem; border-radius: 999px; }
	.conf.low { color: #fcd34d; background: rgba(245, 158, 11, 0.16); }
	.head-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
	.statussel { background: rgba(var(--panel-rgb, 255, 255, 255), 0.04); border: 1px solid var(--edge); border-radius: 9px; color: var(--soft); padding: 0.45rem 0.6rem; font: inherit; }

	.cols { display: grid; grid-template-columns: 1fr 320px; gap: 1rem; align-items: start; }
	.card { margin-bottom: 1rem; }
	.card-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.7rem; }
	.card-h h3 { margin: 0; color: var(--strong); font-size: 1rem; }
	.link { border: 0; background: transparent; color: var(--mint); cursor: pointer; font-weight: 600; font-size: 0.85rem; }
	.body { color: var(--soft); line-height: 1.6; margin: 0; }

	table.items { width: 100%; border-collapse: collapse; }
	table.items th { text-align: left; font-size: 0.72rem; text-transform: uppercase; color: var(--muted); padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--edge); }
	table.items td { padding: 0.5rem; border-bottom: 1px solid var(--edge); color: var(--soft); font-size: 0.9rem; }
	.mono { font-family: ui-monospace, monospace; }
	.empty { color: var(--faint); text-align: center; }
	.totals { margin-top: 0.8rem; margin-left: auto; max-width: 240px; }
	.totals div { display: flex; justify-content: space-between; padding: 0.2rem 0; color: var(--muted); font-size: 0.9rem; }
	.totals .grand { border-top: 1px solid var(--edge); margin-top: 0.3rem; padding-top: 0.5rem; color: var(--strong); font-size: 1rem; }
	.totals b { color: var(--strong); }

	.items-edit { display: flex; flex-direction: column; gap: 0.4rem; }
	.item-row { display: grid; grid-template-columns: 1fr 64px 96px 26px; gap: 0.4rem; align-items: center; }
	.in { background: rgba(var(--panel-rgb, 255, 255, 255), 0.04); border: 1px solid var(--edge); border-radius: 9px; padding: 0.45rem 0.55rem; color: var(--strong); font: inherit; width: 100%; }
	.in:focus { outline: none; border-color: var(--mint); }
	.rm { border: 0; background: transparent; color: var(--muted); cursor: pointer; }
	.rm:disabled { opacity: 0.3; }
	.add { border: 1px dashed var(--edge); background: transparent; color: var(--mint); border-radius: 8px; padding: 0.4rem; cursor: pointer; font-weight: 600; }
	.save-row { display: flex; align-items: center; gap: 0.6rem; margin-top: 0.7rem; }
	.live { margin-right: auto; color: var(--muted); font-size: 0.88rem; }

	dl { margin: 0; }
	dl div { display: flex; justify-content: space-between; gap: 0.5rem; padding: 0.35rem 0; border-bottom: 1px solid var(--edge); }
	dl div:last-child { border-bottom: 0; }
	dt { color: var(--muted); font-size: 0.82rem; }
	dd { margin: 0; color: var(--soft); font-size: 0.88rem; text-align: right; }

	.ai { border-color: color-mix(in srgb, var(--mint) 40%, var(--edge)); }
	.raw { color: var(--muted); font-style: italic; font-size: 0.85rem; margin: 0.5rem 0 0; }
	.pay { font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 999px; }
	.pay.p-unpaid { color: var(--muted); background: rgba(var(--panel-rgb, 255, 255, 255), 0.08); }
	.pay.p-pending { color: #fcd34d; background: rgba(245, 158, 11, 0.16); }
	.pay.p-paid { color: #6ee7a8; background: rgba(22, 163, 74, 0.16); }
	.pay.p-failed { color: #fca5a5; background: rgba(220, 38, 38, 0.16); }
	.paybtns { display: flex; flex-wrap: wrap; gap: 0.35rem; }
	.paybtn { border: 1px solid var(--edge); background: transparent; color: var(--muted); border-radius: 8px; padding: 0.3rem 0.6rem; font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
	.paybtn.on { background: var(--mint); color: #06331c; border-color: var(--mint); }
	.paybtn:hover:not(.on) { border-color: var(--mint); color: var(--soft); }
	.inv { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; }
	.inv-num { font-family: ui-monospace, monospace; color: var(--soft); font-size: 0.9rem; }
	.inv-total { font-weight: 700; color: var(--strong); }
	.inv-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
	.muted-sm { color: var(--muted); font-size: 0.85rem; margin: 0 0 0.6rem; }
	.remember { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; background: color-mix(in srgb, var(--mint) 10%, var(--panel)); border: 1px solid color-mix(in srgb, var(--mint) 40%, var(--edge)); border-radius: 12px; padding: 0.7rem 0.9rem; margin-bottom: 1rem; }
	.remember span { flex: 1; color: var(--soft); font-size: 0.9rem; min-width: 200px; }
	.danger { color: #fca5a5; width: 100%; }
	.tl { list-style: none; margin: 0; padding: 0; }
	.tl li { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0; font-size: 0.85rem; color: var(--soft); }
	.tl-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--mint); flex: none; }
	.tl-t { text-transform: capitalize; }
	.tl-at { margin-left: auto; color: var(--muted); font-size: 0.78rem; }
	@media (max-width: 820px) { .cols { grid-template-columns: 1fr; } }
</style>
