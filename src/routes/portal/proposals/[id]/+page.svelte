<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;

	// Re-seed the editor whenever the proposal changes (load, save, AI generate).
	// But NEVER clobber unsaved edits from a passive re-run (e.g. after Send/Mark,
	// which bump updated_at without returning a proposal) — only re-seed when the
	// server explicitly returned one (save/generate) or the editor is clean.
	let seededAt = null;
	let dirty = false;
	let title = '', docType = 'quotation', customer_name = '', customer_email = '', customer_phone = '', currency = 'USD', valid_until = '', intro = '', summary = '', terms = '', notes = '', discount = 0, tax = 0;
	let items = [];
	$: src = form?.proposal ?? data.proposal;
	$: if (src && src.updated_at !== seededAt && (form?.proposal || !dirty)) seedFrom(src);
	function seedFrom(p) {
		seededAt = p.updated_at;
		title = p.title ?? ''; docType = p.doc_type ?? 'quotation';
		customer_name = p.customer_name ?? ''; customer_email = p.customer_email ?? ''; customer_phone = p.customer_phone ?? '';
		currency = p.currency ?? 'USD'; valid_until = p.valid_until ?? '';
		intro = p.intro ?? ''; summary = p.summary ?? ''; terms = p.terms ?? ''; notes = p.notes ?? '';
		discount = Number(p.discount) || 0; tax = Number(p.tax) || 0;
		items = (Array.isArray(p.line_items) ? p.line_items : []).map((li) => ({ description: li.description ?? '', detail: li.detail ?? '', qty: Number(li.qty) || 1, unit_price: Number(li.unit_price) || 0 }));
		if (!items.length) items = [{ description: '', detail: '', qty: 1, unit_price: 0 }];
		dirty = false;
	}

	const money = (n) => {
		try {
			return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'USD').slice(0, 3).toUpperCase(), maximumFractionDigits: 2 }).format(Number(n) || 0);
		} catch {
			return `${currency || 'USD'} ${(Number(n) || 0).toFixed(2)}`;
		}
	};
	$: lineAmount = (li) => (li.qty == null || li.qty === '' ? 1 : Number(li.qty) || 0) * (Number(li.unit_price) || 0);
	$: subtotal = items.reduce((a, li) => a + lineAmount(li), 0);
	$: total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(tax) || 0));
	$: itemsJson = JSON.stringify(items.filter((li) => li.description || li.unit_price));

	const addItem = () => { items = [...items, { description: '', detail: '', qty: 1, unit_price: 0 }]; dirty = true; };
	const removeItem = (i) => { items = items.filter((_, x) => x !== i); dirty = true; };

	$: statusMeta = { draft: 'Draft', sent: 'Sent', viewed: 'Viewed', accepted: 'Accepted', declined: 'Declined', expired: 'Expired', converted: 'Won' };
	$: waUrl = customer_phone ? `https://wa.me/${customer_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Here's your ${docLabel().toLowerCase()}: ${data.hostedUrl}`)}` : null;
	const docLabel = () => (data.docTypes.find((d) => d.key === docType) || {}).label || 'Proposal';

	let copied = false;
	async function copyLink() {
		try { await navigator.clipboard.writeText(data.hostedUrl); copied = true; setTimeout(() => (copied = false), 1800); } catch (_) {}
	}
	let generating = false, saving = false;
	const meta = src?.meta ?? {};
</script>

<div class="page-head">
	<div>
		<a href="/portal/proposals" class="back">← Proposals</a>
		<h1>{docLabel()} {src.number}</h1>
		<div class="sub">{customer_name || 'New proposal'} · <span class="badge s-{src.status}">{statusMeta[src.status] || src.status}</span></div>
	</div>
	<a class="btn ghost" href={`${data.hostedUrl}?preview=1`} target="_blank" rel="noopener">View page ↗</a>
</div>

{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}

<div class="grid">
	<!-- Editor ---------------------------------------------------------------->
	<form method="POST" action="?/save" on:input={() => (dirty = true)} use:enhance={() => { saving = true; return async ({ update }) => { await update({ reset: false }); saving = false; }; }} class="col-main">
		<input type="hidden" name="line_items" value={itemsJson} />

		<div class="card grid-fields">
			<h2 class="section" style="margin:0">Customer</h2>
			<div class="row">
				<div><label>Name<input name="customer_name" bind:value={customer_name} placeholder="Customer name" /></label></div>
				<div><label>Email<input name="customer_email" type="email" bind:value={customer_email} placeholder="customer@email.com" /></label></div>
			</div>
			<div class="row">
				<div><label>Phone / WhatsApp<input name="customer_phone" bind:value={customer_phone} placeholder="+255…" /></label></div>
				<div><label>Document type<select name="doc_type" bind:value={docType}>{#each data.docTypes as d}<option value={d.key}>{d.label}</option>{/each}</select></label></div>
			</div>
		</div>

		<div class="card">
			<div class="ai-head">
				<div><h2 class="section" style="margin:0">Content</h2><div class="muted" style="font-size:.82rem">Let AI draft it from the lead + your catalogue, then edit.</div></div>
				<button class="btn gold sm" form="ai-form" disabled={generating}>{generating ? 'Generating…' : '✦ Generate with AI'}</button>
			</div>
			<div><label>Title<input name="title" bind:value={title} placeholder={`${docLabel()} for …`} /></label></div>
			<div><label>Introduction<textarea name="intro" bind:value={intro} rows="3" placeholder="A warm, professional opening for the customer…"></textarea></label></div>
			<div><label>Summary / recommended solution<textarea name="summary" bind:value={summary} rows="3" placeholder="What you recommend and why it fits…"></textarea></label></div>
		</div>

		<div class="card">
			<h2 class="section" style="margin:0">Line items</h2>
			<div class="items">
				{#each items as li, i}
					<div class="li">
						<div class="li-desc">
							<input placeholder="Item or service" bind:value={li.description} />
							<input class="li-detail" placeholder="What's included (optional)" bind:value={li.detail} />
						</div>
						<input class="li-qty" type="number" min="0" bind:value={li.qty} title="Qty" />
						<input class="li-price" type="number" min="0" step="0.01" bind:value={li.unit_price} title="Unit price" />
						<div class="li-amt">{money(lineAmount(li))}</div>
						<button type="button" class="li-x" on:click={() => removeItem(i)} title="Remove" aria-label="Remove">✕</button>
					</div>
				{/each}
			</div>
			<button type="button" class="btn ghost sm" on:click={addItem}>+ Add item</button>

			<div class="totals">
				<div class="tr"><span>Subtotal</span><span>{money(subtotal)}</span></div>
				<div class="tr"><label>Discount<input name="discount" type="number" min="0" step="0.01" bind:value={discount} /></label></div>
				<div class="tr"><label>Tax<input name="tax" type="number" min="0" step="0.01" bind:value={tax} /></label></div>
				<div class="tr grand"><span>Total</span><span>{money(total)}</span></div>
			</div>
			<div class="row">
				<div style="max-width:160px"><label>Currency<input name="currency" bind:value={currency} /></label></div>
				<div style="max-width:200px"><label>Valid until<input name="valid_until" type="date" bind:value={valid_until} /></label></div>
			</div>
		</div>

		<div class="card">
			<div><label>Terms &amp; conditions<textarea name="terms" bind:value={terms} rows="3"></textarea></label></div>
			<div><label>Internal notes (not shown to customer)<textarea name="notes" bind:value={notes} rows="2"></textarea></label></div>
		</div>

		<div class="save-bar"><button class="btn" disabled={saving}>{saving ? 'Saving…' : 'Save proposal'}</button>{#if dirty}<span class="unsaved">● Unsaved changes</span>{/if}</div>
	</form>

	<!-- Side: AI form, send, timeline ---------------------------------------->
	<div class="col-side">
		<form id="ai-form" method="POST" action="?/generate" use:enhance={() => { generating = true; return async ({ update }) => { await update({ reset: false }); generating = false; }; }} class="card ai-side">
			<h2 class="section" style="margin:0">AI draft</h2>
			<textarea name="instructions" rows="2" placeholder="Optional: e.g. 'emphasise the premium package', 'add a 10% early-bird note'"></textarea>
			<button class="btn gold" disabled={generating}>{generating ? 'Generating…' : '✦ Generate proposal'}</button>
			{#if meta.aiUpsell?.length || meta.aiCrossSell?.length}
				<div class="sugg">
					{#if meta.aiUpsell?.length}<div class="sugg-h">Upsell ideas</div><div class="chips">{#each meta.aiUpsell as u}<span class="chip">{u}</span>{/each}</div>{/if}
					{#if meta.aiCrossSell?.length}<div class="sugg-h">Cross-sell</div><div class="chips">{#each meta.aiCrossSell as c}<span class="chip">{c}</span>{/each}</div>{/if}
				</div>
			{/if}
		</form>

		<div class="card send">
			<h2 class="section" style="margin:0">Send</h2>
			<p class="muted" style="font-size:.82rem;margin:.2rem 0 .6rem">Save first, then share. The customer views a branded page and can accept.</p>
			<form method="POST" action="?/sendEmail" use:enhance>
				<button class="btn" disabled={!data.customerHasEmail || dirty} title={dirty ? 'Save your changes first' : data.customerHasEmail ? '' : 'Add a customer email and save first'}>✉ Send by email</button>
			</form>
			{#if dirty}<div class="dirty-note">Save your changes before sending.</div>{/if}
			<div class="send-row">
				{#if waUrl}<a class="btn ghost sm" href={waUrl} target="_blank" rel="noopener" on:click={() => fetch(`?/markSent`, { method: 'POST', body: new URLSearchParams({ channel: 'whatsapp' }) })}>WhatsApp</a>{/if}
				<button class="btn ghost sm" type="button" on:click={copyLink}>{copied ? '✓ Copied' : 'Copy link'}</button>
			</div>
			<div class="hosted"><a href={data.hostedUrl} target="_blank" rel="noopener">{data.hostedUrl}</a></div>
		</div>

		<div class="card timeline">
			<h2 class="section" style="margin:0">Timeline</h2>
			{#if data.events.length}
				<ul>
					{#each [...data.events].reverse() as e}
						<li><span class="dot"></span><b>{e.type.replace(/_/g, ' ')}</b><span class="when">{new Date(e.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></li>
					{/each}
				</ul>
			{:else}<p class="muted" style="font-size:.82rem">No activity yet.</p>{/if}
			{#if !['accepted', 'declined'].includes(src.status)}
				<form method="POST" action="?/setStatus" use:enhance class="mark">
					<button class="btn ghost sm" name="status" value="accepted">Mark accepted</button>
					<button class="btn ghost sm" name="status" value="declined">Mark declined</button>
				</form>
			{/if}
		</div>
	</div>
</div>

<style>
	.back { font-size: 0.82rem; color: var(--muted); text-decoration: none; }
	.grid { display: grid; gap: 1rem; grid-template-columns: 1fr; }
	@media (min-width: 940px) { .grid { grid-template-columns: 1fr 320px; align-items: start; } }
	.col-main { display: flex; flex-direction: column; gap: 1rem; }
	.col-side { display: flex; flex-direction: column; gap: 1rem; }
	.card { display: flex; flex-direction: column; gap: 0.7rem; }
	label { display: block; font-size: 0.82rem; color: var(--muted); }
	input, select, textarea { width: 100%; box-sizing: border-box; margin-top: 0.25rem; }
	.row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
	.ai-head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; }
	.badge { font-size: 0.72rem; font-weight: 700; padding: 0.12rem 0.5rem; border-radius: 999px; background: rgba(255, 255, 255, 0.08); color: var(--soft); }
	.badge.s-accepted, .badge.s-converted { background: rgba(22, 163, 74, 0.2); color: #6ee7a8; }
	.badge.s-viewed { background: rgba(139, 92, 246, 0.2); color: #c4b5fd; }
	.badge.s-sent { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
	.badge.s-declined { background: rgba(220, 38, 38, 0.2); color: #fca5a5; }
	.items { display: flex; flex-direction: column; gap: 0.5rem; }
	.li { display: grid; grid-template-columns: 1fr 56px 92px auto 28px; gap: 0.5rem; align-items: start; }
	.li-desc { display: flex; flex-direction: column; gap: 0.3rem; }
	.li-detail { font-size: 0.82rem; }
	.li-amt { align-self: center; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; font-size: 0.85rem; }
	.li-x { align-self: center; background: transparent; border: 0; color: var(--muted); cursor: pointer; font-size: 0.85rem; }
	.totals { border-top: 1px solid var(--line-2); margin-top: 0.5rem; padding-top: 0.6rem; }
	.tr { display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; font-size: 0.9rem; color: var(--soft); }
	.tr label { display: flex; align-items: center; gap: 0.5rem; margin: 0; }
	.tr label input { width: 120px; margin: 0; }
	.tr.grand { font-size: 1.15rem; font-weight: 800; color: var(--strong); border-top: 2px solid var(--line-2); margin-top: 0.4rem; padding-top: 0.6rem; }
	.save-bar { position: sticky; bottom: 0; padding: 0.6rem 0; display: flex; align-items: center; }
	.unsaved { margin-left: 0.8rem; font-size: 0.82rem; color: var(--gold); }
	.dirty-note { font-size: 0.76rem; color: var(--gold); margin-top: 0.3rem; }
	.ai-side textarea { min-height: 52px; }
	.sugg-h { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0.5rem 0 0.3rem; }
	.chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
	.chip { font-size: 0.78rem; padding: 0.2rem 0.55rem; border-radius: 999px; background: rgba(var(--gold-rgb), 0.14); color: var(--gold); }
	.send-row { display: flex; gap: 0.5rem; }
	.hosted { font-size: 0.72rem; word-break: break-all; margin-top: 0.4rem; }
	.hosted a { color: var(--mint); }
	.timeline ul { list-style: none; margin: 0.3rem 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }
	.timeline li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: var(--soft); text-transform: capitalize; }
	.timeline .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--mint); flex: none; }
	.timeline .when { margin-left: auto; color: var(--muted); font-size: 0.75rem; }
	.mark { display: flex; gap: 0.4rem; margin-top: 0.5rem; border-top: 1px solid var(--line-2); padding-top: 0.6rem; }
</style>
