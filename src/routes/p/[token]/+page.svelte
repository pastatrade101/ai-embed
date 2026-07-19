<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: p = data.proposal;
	$: biz = data.business;
	$: brand = biz.brand || '#0f6e56';
	$: ink = readableInk(brand);

	const money = (n, cur) => {
		try {
			return new Intl.NumberFormat('en-US', { style: 'currency', currency: (cur || 'USD').slice(0, 3).toUpperCase(), maximumFractionDigits: 2 }).format(Number(n) || 0);
		} catch {
			return `${cur || 'USD'} ${(Number(n) || 0).toFixed(2)}`;
		}
	};
	const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
	const initials = (s) => (s || 'B').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

	function readableInk(hex) {
		const c = String(hex || '').replace('#', '');
		if (c.length < 6) return '#ffffff';
		const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
		return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#12332a' : '#ffffff';
	}

	const STATUS = {
		draft: { t: 'Draft', c: '#6b7c75' }, sent: { t: 'Sent', c: '#3b82f6' }, viewed: { t: 'Viewed', c: '#8b5cf6' },
		accepted: { t: 'Accepted', c: '#16a34a' }, declined: { t: 'Declined', c: '#dc2626' }, expired: { t: 'Expired', c: '#a1a1aa' }, converted: { t: 'Won', c: '#16a34a' }
	};
	$: st = STATUS[p.status] || STATUS.sent;
	$: waLink = biz.whatsapp ? `https://wa.me/${String(biz.whatsapp).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, about ${p.docLabel} ${p.number}`)}` : null;
</script>

<svelte:head>
	<title>{p.docLabel} {p.number} — {biz.name}</title>
	<meta name="robots" content="noindex" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="wrap" style="--brand:{brand};--ink:{ink}">
	<div class="doc">
		<header class="top">
			<div class="biz">
				{#if biz.logo}<img class="logo" src={biz.logo} alt={biz.name} />{:else}<span class="mono">{initials(biz.name)}</span>{/if}
				<div><div class="biz-name">{biz.name}</div><div class="doc-kind">{p.docLabel}</div></div>
			</div>
			<div class="meta">
				<span class="badge" style="--bc:{st.c}">{st.t}</span>
				<div class="num">{p.number}</div>
			</div>
		</header>

		<div class="body">
			{#if p.title}<h1 class="title">{p.title}</h1>{/if}
			<div class="prepared">
				{#if p.customerName}<span>Prepared for <b>{p.customerName}</b></span>{/if}
				<span class="dates">Issued {fmtDate(p.createdAt)}{#if p.validUntil} · Valid until {fmtDate(p.validUntil)}{/if}</span>
			</div>

			{#if p.intro}<p class="intro">{p.intro}</p>{/if}
			{#if p.summary}<div class="block"><div class="block-h">Recommended</div><p>{p.summary}</p></div>{/if}

			{#if p.lineItems.length}
				<div class="items">
					{#each p.lineItems as li}
						<div class="item">
							<div class="item-main">
								<div class="item-desc">{li.description}</div>
								{#if li.detail}<div class="item-detail">{li.detail}</div>{/if}
							</div>
							<div class="item-qty">{li.qty > 1 ? `${li.qty} ×` : ''}</div>
							<div class="item-amt">{li.amount ? money(li.amount, p.currency) : '—'}</div>
						</div>
					{/each}
				</div>

				<div class="totals">
					<div class="tr"><span>Subtotal</span><span>{money(p.subtotal, p.currency)}</span></div>
					{#if p.discount}<div class="tr"><span>Discount</span><span>−{money(p.discount, p.currency)}</span></div>{/if}
					{#if p.tax}<div class="tr"><span>Tax</span><span>{money(p.tax, p.currency)}</span></div>{/if}
					<div class="tr grand"><span>Total</span><span>{money(p.total, p.currency)}</span></div>
				</div>
			{/if}

			{#if p.terms}<div class="block terms"><div class="block-h">Terms</div><p>{p.terms}</p></div>{/if}

			<!-- Accept / Decline ------------------------------------------------->
			{#if form && form.ok === false && form.error}<div class="decided expired">{form.error}</div>{/if}
			{#if form?.ok && ['accept', 'decline'].includes(form?.decision)}
				<div class="decided {form.decision === 'accept' ? 'accepted' : 'declined'}">
					{#if form.decision === 'accept'}✓ You accepted this {p.docLabel.toLowerCase()}. {biz.name} will be in touch.{:else}This {p.docLabel.toLowerCase()} was declined.{/if}
				</div>
			{:else if p.status === 'accepted' || p.status === 'converted'}
				<div class="decided accepted">✓ This {p.docLabel.toLowerCase()} has been accepted. {biz.name} will be in touch.</div>
			{:else if p.status === 'declined'}
				<div class="decided declined">This {p.docLabel.toLowerCase()} was declined.</div>
			{:else if p.status === 'expired'}
				<div class="decided expired">This {p.docLabel.toLowerCase()} has expired. Please contact {biz.name} for an updated one.</div>
			{:else}
				<form method="POST" action="?/respond" use:enhance class="actions">
					<button class="btn accept" name="decision" value="accept" type="submit">Accept {p.docLabel.toLowerCase()}</button>
					<button class="btn decline" name="decision" value="decline" type="submit">Decline</button>
				</form>
			{/if}

			<div class="contact">
				<span>Questions?</span>
				{#if waLink}<a href={waLink} target="_blank" rel="noopener">WhatsApp</a>{/if}
				{#if biz.email}<a href={`mailto:${biz.email}?subject=${encodeURIComponent(`${p.docLabel} ${p.number}`)}`}>Email</a>{/if}
				{#if biz.phone}<a href={`tel:${String(biz.phone).replace(/[^0-9+]/g, '')}`}>Call</a>{/if}
			</div>
		</div>

		<footer class="foot">Powered by <b>Makutano&nbsp;AI</b></footer>
	</div>
</div>

<style>
	:global(body) { margin: 0; background: #f4f2ee; }
	.wrap { min-height: 100vh; padding: 28px 14px 48px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1c2b26; box-sizing: border-box; }
	.doc { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e7e3db; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 50px -30px rgba(18, 51, 42, 0.4); }
	.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 24px; background: var(--brand); color: var(--ink); }
	.biz { display: flex; align-items: center; gap: 12px; min-width: 0; }
	.logo { width: 44px; height: 44px; border-radius: 10px; object-fit: contain; background: #fff; padding: 3px; }
	.mono { width: 44px; height: 44px; border-radius: 10px; display: grid; place-items: center; background: rgba(255, 255, 255, 0.2); font-weight: 800; font-size: 16px; }
	.biz-name { font-weight: 800; font-size: 16px; line-height: 1.2; }
	.doc-kind { font-size: 12px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.06em; }
	.meta { text-align: right; flex-shrink: 0; }
	.num { font-size: 12px; opacity: 0.85; margin-top: 6px; font-variant-numeric: tabular-nums; }
	.badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: #fff; color: var(--bc); text-transform: uppercase; letter-spacing: 0.04em; }
	.body { padding: 26px 24px 8px; }
	.title { margin: 0 0 6px; font-size: clamp(20px, 4vw, 26px); line-height: 1.25; color: #12332a; }
	.prepared { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13.5px; color: #5c6b64; margin-bottom: 18px; }
	.intro { font-size: 15px; line-height: 1.6; color: #33433d; margin: 0 0 18px; }
	.block { margin: 0 0 18px; }
	.block-h { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--brand); margin-bottom: 6px; }
	.block p { margin: 0; font-size: 14.5px; line-height: 1.6; color: #33433d; }
	.terms p { font-size: 13px; color: #6b7c75; }
	.items { border: 1px solid #edeae3; border-radius: 12px; overflow: hidden; margin: 6px 0 14px; }
	.item { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 12px; padding: 13px 15px; border-top: 1px solid #f0ede6; }
	.item:first-child { border-top: 0; }
	.item-desc { font-weight: 600; font-size: 14.5px; }
	.item-detail { font-size: 12.5px; color: #7c8a83; margin-top: 2px; }
	.item-qty { font-size: 13px; color: #7c8a83; font-variant-numeric: tabular-nums; }
	.item-amt { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
	.totals { margin: 4px 0 20px; }
	.tr { display: flex; justify-content: space-between; padding: 5px 2px; font-size: 14px; color: #5c6b64; font-variant-numeric: tabular-nums; }
	.tr.grand { border-top: 2px solid #edeae3; margin-top: 6px; padding-top: 12px; font-size: 19px; font-weight: 800; color: #12332a; }
	.actions { display: flex; gap: 10px; margin: 6px 0 16px; }
	.btn { flex: 1; border: 0; border-radius: 12px; padding: 14px; font: inherit; font-weight: 700; font-size: 15px; cursor: pointer; }
	.accept { background: var(--brand); color: var(--ink); }
	.decline { flex: 0 0 auto; padding: 14px 20px; background: #f2f0ea; color: #6b7c75; }
	.decided { padding: 15px 16px; border-radius: 12px; font-weight: 600; font-size: 14.5px; margin: 6px 0 16px; }
	.decided.accepted { background: #e8f6ee; color: #157347; }
	.decided.declined, .decided.expired { background: #f6efe8; color: #8a5a2b; }
	.contact { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; font-size: 13.5px; color: #7c8a83; padding: 8px 0 6px; }
	.contact a { color: var(--brand); font-weight: 600; text-decoration: none; }
	.foot { text-align: center; font-size: 11.5px; color: #9aa79f; padding: 14px; border-top: 1px solid #f0ede6; background: #fbfaf7; }
	.foot b { color: #6b7c75; }
</style>
