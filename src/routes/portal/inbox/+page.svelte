<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	export let data;
	export let form;

	$: drafts = data.drafts || [];
	$: currency = data.currency || 'USD';
	const money = (n) => `${currency} ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
	const UNSURE = 70;

	let selectedId = null;
	let edit = null;
	$: selected = drafts.find((d) => d.id === selectedId) || null;

	function selectItem(d) {
		selectedId = d.id;
		edit = {
			customer_name: d.customer_name || '',
			delivery_address: d.delivery_address || '',
			delivery_date: d.delivery_date || '',
			items: (d.items || []).map((it) => ({ ...it }))
		};
	}
	// Auto-select the first draft when nothing is selected.
	$: if ((!selectedId || !selected) && drafts.length) selectItem(drafts[0]);

	const ex = (d) => (d && d.meta && d.meta.extraction) || {};
	const customerUnsure = (d) => { const e = ex(d); return (e.missing_fields || []).includes('customer_name') || (e.customer_confidence ?? 100) < UNSURE || !d.customer_name; };
	const deliveryUnsure = (d) => { const e = ex(d); return (e.missing_fields || []).some((f) => f === 'delivery_address' || f === 'delivery_date') || (e.delivery_confidence ?? 100) < UNSURE; };
	const itemUnsure = (it) => (it.item_confidence ?? 100) < UNSURE || it.unmatched || !(Number(it.unit_price) > 0);
	const toCheck = (d) => (customerUnsure(d) ? 1 : 0) + (deliveryUnsure(d) ? 1 : 0) + (d.items || []).filter(itemUnsure).length;
	const summary = (d) => (d.items || []).map((it) => `${it.qty}× ${it.description}`).join(', ') || 'No items';
	const ago = (dt) => { if (!dt) return ''; const s = (Date.now() - new Date(dt).getTime()) / 1000; if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`; if (s < 86400) return `${Math.round(s / 3600)}h`; return `${Math.round(s / 86400)}d`; };

	$: liveTotal = edit ? edit.items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0) : 0;
	$: itemsJson = edit ? JSON.stringify(edit.items) : '[]';
	$: question = selected ? ex(selected).clarification_question : null;
	$: askLink = selected && selected.customer_phone && question ? `https://wa.me/${String(selected.customer_phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(question)}` : null;

	function afterAction() {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') { selectedId = null; await invalidateAll(); }
		};
	}
</script>

<div class="page-head">
	<div>
		<h1>Inbox</h1>
		<div class="sub">WhatsApp messages the AI turned into draft orders. Check what’s highlighted, then confirm.</div>
	</div>
	{#if data.enabled}<span class="badge {drafts.length ? 'neutral' : ''}">{drafts.length} to review</span>{/if}
</div>

{#if !data.enabled}
	<div class="empty card"><div class="empty-ico">🧩</div><h3>Orders isn’t enabled</h3><p>Turn on Orders to start turning WhatsApp messages into confirmed orders.</p><a class="btn" href="/portal/modules">Enable in Modules →</a></div>
{:else if data.needsMigration}
	<div class="notice err">Run <code>db/023_orders.sql</code> in Supabase to enable this.</div>
{:else if !drafts.length}
	<div class="empty card"><div class="empty-ico">✨</div><h3>All caught up</h3><p>New WhatsApp order messages will appear here as draft orders to review. You can also paste one in <a href="/portal/orders">Orders → AI draft</a>.</p></div>
{:else}
	{#if form?.error}<div class="notice err">{form.error}</div>{/if}
	<div class="triage">
		<!-- Left: queue -->
		<aside class="queue">
			{#each drafts as d (d.id)}
				<button class="qcard" class:on={selected && selected.id === d.id} on:click={() => selectItem(d)}>
					<div class="qtop"><span class="qwho">{d.customer_name || d.customer_phone || 'Unknown'}</span><span class="qtime">{ago(d.created_at)}</span></div>
					<div class="qsum">{summary(d)}</div>
					<div class="qbot"><span class="qtotal">{money(d.total)}</span>{#if toCheck(d) > 0}<span class="qcheck">{toCheck(d)} to check</span>{:else}<span class="qready">ready</span>{/if}</div>
				</button>
			{/each}
		</aside>

		<!-- Right: review -->
		{#if selected && edit}
			<section class="review">
				{#if ex(selected).reasoning || selected.meta?.raw_message}
					<div class="msg">
						<div class="msg-label">Customer wrote</div>
						<p class="msg-body">“{selected.meta?.raw_message || ex(selected).reasoning}”</p>
					</div>
				{/if}

				<div class="field" class:flag={customerUnsure(selected)}>
					<label>Customer{#if customerUnsure(selected)}<span class="need">check</span>{/if}</label>
					<input class="in" bind:value={edit.customer_name} placeholder="Customer name" />
					<div class="hint">{selected.customer_phone || '—'}</div>
				</div>

				<div class="field">
					<label>Items</label>
					<div class="items">
						{#each edit.items as it, i}
							<div class="irow" class:flag={itemUnsure(it)}>
								<input class="in iname" bind:value={it.description} />
								<input class="in iqty" type="number" min="1" bind:value={it.qty} />
								<span class="ix">×</span>
								<input class="in iprice" type="number" min="0" step="0.01" bind:value={it.unit_price} placeholder="price" />
								<span class="iamt">{money((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}</span>
							</div>
							{#if it.raw_text && it.raw_text.toLowerCase() !== String(it.description).toLowerCase()}<div class="iraw">from “{it.raw_text}”{#if it.unmatched} · new item{/if}</div>{/if}
						{/each}
					</div>
				</div>

				<div class="field" class:flag={deliveryUnsure(selected)}>
					<label>Delivery{#if deliveryUnsure(selected)}<span class="need">check</span>{/if}</label>
					<div class="grid2">
						<input class="in" bind:value={edit.delivery_address} placeholder="Address / area" />
						<input class="in" type="date" bind:value={edit.delivery_date} />
					</div>
				</div>

				<div class="total-row"><span>Total</span><b>{money(liveTotal)}</b></div>

				{#if question}
					<div class="ask">
						<span>💬 AI suggests asking: <em>“{question}”</em></span>
						{#if askLink}<a class="btn ghost sm" href={askLink} target="_blank" rel="noopener noreferrer">Ask on WhatsApp</a>{/if}
					</div>
				{/if}

				<div class="review-actions">
					<form method="POST" action="?/dismiss" use:enhance={afterAction}>
						<input type="hidden" name="id" value={selected.id} />
						<button class="btn ghost danger" type="submit">Dismiss</button>
					</form>
					<div class="spacer"></div>
					<form method="POST" action="?/save" use:enhance={afterAction} class="inline">
						<input type="hidden" name="id" value={selected.id} />
						<input type="hidden" name="customer_name" value={edit.customer_name} />
						<input type="hidden" name="delivery_address" value={edit.delivery_address} />
						<input type="hidden" name="delivery_date" value={edit.delivery_date} />
						<input type="hidden" name="items" value={itemsJson} />
						<button class="btn ghost" type="submit">Save for later</button>
					</form>
					<form method="POST" action="?/confirm" use:enhance={afterAction} class="inline">
						<input type="hidden" name="id" value={selected.id} />
						<input type="hidden" name="customer_name" value={edit.customer_name} />
						<input type="hidden" name="delivery_address" value={edit.delivery_address} />
						<input type="hidden" name="delivery_date" value={edit.delivery_date} />
						<input type="hidden" name="items" value={itemsJson} />
						<button class="btn confirm" type="submit">✓ Confirm order</button>
					</form>
				</div>
			</section>
		{/if}
	</div>
{/if}

<style>
	.empty { text-align: center; padding: 3rem 1.5rem; }
	.empty-ico { font-size: 2.4rem; }
	.empty h3 { margin: 0.6rem 0 0.3rem; color: var(--strong); }
	.empty p { color: var(--muted); max-width: 46ch; margin: 0 auto 1.2rem; }
	.triage { display: grid; grid-template-columns: 300px 1fr; gap: 1rem; align-items: start; }

	.queue { display: flex; flex-direction: column; gap: 0.5rem; max-height: 78vh; overflow-y: auto; }
	.qcard { text-align: left; background: var(--panel); border: 1px solid var(--edge); border-radius: 12px; padding: 0.7rem 0.8rem; cursor: pointer; transition: border-color 0.14s; }
	.qcard:hover { border-color: color-mix(in srgb, var(--mint) 40%, var(--edge)); }
	.qcard.on { border-color: var(--mint); box-shadow: 0 0 0 1px var(--mint); }
	.qtop { display: flex; justify-content: space-between; align-items: baseline; }
	.qwho { font-weight: 650; color: var(--strong); font-size: 0.92rem; }
	.qtime { color: var(--muted); font-size: 0.75rem; }
	.qsum { color: var(--soft); font-size: 0.83rem; margin: 0.2rem 0 0.4rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.qbot { display: flex; justify-content: space-between; align-items: center; }
	.qtotal { font-weight: 700; color: var(--strong); font-size: 0.88rem; }
	.qcheck { font-size: 0.7rem; font-weight: 700; color: #fcd34d; background: rgba(245, 158, 11, 0.16); padding: 0.1rem 0.45rem; border-radius: 999px; }
	.qready { font-size: 0.7rem; font-weight: 700; color: #6ee7a8; background: rgba(22, 163, 74, 0.16); padding: 0.1rem 0.45rem; border-radius: 999px; }

	.review { background: var(--panel); border: 1px solid var(--edge); border-radius: 16px; padding: 1.3rem; }
	.msg { background: rgba(var(--fg-rgb), 0.04); border-left: 3px solid var(--mint); border-radius: 0 10px 10px 0; padding: 0.7rem 0.9rem; margin-bottom: 1.1rem; }
	.msg-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 700; }
	.msg-body { margin: 0.25rem 0 0; color: var(--soft); font-style: italic; }

	.field { margin-bottom: 1.1rem; border-radius: 10px; }
	.field.flag { background: rgba(245, 158, 11, 0.07); border: 1px solid rgba(245, 158, 11, 0.35); padding: 0.7rem 0.8rem; margin-left: -0.8rem; margin-right: -0.8rem; }
	.field label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 700; margin-bottom: 0.4rem; }
	.need { color: #b45309; background: rgba(245, 158, 11, 0.2); font-size: 0.62rem; padding: 0.05rem 0.4rem; border-radius: 999px; }
	:global(:root[data-theme='light']) .need { color: #92600a; }
	.in { width: 100%; background: rgba(var(--fg-rgb), 0.05); border: 1px solid var(--edge); border-radius: 9px; padding: 0.5rem 0.65rem; color: var(--strong); font: inherit; }
	.in:focus { outline: none; border-color: var(--mint); }
	.hint { color: var(--muted); font-size: 0.8rem; margin-top: 0.25rem; }
	.grid2 { display: grid; grid-template-columns: 1fr 160px; gap: 0.5rem; }

	.items { display: flex; flex-direction: column; gap: 0.4rem; }
	.irow { display: grid; grid-template-columns: 1fr 60px 14px 100px auto; gap: 0.4rem; align-items: center; border-radius: 8px; }
	.irow.flag { background: rgba(245, 158, 11, 0.08); box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.3); padding: 0.25rem; }
	.iname { min-width: 0; }
	.ix { color: var(--muted); text-align: center; }
	.iamt { font-family: ui-monospace, monospace; font-size: 0.85rem; color: var(--strong); text-align: right; padding-left: 0.3rem; }
	.iraw { font-size: 0.74rem; color: var(--muted); margin: -0.1rem 0 0.2rem 0.1rem; }

	.total-row { display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid var(--edge); padding-top: 0.7rem; margin-top: 0.3rem; }
	.total-row b { font-size: 1.15rem; color: var(--strong); }
	.ask { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; background: rgba(var(--fg-rgb), 0.04); border-radius: 10px; padding: 0.6rem 0.8rem; margin: 0.9rem 0; }
	.ask span { flex: 1; color: var(--soft); font-size: 0.85rem; min-width: 200px; }
	.ask em { color: var(--strong); }

	.review-actions { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; }
	.review-actions .spacer { flex: 1; }
	.review-actions .inline { display: inline; }
	.btn.confirm { background: #16a34a; color: #fff; font-weight: 700; }
	.btn.confirm:hover { background: #15803d; }
	.btn.danger { color: #fca5a5; }
	code { background: rgba(var(--fg-rgb), 0.08); padding: 0.05rem 0.3rem; border-radius: 5px; }
	@media (max-width: 820px) { .triage { grid-template-columns: 1fr; } .queue { max-height: none; flex-direction: row; overflow-x: auto; } .qcard { min-width: 220px; } }
</style>
