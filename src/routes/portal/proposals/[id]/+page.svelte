<script>
	import { enhance, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';
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
		items = (Array.isArray(p.line_items) ? p.line_items : []).map((li) => ({ description: li.description ?? '', detail: li.detail ?? '', qty: li.qty == null || li.qty === '' ? 1 : Number(li.qty) || 0, unit_price: Number(li.unit_price) || 0 }));
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
		if (dirty) return;
		try { await navigator.clipboard.writeText(data.hostedUrl); copied = true; setTimeout(() => (copied = false), 1800); } catch (_) {}
	}
	let generating = false, saving = false, startingWa = false;
	$: meta = src?.meta ?? {};

	// ---- Post a page action and get the decoded result (no re-seed) ----------
	async function postAction(action, body) {
		const r = await fetch(action, { method: 'POST', headers: { 'x-sveltekit-action': 'true' }, body });
		return deserialize(await r.text());
	}
	let aiError = null;

	// ---- AI Proposal Assistant — one-click per-section rewrites --------------
	const ASSIST_GROUPS = [
		{ label: 'Improve', actions: [['improve', 'Improve'], ['rewrite', 'Rewrite'], ['persuasive', 'Persuasive']] },
		{ label: 'Length', actions: [['shorten', 'Shorten'], ['expand', 'Expand'], ['simplify', 'Simplify']] },
		{ label: 'Tone', actions: [['professional', 'Professional'], ['friendly', 'Friendly'], ['luxury', 'Luxury'], ['formal', 'Formal']] }
	];
	let assisting = null;
	async function assist(field, action) {
		if (assisting || saving) return;
		assisting = field + ':' + action; aiError = null;
		try {
			const fd = new FormData(); fd.set('field', field); fd.set('action', action); fd.set('text', { intro, summary, terms }[field] || '');
			const res = await postAction('?/assist', fd);
			if (res.type === 'success' && res.data?.text) {
				if (field === 'intro') intro = res.data.text; else if (field === 'summary') summary = res.data.text; else if (field === 'terms') terms = res.data.text;
				dirty = true;
			} else aiError = res.data?.error || 'AI edit failed.';
		} catch (_) { aiError = 'AI edit failed.'; }
		assisting = null;
	}

	// ---- AI Quality Score (instant, client-side, live) ----------------------
	const REC = {
		'Strong introduction': 'Add or strengthen the introduction.',
		'Recommended solution': 'Summarise what you recommend and why.',
		'Pricing': 'Add at least one priced line item.',
		'Expiry date': 'Set a “valid until” date to create urgency.',
		'Terms': 'Add terms & conditions.',
		'Call-to-action': 'End with a clear next step (e.g. “reply to accept”).',
		'Upsell': 'Add a premium add-on — “Generate with AI” captures upsell ideas.',
		'Customer email': 'Add the customer’s email so you can send it.'
	};
	const ctaRe = /\b(book|contact|reply|accept|call|whatsapp|proceed|reserve|order|sign|get in touch|let us know|reach out)\b/i;
	$: checklist = [
		{ label: 'Strong introduction', ok: (intro || '').trim().length > 40 },
		{ label: 'Recommended solution', ok: (summary || '').trim().length > 30 },
		{ label: 'Pricing', ok: items.some((li) => li.description && (Number(li.unit_price) || 0) > 0) },
		{ label: 'Expiry date', ok: !!valid_until },
		{ label: 'Terms', ok: (terms || '').trim().length > 20 },
		{ label: 'Call-to-action', ok: !!meta.aiCta || ctaRe.test(`${summary} ${terms}`) },
		{ label: 'Upsell', ok: !!(meta.aiUpsell && meta.aiUpsell.length) },
		{ label: 'Customer email', ok: /.+@.+\..+/.test(customer_email || '') }
	];
	$: score = Math.round((checklist.filter((c) => c.ok).length / checklist.length) * 100);
	$: stars = Math.max(1, Math.round(score / 20));
	$: recs = checklist.filter((c) => !c.ok).map((c) => REC[c.label]).filter(Boolean);

	// ---- AI Sales Coach — revenue ideas -------------------------------------
	let revenue = null, loadingRevenue = false;
	async function getRevenue() {
		if (loadingRevenue) return; loadingRevenue = true; aiError = null;
		try {
			const res = await postAction('?/revenue', new FormData());
			if (res.type === 'success') revenue = res.data?.revenue || null; else aiError = res.data?.error || 'Failed.';
		} catch (_) { aiError = 'Failed.'; }
		loadingRevenue = false;
	}

	// ---- AI Follow-up message ----------------------------------------------
	let followupText = '', loadingFollowup = null, followupCopied = false;
	async function getFollowup(channel) {
		if (loadingFollowup) return; loadingFollowup = channel; aiError = null; followupText = '';
		try {
			const fd = new FormData(); fd.set('channel', channel);
			const res = await postAction('?/followup', fd);
			if (res.type === 'success') followupText = res.data?.text || ''; else aiError = res.data?.error || 'Failed.';
		} catch (_) { aiError = 'Failed.'; }
		loadingFollowup = null;
	}
	async function copyFollowup() { try { await navigator.clipboard.writeText(followupText); followupCopied = true; setTimeout(() => (followupCopied = false), 1600); } catch (_) {} }

	// ---- Sharing: QR + print + WhatsApp -------------------------------------
	let qrData = '', qrFailed = false, shareOpen = false;
	onMount(async () => { try { qrData = await QRCode.toDataURL(data.hostedUrl, { width: 220, margin: 1 }); } catch (_) { qrFailed = true; } });

	// Open the hosted page (print/PDF via the browser) — only when saved, so the
	// customer never sees a stale version behind unsaved edits.
	function openHosted(preview = false) {
		if (dirty) return;
		window.open(preview ? `${data.hostedUrl}?preview=1` : data.hostedUrl, '_blank', 'noopener');
	}
	// Open WhatsApp with the link and record the send, then refresh the timeline.
	async function shareWhatsApp() {
		if (dirty || !waUrl) return;
		window.open(waUrl, '_blank', 'noopener');
		// Clear the stale action result so `src` falls back to the freshly-loaded
		// data.proposal (else a prior Save's form.proposal shadows the new status).
		try { const fd = new FormData(); fd.set('channel', 'whatsapp'); await postAction('?/markSent', fd); form = null; await invalidateAll(); } catch (_) {}
	}

	// Collapse the QR panel the moment edits begin, so its live QR/Download can't
	// share the pre-edit (saved) version while there are unsaved changes.
	$: if (dirty) shareOpen = false;

	$: cust = data.customer;
	// Proposal AI settings — gate the explainability / recommendation UI. Fail open
	// (undefined => shown) so the editor works before the settings migration runs.
	$: pset = data.settings || {};
	const on = (v) => v !== false;
	const intentLabel = { ready_to_book: 'Ready to buy', high: 'Very high', medium: 'Medium', low: 'Low' };

	// ---- AI Sales Memory: linked conversation, requirements, live sync ------
	$: conv = data.conversation || { linked: false };
	let convOpen = false;
	let requirements = data.requirements || null, loadingReq = false;
	async function getRequirements() {
		if (loadingReq) return; loadingReq = true; aiError = null;
		try {
			const res = await postAction('?/requirements', new FormData());
			if (res.type === 'success') requirements = res.data?.requirements || null; else aiError = res.data?.error || 'Analysis failed.';
		} catch (_) { aiError = 'Analysis failed.'; }
		loadingReq = false;
	}

	let syncResult = null, loadingSync = false;
	async function checkSync() {
		if (loadingSync) return; loadingSync = true; aiError = null; syncResult = null;
		try {
			const res = await postAction('?/sync', new FormData());
			if (res.type === 'success') syncResult = res.data?.sync || null; else aiError = res.data?.error || 'Sync check failed.';
		} catch (_) { aiError = 'Sync check failed.'; }
		loadingSync = false;
	}
	function applySync() {
		const u = syncResult?.updated_fields;
		if (!u) { syncResult = null; return; }
		if (u.intro != null) intro = u.intro;
		if (u.summary != null) summary = u.summary;
		if (u.terms != null) terms = u.terms;
		dirty = true; syncResult = null;
	}
	// Accept one section's change individually (Review Before Apply).
	function applyOne(section) {
		const t = syncResult?.updated_fields?.[section];
		if (t == null) return;
		if (section === 'intro') intro = t;
		else if (section === 'summary') summary = t;
		else if (section === 'terms') terms = t;
		dirty = true;
	}

	// Explainability labels (source attribution + trust grounding).
	const srcLabel = { conversation: 'Conversation', crm: 'CRM', knowledge_base: 'Knowledge', catalogue: 'Catalogue', pricing: 'Pricing', policy: 'Policy', previous_proposal: 'Prev. proposal', inferred: 'Inferred' };
	const groundLabels = [{ k: 'conversation', t: 'Conversation' }, { k: 'crm', t: 'CRM' }, { k: 'knowledge_base', t: 'Knowledge base' }, { k: 'pricing', t: 'Pricing' }];
	const riskLabel = { very_low: 'Very low', low: 'Low', medium: 'Medium' };
	const band = (n) => (n >= 80 ? 'hi' : n >= 50 ? 'mid' : 'lo');

	// Customer journey stages (derived — no new data model).
	$: jstages = [
		{ label: 'Conversation', done: conv.linked },
		{ label: 'Requirements', done: conv.linked && (conv.hasDetails || !!requirements) },
		{ label: 'Proposal', done: true },
		{ label: 'Sent', done: src.status !== 'draft' },
		{ label: 'Viewed', done: ['viewed', 'accepted', 'converted'].includes(src.status) },
		{ label: 'Accepted', done: ['accepted', 'converted'].includes(src.status) }
	];
	const fmtWhen = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
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

<!-- AI Sales Memory: customer journey + linked conversation + live sync ------->
<div class="card memory">
	<div class="journey">
		{#each jstages as s, i}
			<div class="jstep" class:done={s.done}><span class="jdot"></span><span class="jlabel">{s.label}</span></div>
			{#if i < jstages.length - 1}<span class="jline" class:done={jstages[i + 1].done}></span>{/if}
		{/each}
	</div>
	{#if conv.linked}
		<div class="memory-head">
			<div class="muted" style="font-size:.82rem">Anchored to a conversation · started {fmtWhen(conv.startedAt)} · {conv.count} message{conv.count === 1 ? '' : 's'}{conv.hasDetails ? ' · requirements captured' : ''}</div>
			<div class="memory-actions">
				<button type="button" class="btn ghost sm" on:click={() => (convOpen = !convOpen)} aria-expanded={convOpen}>{convOpen ? 'Hide' : 'View'} conversation</button>
				<a class="btn ghost sm" href="/portal/leads" title="Open the lead in Leads">Open lead ↗</a>
				{#if on(pset.enableLiveSync)}<button type="button" class="btn gold sm" on:click={checkSync} disabled={loadingSync}>{loadingSync ? 'Checking…' : '↻ Re-check conversation'}</button>{/if}
			</div>
		</div>
		{#if convOpen}
			<div class="transcript">
				{#each conv.transcript as m}<div class="msg {m.role}"><span class="msg-who">{m.role === 'ai' ? 'AI' : 'Customer'}</span><span class="msg-text">{m.content}</span></div>{/each}
				{#if !conv.transcript.length}<div class="muted" style="font-size:.82rem">No transcript was captured for this conversation.</div>{/if}
			</div>
		{/if}
		{#if syncResult}
			<div class="sync">
				{#if syncResult.in_sync}
					<div class="sync-ok">✓ The proposal is up to date with the conversation.</div>
				{:else}
					<div class="sync-h">Review before apply · suggested updates from the conversation{#if syncResult.estimated_diff} · est. {syncResult.estimated_diff > 0 ? '+' : ''}{money(syncResult.estimated_diff)}{/if}</div>
					{#if syncResult.note}<p class="muted" style="font-size:.82rem;margin:.1rem 0 .55rem">{syncResult.note}</p>{/if}
					<ul class="sync-list">
						{#each syncResult.changes as c}
							<li>
								<div class="sync-row">
									<span class="sync-sec">{c.section}</span><b>{c.label}</b>
									{#if ['intro', 'summary', 'terms'].includes(c.section) && syncResult.updated_fields?.[c.section] != null}
										<button type="button" class="btn ghost xs" on:click={() => applyOne(c.section)}>Apply</button>
									{/if}
								</div>
								{#if (c.from || c.to) && on(pset.showChangeSummary)}<div class="sync-delta">{#if c.from}<span class="from">{c.from}</span> <span class="arr">→</span> {/if}<span class="to">{c.to}</span></div>{/if}
								{#if c.reason}<div class="muted" style="font-size:.82rem">{c.reason}</div>{/if}
							</li>
						{/each}
					</ul>
					<div class="sync-actions">
						{#if syncResult.updated_fields && (syncResult.updated_fields.intro || syncResult.updated_fields.summary || syncResult.updated_fields.terms)}
							<button type="button" class="btn sm" on:click={applySync}>Accept all text</button>
						{/if}
						<button type="button" class="btn ghost sm" on:click={() => (syncResult = null)}>Reject</button>
						<span class="muted" style="font-size:.76rem">Pricing changes are advisory — adjust line items yourself.</span>
					</div>
				{/if}
			</div>
		{/if}
	{:else}
		<div class="muted" style="font-size:.82rem">Not linked to a conversation. Create a proposal <a href="/portal/leads" style="color:var(--mint)">from a lead</a> to unlock AI Sales Memory — the AI drafts from the chat, extracts requirements, and keeps the proposal in sync.</div>
	{/if}
</div>

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

			{#if cust}
				<div class="intel">
					<div class="intel-head">
						<span class="intel-score s-{cust.cls}">{cust.score}</span>
						<div><div class="intel-tier">{cust.tier}</div><div class="muted" style="font-size:.74rem">Lead intelligence · from the conversation</div></div>
					</div>
					<div class="intel-grid">
						{#if cust.intent}<div><dt>Buying intent</dt><dd>{intentLabel[cust.intent] || cust.intent}</dd></div>{/if}
						{#if cust.budget}<div><dt>Budget</dt><dd>{cust.currency || ''} {cust.budget}</dd></div>{/if}
						{#if cust.interest}<div><dt>Interest</dt><dd>{cust.interest}</dd></div>{/if}
						{#if cust.timing}<div><dt>Timing</dt><dd>{cust.timing}</dd></div>{/if}
						{#if cust.country}<div><dt>From</dt><dd>{cust.country}</dd></div>{/if}
						<div><dt>Conversations</dt><dd>{cust.convCount}</dd></div>
						{#if cust.stage}<div><dt>Pipeline stage</dt><dd style="text-transform:capitalize">{cust.stage}</dd></div>{/if}
					</div>
				</div>
			{/if}
		</div>

		<div class="card">
			<div class="ai-head">
				<div><h2 class="section" style="margin:0">Content</h2><div class="muted" style="font-size:.82rem">Let AI draft it from the lead + your catalogue, then edit.</div></div>
				<button class="btn gold sm" form="ai-form" disabled={generating}>{generating ? 'Generating…' : '✦ Generate with AI'}</button>
			</div>
			<div><label>Title<input name="title" bind:value={title} placeholder={`${docLabel()} for …`} /></label></div>
			<div>
				<label>Introduction<textarea name="intro" bind:value={intro} rows="3" placeholder="A warm, professional opening for the customer…"></textarea></label>
				<div class="ai-tools">
					<button type="button" class="ai-chip gold" disabled={!!assisting || saving} on:click={() => assist('intro', 'improve')}>{assisting === 'intro:improve' ? '…' : '✦ Improve'}</button>
					<button type="button" class="ai-chip" disabled={!!assisting || saving} on:click={() => assist('intro', 'rewrite')}>Rewrite</button>
					<button type="button" class="ai-chip" disabled={!!assisting || saving} on:click={() => assist('intro', 'shorten')}>Shorten</button>
					<button type="button" class="ai-chip" disabled={!!assisting || saving} on:click={() => assist('intro', 'expand')}>Expand</button>
					<select class="ai-tone" disabled={!!assisting || saving} on:change={(e) => { if (e.target.value) { assist('intro', e.target.value); e.target.value = ''; } }}>
						<option value="">Tone…</option><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="luxury">Luxury</option><option value="formal">Formal</option><option value="persuasive">Persuasive</option>
					</select>
					{#if assisting?.startsWith('intro')}<span class="ai-busy">rewriting…</span>{/if}
				</div>
			</div>
			<div>
				<label>Summary / recommended solution<textarea name="summary" bind:value={summary} rows="3" placeholder="What you recommend and why it fits…"></textarea></label>
				<div class="ai-tools">
					<button type="button" class="ai-chip gold" disabled={!!assisting || saving} on:click={() => assist('summary', 'improve')}>{assisting === 'summary:improve' ? '…' : '✦ Improve'}</button>
					<button type="button" class="ai-chip" disabled={!!assisting || saving} on:click={() => assist('summary', 'persuasive')}>Persuasive</button>
					<button type="button" class="ai-chip" disabled={!!assisting || saving} on:click={() => assist('summary', 'cta')}>Add CTA</button>
					<button type="button" class="ai-chip" disabled={!!assisting || saving} on:click={() => assist('summary', 'shorten')}>Shorten</button>
					<select class="ai-tone" disabled={!!assisting || saving} on:change={(e) => { if (e.target.value) { assist('summary', e.target.value); e.target.value = ''; } }}>
						<option value="">Tone…</option><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="luxury">Luxury</option><option value="formal">Formal</option><option value="simplify">Simplify</option>
					</select>
					{#if assisting?.startsWith('summary')}<span class="ai-busy">rewriting…</span>{/if}
				</div>
			</div>
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
			<div>
				<label>Terms &amp; conditions<textarea name="terms" bind:value={terms} rows="3"></textarea></label>
				<div class="ai-tools">
					<button type="button" class="ai-chip gold" disabled={!!assisting || saving} on:click={() => assist('terms', 'improve')}>{assisting === 'terms:improve' ? '…' : '✦ Improve'}</button>
					<button type="button" class="ai-chip" disabled={!!assisting || saving} on:click={() => assist('terms', 'simplify')}>Simplify</button>
					<button type="button" class="ai-chip" disabled={!!assisting || saving} on:click={() => assist('terms', 'formal')}>Formal</button>
					<button type="button" class="ai-chip" disabled={!!assisting || saving} on:click={() => assist('terms', 'shorten')}>Shorten</button>
					{#if assisting?.startsWith('terms')}<span class="ai-busy">rewriting…</span>{/if}
				</div>
			</div>
			<div><label>Internal notes (not shown to customer)<textarea name="notes" bind:value={notes} rows="2"></textarea></label></div>
		</div>

		<div class="save-bar"><button class="btn" disabled={saving || !!assisting} title={assisting ? 'Finishing an AI edit…' : ''}>{saving ? 'Saving…' : 'Save proposal'}</button>{#if dirty}<span class="unsaved">● Unsaved changes</span>{/if}</div>
	</form>

	<!-- Side: quality, AI, revenue, share, timeline -------------------------->
	<div class="col-side">
		{#if on(pset.showQualityScore)}
		<div class="card quality">
			<div class="q-top">
				<div>
					<h2 class="section" style="margin:0">Proposal quality</h2>
					<div class="stars" aria-label={`${stars} of 5`}>{#each Array(5) as _, i}<span class:on={i < stars}>★</span>{/each}</div>
				</div>
				<div class="q-score" data-band={score >= 80 ? 'hi' : score >= 50 ? 'mid' : 'lo'}>{score}<small>/100</small></div>
			</div>
			<div class="q-bar"><span style="width:{score}%" data-band={score >= 80 ? 'hi' : score >= 50 ? 'mid' : 'lo'}></span></div>
			<ul class="q-list">
				{#each checklist as c}
					<li class:ok={c.ok}><span class="q-ic">{c.ok ? '✓' : '○'}</span>{c.label}</li>
				{/each}
			</ul>
			{#if recs.length}
				<div class="q-recs"><div class="q-recs-h">To strengthen it</div><ul>{#each recs.slice(0, 3) as r}<li>{r}</li>{/each}</ul></div>
			{/if}
		</div>
		{/if}

		<div class="card reqs">
			<div class="ai-head">
				<div><h2 class="section" style="margin:0">AI requirements</h2><div class="muted" style="font-size:.8rem">What the AI knows — and what to still ask.</div></div>
				<button class="btn ghost sm" type="button" on:click={getRequirements} disabled={loadingReq}>{loadingReq ? '…' : requirements ? 'Refresh' : '✦ Analyse'}</button>
			</div>
			{#if requirements}
				<div class="req-conf" data-band={band(requirements.confidence)}>
					<span class="req-ready">{requirements.ready ? '✓ Ready to generate' : 'Needs more info'}</span>
					<span class="req-pct">{requirements.confidence}%</span>
				</div>
				<div class="req-meta">
					{#if requirements.completeness}<span>Completeness <b>{requirements.completeness.have}/{requirements.completeness.total}</b></span>{/if}
					{#if requirements.intent && requirements.intent !== 'unknown'}<span>Intent <b class="cap">{requirements.intent}</b></span>{/if}
					{#if requirements.estimated_value}<span>Est. value <b>{money(requirements.estimated_value)}</b></span>{/if}
				</div>
				{#if requirements.grounding && on(pset.showReasoning)}
					<div class="trust">
						<div class="trust-h">Grounded in real business data{#if requirements.hallucination_risk} · <span class="risk risk-{requirements.hallucination_risk}">hallucination risk {riskLabel[requirements.hallucination_risk] || requirements.hallucination_risk}</span>{/if}</div>
						<div class="trust-chips">
							{#each groundLabels as gl}<span class="tchip" class:on={requirements.grounding[gl.k]}>{requirements.grounding[gl.k] ? '✓' : '○'} {gl.t}</span>{/each}
						</div>
					</div>
				{/if}
				{#if requirements.summary?.length}
					<dl class="req-grid">{#each requirements.summary as f}
						<div><dt>{f.label}{#if f.source && on(pset.showSources)}<span class="src">{srcLabel[f.source] || f.source}</span>{/if}</dt><dd>{f.value}{#if f.confidence != null && on(pset.showConfidence)}<span class="fconf" data-band={band(f.confidence)}>{f.confidence}%</span>{/if}</dd></div>
					{/each}</dl>
				{/if}
				{#if requirements.missing?.length}
					<div class="req-h">Missing</div>
					<ul class="req-missing">{#each requirements.missing as m}<li>{m}</li>{/each}</ul>
				{/if}
				{#if requirements.questions?.length}
					<div class="req-h">Ask the customer</div>
					<ul class="req-q">{#each requirements.questions as q}<li>{q}</li>{/each}</ul>
				{/if}
			{:else}
				<p class="muted" style="font-size:.82rem;margin:.2rem 0 0">{conv.linked ? 'Analyse the conversation to extract budget, timeline and scope — and see what’s still missing.' : 'Link this proposal to a conversation to extract requirements automatically.'}</p>
			{/if}
		</div>

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

		{#if on(pset.enableUpsell) || on(pset.enableCrossSell)}
		<div class="card coach">
			<div class="ai-head">
				<div><h2 class="section" style="margin:0">Sales coach</h2><div class="muted" style="font-size:.8rem">Grow this deal with add-ons from your catalogue.</div></div>
				<button class="btn ghost sm" type="button" on:click={getRevenue} disabled={loadingRevenue}>{loadingRevenue ? '…' : revenue ? 'Refresh' : '✦ Ideas'}</button>
			</div>
			{#if revenue}
				{#if revenue.coach}<p class="coach-tip">💡 {revenue.coach}</p>{/if}
				{#if revenue.upsells?.length}
					<div class="rev-h">Upsell</div>
					{#each revenue.upsells as u}
						<div class="rev">
							<div class="rev-main"><div class="rev-name">{u.name}</div>{#if u.reason}<div class="rev-why">{u.reason}</div>{/if}</div>
							{#if u.add_value}<div class="rev-val">+{money(u.add_value)}</div>{/if}
							<div class="rev-conf" title={`Fit ${u.confidence || 0}%`}><span style="width:{Math.max(0, Math.min(100, u.confidence || 0))}%"></span></div>
						</div>
					{/each}
				{/if}
				{#if revenue.cross_sells?.length}
					<div class="rev-h">Cross-sell</div>
					{#each revenue.cross_sells as u}
						<div class="rev">
							<div class="rev-main"><div class="rev-name">{u.name}</div>{#if u.reason}<div class="rev-why">{u.reason}</div>{/if}</div>
							{#if u.add_value}<div class="rev-val">+{money(u.add_value)}</div>{/if}
							<div class="rev-conf" title={`Fit ${u.confidence || 0}%`}><span style="width:{Math.max(0, Math.min(100, u.confidence || 0))}%"></span></div>
						</div>
					{/each}
				{/if}
				{#if !revenue.upsells?.length && !revenue.cross_sells?.length}<p class="muted" style="font-size:.82rem;margin:.4rem 0 0">No obvious add-ons for this one — it's well matched.</p>{/if}
			{:else}
				<p class="muted" style="font-size:.82rem;margin:.2rem 0 0">Get AI upsell &amp; cross-sell ideas tailored to this customer.</p>
			{/if}
		</div>
		{/if}

		<div class="card send">
			<h2 class="section" style="margin:0">Share</h2>
			<p class="muted" style="font-size:.82rem;margin:.2rem 0 .6rem">Save first, then share. The customer views a branded page and can accept.</p>
			<form method="POST" action="?/sendEmail" use:enhance>
				<button class="btn" disabled={!data.customerHasEmail || dirty} title={dirty ? 'Save your changes first' : data.customerHasEmail ? '' : 'Add a customer email and save first'}>✉ Send by email</button>
			</form>
			{#if customer_phone}
				<form method="POST" action="?/startWhatsApp" use:enhance={() => { startingWa = true; return async ({ update }) => { await update({ reset: false }); startingWa = false; }; }}>
					<button class="btn ghost" style="width:100%;margin-top:.5rem" disabled={dirty || startingWa} title={dirty ? 'Save your changes first' : 'Sends the opening template; the AI then handles the customer’s replies'}>{startingWa ? 'Starting…' : '🤖 Start AI WhatsApp chat'}</button>
				</form>
			{/if}
			{#if dirty}<div class="dirty-note">Save your changes before sharing.</div>{/if}
			<div class="send-row">
				{#if waUrl}<button class="btn ghost sm" type="button" on:click={shareWhatsApp} disabled={dirty} title={dirty ? 'Save your changes first' : ''}>WhatsApp</button>{/if}
				<button class="btn ghost sm" type="button" on:click={copyLink} disabled={dirty} title={dirty ? 'Save your changes first' : ''}>{copied ? '✓ Copied' : 'Copy link'}</button>
				<button class="btn ghost sm" type="button" on:click={() => openHosted(true)} disabled={dirty} title={dirty ? 'Save your changes first' : ''}>🖨 Print / PDF</button>
				<button class="btn ghost sm" type="button" on:click={() => (shareOpen = !shareOpen)} disabled={dirty} aria-expanded={shareOpen} title={dirty ? 'Save your changes first' : ''}>▦ QR</button>
			</div>
			{#if shareOpen}
				<div class="qr">
					{#if qrData}<img src={qrData} alt="QR code to the proposal" /><a class="btn ghost sm" href={qrData} download={`${src.number}-qr.png`}>Download QR</a>{:else if qrFailed}<span class="muted" style="font-size:.8rem">QR unavailable — use the link above.</span>{:else}<span class="muted" style="font-size:.8rem">Generating…</span>{/if}
				</div>
			{/if}
			<div class="hosted"><a href={data.hostedUrl} target="_blank" rel="noopener">{data.hostedUrl}</a></div>
		</div>

		{#if on(pset.enableFollowup)}
		<div class="card followup">
			<div class="ai-head">
				<div><h2 class="section" style="margin:0">AI follow-up</h2><div class="muted" style="font-size:.8rem">A ready-to-send nudge to move it forward.</div></div>
			</div>
			<div class="send-row">
				<button class="btn ghost sm" type="button" on:click={() => getFollowup('email')} disabled={!!loadingFollowup}>{loadingFollowup === 'email' ? '…' : '✉ Email'}</button>
				<button class="btn ghost sm" type="button" on:click={() => getFollowup('whatsapp')} disabled={!!loadingFollowup}>{loadingFollowup === 'whatsapp' ? '…' : 'WhatsApp'}</button>
			</div>
			{#if followupText}
				<textarea class="followup-text" rows="5" bind:value={followupText}></textarea>
				<button class="btn ghost sm" type="button" on:click={copyFollowup}>{followupCopied ? '✓ Copied' : 'Copy message'}</button>
			{/if}
		</div>
		{/if}

		{#if on(pset.enableTimeline) || !['accepted', 'declined'].includes(src.status)}
		<div class="card timeline">
			{#if on(pset.enableTimeline)}
				<h2 class="section" style="margin:0">Timeline</h2>
				{#if data.events.length}
					<ul>
						{#each [...data.events].reverse() as e}
							<li><span class="dot"></span><b>{e.type.replace(/_/g, ' ')}</b><span class="when">{new Date(e.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></li>
						{/each}
					</ul>
				{:else}<p class="muted" style="font-size:.82rem">No activity yet.</p>{/if}
			{/if}
			{#if !['accepted', 'declined'].includes(src.status)}
				<form method="POST" action="?/setStatus" use:enhance class="mark" class:solo={!on(pset.enableTimeline)}>
					<button class="btn ghost sm" name="status" value="accepted">Mark accepted</button>
					<button class="btn ghost sm" name="status" value="declined">Mark declined</button>
				</form>
			{/if}
		</div>
		{/if}
	</div>
</div>

{#if aiError}<div class="ai-toast" role="alert">{aiError}<button type="button" on:click={() => (aiError = null)} aria-label="Dismiss">✕</button></div>{/if}

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
	.unsaved { margin-left: 0.8rem; font-size: 0.82rem; color: var(--mint); }
	.dirty-note { font-size: 0.76rem; color: var(--mint); margin-top: 0.3rem; }
	.ai-side textarea { min-height: 52px; }
	.sugg-h { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0.5rem 0 0.3rem; }
	.chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
	.chip { font-size: 0.78rem; padding: 0.2rem 0.55rem; border-radius: 999px; background: rgba(var(--gold-rgb), 0.14); color: var(--mint); }
	.send-row { display: flex; gap: 0.5rem; }
	.hosted { font-size: 0.72rem; word-break: break-all; margin-top: 0.4rem; }
	.hosted a { color: var(--mint); }
	.timeline ul { list-style: none; margin: 0.3rem 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }
	.timeline li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: var(--soft); text-transform: capitalize; }
	.timeline .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--mint); flex: none; }
	.timeline .when { margin-left: auto; color: var(--muted); font-size: 0.75rem; }
	.mark { display: flex; gap: 0.4rem; margin-top: 0.5rem; border-top: 1px solid var(--line-2); padding-top: 0.6rem; }
	.mark.solo { margin-top: 0; border-top: 0; padding-top: 0; }

	/* Customer intelligence panel */
	.intel { border-top: 1px solid var(--line-2); padding-top: 0.8rem; margin-top: 0.1rem; }
	.intel-head { display: flex; align-items: center; gap: 0.6rem; }
	.intel-score { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; font-weight: 800; font-size: 1.05rem; flex: none; background: rgba(var(--gold-rgb), 0.14); color: var(--mint); font-variant-numeric: tabular-nums; }
	.intel-score.s-hot { background: rgba(22, 163, 74, 0.18); color: #6ee7a8; }
	.intel-score.s-warm { background: rgba(245, 158, 11, 0.18); color: #fcd34d; }
	.intel-score.s-cool { background: rgba(59, 130, 246, 0.18); color: #93c5fd; }
	.intel-score.s-cold { background: rgba(255, 255, 255, 0.08); color: var(--soft); }
	.intel-tier { font-weight: 700; color: var(--strong); font-size: 0.92rem; }
	.intel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem 0.9rem; margin-top: 0.8rem; }
	.intel-grid dt { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
	.intel-grid dd { margin: 0.1rem 0 0; font-size: 0.85rem; color: var(--soft); font-weight: 600; }

	/* Per-section AI toolbars */
	.ai-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; margin-top: 0.45rem; }
	.ai-chip { font: inherit; font-size: 0.76rem; padding: 0.22rem 0.6rem; border-radius: 999px; border: 1px solid var(--line-2); background: rgba(255, 255, 255, 0.04); color: var(--soft); cursor: pointer; transition: border-color 0.15s, color 0.15s; }
	.ai-chip:hover:not(:disabled) { border-color: rgba(var(--gold-rgb), 0.5); color: var(--strong); }
	.ai-chip:disabled { opacity: 0.5; cursor: default; }
	.ai-chip.gold { border-color: rgba(var(--gold-rgb), 0.45); color: var(--mint); }
	.ai-tone { width: auto; margin: 0; font-size: 0.76rem; padding: 0.22rem 0.4rem; border-radius: 8px; border: 1px solid var(--line-2); background: rgba(255, 255, 255, 0.04); color: var(--soft); cursor: pointer; }
	.ai-busy { font-size: 0.74rem; color: var(--mint); }

	/* Quality score */
	.quality .q-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.6rem; }
	.stars { font-size: 0.92rem; letter-spacing: 0.06em; color: var(--line-2); margin-top: 0.3rem; }
	.stars .on { color: var(--mint); }
	.q-score { font-size: 1.7rem; font-weight: 800; line-height: 1; color: var(--strong); font-variant-numeric: tabular-nums; }
	.q-score small { font-size: 0.8rem; font-weight: 600; color: var(--muted); }
	.q-score[data-band='hi'] { color: #6ee7a8; }
	.q-score[data-band='mid'] { color: #fcd34d; }
	.q-score[data-band='lo'] { color: #fca5a5; }
	.q-bar { height: 6px; border-radius: 999px; background: var(--line-2); overflow: hidden; }
	.q-bar span { display: block; height: 100%; border-radius: 999px; transition: width 0.35s ease; background: var(--mint); }
	.q-bar span[data-band='hi'] { background: #6ee7a8; }
	.q-bar span[data-band='mid'] { background: #fcd34d; }
	.q-bar span[data-band='lo'] { background: #fca5a5; }
	.q-list { list-style: none; margin: 0.3rem 0 0; padding: 0; display: grid; gap: 0.32rem; }
	.q-list li { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--muted); }
	.q-list li.ok { color: var(--soft); }
	.q-ic { width: 1rem; text-align: center; color: var(--muted); }
	.q-list li.ok .q-ic { color: #6ee7a8; }
	.q-recs { border-top: 1px solid var(--line-2); margin-top: 0.6rem; padding-top: 0.55rem; }
	.q-recs-h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 0.3rem; }
	.q-recs ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem; }
	.q-recs li { font-size: 0.8rem; color: var(--soft); padding-left: 0.8rem; position: relative; }
	.q-recs li::before { content: '→'; position: absolute; left: 0; color: var(--mint); }

	/* Sales coach / revenue */
	.coach-tip { font-size: 0.84rem; color: var(--soft); background: rgba(var(--gold-rgb), 0.1); border-radius: 10px; padding: 0.55rem 0.65rem; margin: 0.2rem 0 0.5rem; }
	.rev-h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0.5rem 0 0.3rem; }
	.rev { display: grid; grid-template-columns: 1fr auto 46px; align-items: center; gap: 0.5rem; padding: 0.35rem 0; border-top: 1px solid var(--line-2); }
	.rev:first-of-type { border-top: 0; }
	.rev-name { font-size: 0.85rem; color: var(--strong); font-weight: 600; }
	.rev-val { font-size: 0.82rem; font-weight: 700; color: #6ee7a8; font-variant-numeric: tabular-nums; }
	.rev-conf { height: 5px; border-radius: 999px; background: var(--line-2); overflow: hidden; }
	.rev-conf span { display: block; height: 100%; background: var(--mint); border-radius: 999px; }

	/* Share: QR + follow-up */
	.send-row { flex-wrap: wrap; }
	.qr { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin-top: 0.6rem; padding: 0.7rem; border: 1px solid var(--line-2); border-radius: 12px; background: rgba(255, 255, 255, 0.03); }
	.qr img { width: 150px; height: 150px; border-radius: 8px; background: #fff; padding: 6px; }
	.followup-text { min-height: 90px; font-size: 0.84rem; }

	/* AI error toast */
	.ai-toast { position: fixed; left: 50%; bottom: 1.2rem; transform: translateX(-50%); z-index: 50; display: flex; align-items: center; gap: 0.6rem; max-width: 90vw; background: rgba(220, 38, 38, 0.95); color: #fff; font-size: 0.85rem; padding: 0.6rem 0.9rem; border-radius: 12px; box-shadow: 0 12px 30px -12px rgba(0, 0, 0, 0.6); }
	.ai-toast button { background: transparent; border: 0; color: #fff; cursor: pointer; font-size: 0.9rem; padding: 0; }

	/* ---- AI Sales Memory ---- */
	.memory { margin-bottom: 1rem; gap: 0.9rem; }
	.journey { display: flex; align-items: center; gap: 0.3rem; overflow-x: auto; padding-bottom: 0.2rem; }
	.jstep { display: flex; align-items: center; gap: 0.4rem; flex: none; color: var(--muted); font-size: 0.78rem; white-space: nowrap; }
	.jdot { width: 11px; height: 11px; border-radius: 50%; border: 2px solid var(--line-2); background: transparent; flex: none; }
	.jstep.done { color: var(--strong); }
	.jstep.done .jdot { border-color: var(--mint); background: var(--mint); }
	.jline { flex: 1 1 18px; min-width: 12px; height: 2px; background: var(--line-2); }
	.jline.done { background: var(--mint); }
	.memory-head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; }
	.memory-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
	.transcript { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding: 0.7rem; border: 1px solid var(--line-2); border-radius: 12px; background: rgba(255, 255, 255, 0.02); }
	.msg { display: flex; flex-direction: column; gap: 0.15rem; max-width: 85%; }
	.msg.customer { align-self: flex-start; }
	.msg.ai { align-self: flex-end; text-align: right; }
	.msg-who { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
	.msg-text { font-size: 0.84rem; line-height: 1.45; color: var(--soft); background: rgba(255, 255, 255, 0.05); padding: 0.45rem 0.65rem; border-radius: 12px; }
	.msg.ai .msg-text { background: rgba(var(--gold-rgb), 0.12); color: var(--strong); }
	.sync { border: 1px solid rgba(var(--gold-rgb), 0.3); border-radius: 12px; padding: 0.75rem 0.85rem; background: rgba(var(--gold-rgb), 0.06); }
	.sync-ok { color: #6ee7a8; font-weight: 600; font-size: 0.88rem; }
	.sync-h { font-weight: 700; color: var(--strong); font-size: 0.9rem; margin-bottom: 0.2rem; }
	.sync-list { list-style: none; margin: 0.3rem 0 0.6rem; padding: 0; display: grid; gap: 0.5rem; }
	.sync-list li { font-size: 0.86rem; color: var(--strong); }
	.sync-sec { display: inline-block; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--mint); border: 1px solid rgba(var(--gold-rgb), 0.35); border-radius: 999px; padding: 0.02rem 0.4rem; margin-right: 0.4rem; vertical-align: middle; }
	.sync-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

	/* ---- AI requirements ---- */
	.req-conf { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.4rem 0.6rem; border-radius: 10px; background: rgba(255, 255, 255, 0.04); }
	.req-ready { font-size: 0.84rem; font-weight: 700; color: var(--strong); }
	.req-pct { font-size: 0.95rem; font-weight: 800; font-variant-numeric: tabular-nums; }
	.req-conf[data-band='hi'] .req-pct { color: #6ee7a8; }
	.req-conf[data-band='hi'] .req-ready { color: #6ee7a8; }
	.req-conf[data-band='mid'] .req-pct { color: #fcd34d; }
	.req-conf[data-band='lo'] .req-pct { color: #fca5a5; }
	.req-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 0.8rem; margin: 0.6rem 0 0; }
	.req-grid dt { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
	.req-grid dd { margin: 0.1rem 0 0; font-size: 0.85rem; color: var(--soft); font-weight: 600; }
	.req-h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 0.7rem 0 0.3rem; }
	.req-missing, .req-q { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.28rem; }
	.req-missing li { font-size: 0.82rem; color: var(--soft); padding-left: 0.9rem; position: relative; }
	.req-missing li::before { content: '○'; position: absolute; left: 0; color: var(--muted); }
	.req-q li { font-size: 0.82rem; color: var(--soft); padding-left: 0.9rem; position: relative; }
	.req-q li::before { content: '?'; position: absolute; left: 0; color: var(--mint); font-weight: 700; }

	/* ---- Explainable AI (Section 19) ---- */
	.req-meta { display: flex; flex-wrap: wrap; gap: 0.3rem 0.9rem; margin-top: 0.5rem; font-size: 0.78rem; color: var(--muted); }
	.req-meta b { color: var(--soft); }
	.req-meta .cap { text-transform: capitalize; }
	.trust { margin-top: 0.7rem; border-top: 1px solid var(--line-2); padding-top: 0.6rem; }
	.trust-h { font-size: 0.72rem; color: var(--muted); margin-bottom: 0.4rem; }
	.risk { color: #6ee7a8; font-weight: 600; }
	.risk-medium { color: #fcd34d; }
	.trust-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
	.tchip { font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid var(--line-2); color: var(--muted); }
	.tchip.on { border-color: rgba(22, 163, 74, 0.4); color: #6ee7a8; background: rgba(22, 163, 74, 0.08); }
	.src { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--mint); border: 1px solid rgba(var(--gold-rgb), 0.3); border-radius: 999px; padding: 0.02rem 0.35rem; margin-left: 0.4rem; vertical-align: middle; }
	.fconf { font-size: 0.68rem; font-weight: 700; margin-left: 0.4rem; font-variant-numeric: tabular-nums; }
	.fconf[data-band='hi'] { color: #6ee7a8; }
	.fconf[data-band='mid'] { color: #fcd34d; }
	.fconf[data-band='lo'] { color: #fca5a5; }
	.sync-row { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
	.sync-delta { font-size: 0.82rem; margin: 0.15rem 0; }
	.sync-delta .from { color: var(--muted); text-decoration: line-through; }
	.sync-delta .to { color: #6ee7a8; font-weight: 600; }
	.sync-delta .arr { color: var(--muted); }
	.btn.xs { padding: 0.12rem 0.5rem; font-size: 0.72rem; margin-left: auto; }
	.rev-main { display: flex; flex-direction: column; min-width: 0; }
	.rev-why { font-size: 0.74rem; color: var(--muted); line-height: 1.35; margin-top: 0.1rem; }
</style>
