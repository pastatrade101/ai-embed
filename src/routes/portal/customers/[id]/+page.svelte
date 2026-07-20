<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: c = data.customer;
	$: orders = data.orders || [];
	$: currency = data.currency || 'USD';
	const money = (n) => `${currency} ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
	const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
	const statusColor = { draft: '#e0b24c', confirmed: '#2c9c6a', completed: '#16a34a', cancelled: '#dc2626' };
</script>

<a class="back" href="/portal/customers">← Customers</a>
{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}

<div class="head">
	<div class="avatar">{(c.name || c.phone || '?').trim().charAt(0).toUpperCase()}</div>
	<div class="who">
		<h1>{c.name || 'Unknown customer'}</h1>
		<div class="sub"><a href={`https://wa.me/${c.phone}`} target="_blank" rel="noopener noreferrer">{c.phone}</a>{c.email ? ` · ${c.email}` : ''}</div>
	</div>
	<div class="stats">
		<div><span class="s-v">{money(c.total_spent)}</span><span class="s-k">Total spent</span></div>
		<div><span class="s-v">{c.order_count}</span><span class="s-k">Orders</span></div>
	</div>
</div>

<div class="cols">
	<div class="main">
		<div class="card">
			<div class="card-h"><h3>Orders</h3></div>
			{#if orders.length}
				<table>
					<thead><tr><th>Order</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
					<tbody>
						{#each orders as o}
							<tr on:click={() => (window.location.href = `/portal/orders/${o.id}`)}>
								<td class="mono">{o.number}</td>
								<td><span class="tag" style={`--c:${statusColor[o.status] || '#7c8b83'}`}>{o.status}</span></td>
								<td class="mono">{money(o.total)}</td>
								<td>{fmt(o.created_at)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}<p class="empty">No orders yet.</p>{/if}
		</div>
	</div>

	<aside class="side">
		<div class="card">
			<div class="card-h"><h3>Details</h3></div>
			<form method="POST" action="?/save" use:enhance>
				<label class="fld"><span>Name</span><input class="in" name="name" value={c.name || ''} /></label>
				<label class="fld"><span>Email</span><input class="in" name="email" value={c.email || ''} /></label>
				<label class="fld"><span>Notes</span><textarea class="in" name="notes" rows="4" placeholder="Anything worth remembering…">{c.notes || ''}</textarea></label>
				<button class="btn" type="submit">Save</button>
			</form>
		</div>
	</aside>
</div>

<style>
	.back { color: var(--muted); text-decoration: none; font-size: 0.88rem; font-weight: 600; }
	.back:hover { color: var(--mint); }
	.head { display: flex; align-items: center; gap: 1rem; margin: 0.8rem 0 1.2rem; flex-wrap: wrap; }
	.avatar { width: 52px; height: 52px; border-radius: 14px; background: var(--mint); color: #06331c; display: grid; place-items: center; font-weight: 800; font-size: 1.3rem; flex: none; }
	.who { flex: 1; min-width: 180px; }
	.who h1 { margin: 0; color: var(--strong); font-size: 1.4rem; }
	.who .sub { color: var(--muted); font-size: 0.9rem; }
	.who a { color: var(--mint); text-decoration: none; }
	.stats { display: flex; gap: 1.5rem; }
	.stats div { display: flex; flex-direction: column; }
	.s-v { font-weight: 800; color: var(--strong); font-size: 1.15rem; }
	.s-k { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
	.cols { display: grid; grid-template-columns: 1fr 320px; gap: 1rem; align-items: start; }
	.card-h { margin-bottom: 0.7rem; }
	.card-h h3 { margin: 0; color: var(--strong); font-size: 1rem; }
	table { width: 100%; border-collapse: collapse; }
	th { text-align: left; font-size: 0.72rem; text-transform: uppercase; color: var(--muted); padding: 0.5rem; border-bottom: 1px solid var(--edge); }
	td { padding: 0.6rem 0.5rem; border-bottom: 1px solid var(--edge); color: var(--soft); font-size: 0.9rem; cursor: pointer; }
	tbody tr:hover { background: rgba(var(--panel-rgb, 255, 255, 255), 0.03); }
	.mono { font-family: ui-monospace, monospace; }
	.tag { font-size: 0.72rem; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); padding: 0.12rem 0.5rem; border-radius: 999px; text-transform: capitalize; }
	.empty { color: var(--faint); text-align: center; padding: 1.5rem; }
	.fld { display: flex; flex-direction: column; margin-bottom: 0.7rem; }
	.fld span { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 0.25rem; }
	.in { background: rgba(var(--panel-rgb, 255, 255, 255), 0.04); border: 1px solid var(--edge); border-radius: 10px; padding: 0.55rem 0.7rem; color: var(--strong); font: inherit; }
	.in:focus { outline: none; border-color: var(--mint); }
	textarea.in { resize: vertical; }
	@media (max-width: 820px) { .cols { grid-template-columns: 1fr; } }
</style>
