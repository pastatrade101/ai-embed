<script>
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	export let data;
	export let form;
	$: p = data.proposal;
	$: biz = data.business;
	$: smart = data.smart || {};
	$: brand = biz.brand || '#0f6e56';
	$: ink = readableInk(brand);

	const money = (n, cur, dp = 2) => {
		try {
			return new Intl.NumberFormat('en-US', { style: 'currency', currency: (cur || 'USD').slice(0, 3).toUpperCase(), maximumFractionDigits: dp }).format(Number(n) || 0);
		} catch {
			return `${cur || 'USD'} ${(Number(n) || 0).toFixed(dp)}`;
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
		draft: { t: 'Draft', c: '#6b7c75' },
		sent: { t: 'Awaiting your review', c: '#2563eb' },
		viewed: { t: 'Awaiting your review', c: '#2563eb' },
		accepted: { t: 'Accepted', c: '#16a34a' },
		converted: { t: 'Accepted', c: '#16a34a' },
		declined: { t: 'Declined', c: '#dc2626' },
		expired: { t: 'Expired', c: '#a1723a' }
	};
	$: st = STATUS[p.status] || STATUS.sent;
	$: isOpen = ['draft', 'sent', 'viewed'].includes(p.status);
	$: accepted = p.status === 'accepted' || p.status === 'converted' || (form?.ok && form?.decision === 'accept');
	$: declined = p.status === 'declined' || (form?.ok && form?.decision === 'decline');

	$: waLink = biz.whatsapp ? `https://wa.me/${String(biz.whatsapp).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, about ${p.docLabel} ${p.number}`)}` : null;
	$: hostedUrl = `${data.origin}/p/${p.token}`;

	// "Why this proposal" reasons derived from the customer's own stated requirements.
	$: whyBullets = [
		...(smart.customerSummary || []).slice(0, 4).map((f) => `Built around your ${f.label.toLowerCase()}`),
		...(Number(p.discount) > 0 ? ['Includes a special discount'] : [])
	].slice(0, 5);

	// Customer journey — reached stages derived from status (no extra data model).
	$: journey = [
		{ k: 'Enquiry', done: !!smart.aiGenerated },
		{ k: 'Requirements', done: (smart.customerSummary || []).length > 0 },
		{ k: 'Proposal', done: true },
		{ k: 'Accepted', done: accepted },
		{ k: 'Payment', done: p.status === 'converted' },
		{ k: 'Delivery', done: false }
	];
	$: currentStage = journey.reduce((acc, s, i) => (s.done ? i : acc), 0);

	let summaryOpen = false;
	$: summaryLong = (p.summary || '').length > 260;

	// Animated total + reveal (browser-only).
	let mounted = false;
	let totalDisplay = 0;
	let submitting = false;
	let copied = false;
	onMount(() => {
		mounted = true;
		const target = Number(p.total) || 0;
		const dur = 950;
		const start = performance.now();
		const tick = (now) => {
			const t = Math.min(1, (now - start) / dur);
			totalDisplay = target * (1 - Math.pow(1 - t, 3));
			if (t < 1) requestAnimationFrame(tick);
			else totalDisplay = target;
		};
		requestAnimationFrame(tick);
	});

	async function share() {
		try {
			if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: `${p.docLabel} ${p.number}`, url: hostedUrl });
			else await copyLink();
		} catch (_) {}
	}
	async function copyLink() {
		try { await navigator.clipboard.writeText(hostedUrl); copied = true; setTimeout(() => (copied = false), 1800); } catch (_) {}
	}
	const print = () => window.print();
	const lineAmount = (li) => (li.amount != null ? Number(li.amount) : (Number(li.qty) || 0) * (Number(li.unit_price) || 0));
</script>

<svelte:head>
	<title>{p.docLabel} {p.number} — {biz.name}</title>
	<meta name="robots" content="noindex" />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

<div class="wrap" style="--brand:{brand};--ink:{ink}" class:mounted>
	<main class="doc">

		<!-- 1 · HERO -->
		<header class="hero reveal">
			<div class="hero-top">
				<div class="brand">
					{#if biz.logo}<img class="logo" src={biz.logo} alt={biz.name} />{:else}<span class="mono">{initials(biz.name)}</span>{/if}
					<span class="biz-name">{biz.name}</span>
				</div>
				<span class="status" style="--sc:{st.c}"><span class="status-dot"></span>{st.t}</span>
			</div>

			<div class="hero-kind">{p.docLabel} · {p.number}{#if smart.aiGenerated} · <span class="ai-tag">✦ AI-prepared</span>{/if}</div>
			{#if p.title}<h1 class="hero-title">{p.title}</h1>{/if}
			<div class="hero-meta">
				{#if p.customerName}<span>Prepared for <b>{p.customerName}</b></span><span class="dot-sep">·</span>{/if}
				<span>Issued {fmtDate(p.createdAt)}</span>
				{#if p.validUntil}<span class="dot-sep">·</span><span>Valid until {fmtDate(p.validUntil)}</span>{/if}
			</div>
		</header>

		<!-- 2 · CUSTOMER SUMMARY -->
		{#if (smart.customerSummary || []).length}
			<section class="card reveal">
				<div class="card-eyebrow">Prepared for you</div>
				<dl class="summary-grid">
					{#if p.customerName}<div class="sum-cell"><dt>Prepared for</dt><dd>{p.customerName}</dd></div>{/if}
					{#each smart.customerSummary as f}<div class="sum-cell"><dt>{f.label}</dt><dd>{f.value}</dd></div>{/each}
				</dl>
			</section>
		{/if}

		<!-- 3 · AI RECOMMENDATION -->
		{#if smart.matchScore != null && whyBullets.length}
			<section class="card ai-rec reveal">
				<div class="ai-rec-body">
					<span class="ai-badge">✦ Why this {p.docLabel.toLowerCase()}</span>
					<ul class="why">{#each whyBullets as w}<li><span class="tick">✓</span>{w}</li>{/each}</ul>
					{#if smart.cta}<p class="ai-cta">{smart.cta}</p>{/if}
				</div>
				<div class="match">
					<svg viewBox="0 0 80 80" class="ring" aria-hidden="true">
						<circle cx="40" cy="40" r="34" class="ring-bg" />
						<circle cx="40" cy="40" r="34" class="ring-fg" style="stroke-dashoffset:{mounted ? 213.6 - (213.6 * smart.matchScore) / 100 : 213.6}" />
					</svg>
					<div class="match-num">{smart.matchScore}<small>%</small></div>
					<div class="match-lbl">AI match</div>
				</div>
			</section>
		{/if}

		<!-- 4 · EXECUTIVE SUMMARY -->
		{#if p.intro || p.summary}
			<section class="card reveal">
				{#if p.intro}<p class="lede">{p.intro}</p>{/if}
				{#if p.summary}
					<div class="card-eyebrow" style="margin-top:{p.intro ? '1.1rem' : '0'}">Our recommendation</div>
					<p class="summary" class:clamped={summaryLong && !summaryOpen}>{p.summary}</p>
					{#if summaryLong}<button class="link-btn" on:click={() => (summaryOpen = !summaryOpen)}>{summaryOpen ? 'Show less' : 'Read more'}</button>{/if}
				{/if}
			</section>
		{/if}

		<!-- 5 · SERVICE CARDS + 6 · PRICING -->
		{#if p.lineItems.length}
			<section class="card items-card reveal">
				<div class="card-eyebrow">What's included</div>
				<div class="items">
					{#each p.lineItems as li, i}
						<div class="item">
							<div class="item-mono">{i + 1}</div>
							<div class="item-main">
								<div class="item-title">{li.description}</div>
								{#if li.detail}<div class="item-detail">{li.detail}</div>{/if}
							</div>
							<div class="item-right">
								{#if Number(li.qty) > 1}<span class="qty">× {li.qty}</span>{/if}
								<span class="item-amt">{lineAmount(li) ? money(lineAmount(li), p.currency) : '—'}</span>
							</div>
						</div>
					{/each}
				</div>

				<div class="pricing">
					<div class="pr"><span>Subtotal</span><span>{money(p.subtotal, p.currency)}</span></div>
					{#if Number(p.discount) > 0}<div class="pr disc"><span>Discount</span><span>−{money(p.discount, p.currency)}</span></div>{/if}
					{#if Number(p.tax) > 0}<div class="pr"><span>Tax</span><span>{money(p.tax, p.currency)}</span></div>{/if}
					<div class="pr-total">
						<span class="pr-total-lbl">Total</span>
						<span class="pr-total-val">{money(mounted ? totalDisplay : p.total, p.currency, 0)}</span>
					</div>
				</div>
			</section>
		{/if}

		<!-- 9 · OPTIONAL ADD-ONS -->
		{#if (smart.addOns || []).length && isOpen}
			<section class="card reveal">
				<div class="card-eyebrow">You might also like</div>
				<div class="addons">
					{#each smart.addOns as a}<div class="addon"><span class="addon-plus">+</span><span class="addon-name">{a}</span><span class="addon-hint">Ask us</span></div>{/each}
				</div>
			</section>
		{/if}

		<!-- 8 · TIMELINE -->
		<section class="card timeline reveal">
			<div class="card-eyebrow">Your journey</div>
			<div class="journey">
				{#each journey as s, i}
					<div class="jstep" class:done={s.done} class:current={i === currentStage}>
						<span class="jdot">{s.done ? '✓' : ''}</span>
						<span class="jlabel">{s.k}</span>
					</div>
					{#if i < journey.length - 1}<span class="jline" class:done={journey[i + 1].done}></span>{/if}
				{/each}
			</div>
		</section>

		<!-- 10 · TERMS -->
		{#if p.terms}
			<details class="card terms reveal">
				<summary><span class="card-eyebrow" style="margin:0">Terms &amp; conditions</span><span class="chev">⌄</span></summary>
				<p class="terms-body">{p.terms}</p>
			</details>
		{/if}

		<!-- 12 · DECISION / SUCCESS -->
		<section class="card decide reveal" id="accept">
			{#if accepted}
				<div class="celebrate">
					<div class="check-badge">✓</div>
					<h2>{p.docLabel} accepted</h2>
					<p>{smart.thankYou || `Thank you — ${biz.name} has been notified and will be in touch to arrange the next steps.`}</p>
					<div class="next-steps">
						<div class="ns"><span class="ns-k">Next step</span><span class="ns-v">{biz.name} confirms the details with you</span></div>
						<div class="ns"><span class="ns-k">Typical response</span><span class="ns-v">Within 1 business day</span></div>
					</div>
				</div>
			{:else if declined}
				<div class="decided-msg">This {p.docLabel.toLowerCase()} was declined. If that was a mistake, please contact {biz.name}.</div>
			{:else if p.status === 'expired'}
				<div class="decided-msg warn">This {p.docLabel.toLowerCase()} has expired. Please contact {biz.name} for an updated one.</div>
			{:else}
				{#if form && form.ok === false && form.error}<div class="decided-msg warn" style="margin-bottom:1rem">{form.error}</div>{/if}
				<div class="decide-head">
					<div>
						<h2 class="decide-title">Ready to proceed?</h2>
						<p class="decide-sub">Accept to confirm, and {biz.name} will take it from here.</p>
					</div>
					{#if Number(p.total) > 0}<div class="decide-total"><span>Total</span><b>{money(p.total, p.currency, 0)}</b></div>{/if}
				</div>
				<form id="acceptForm" method="POST" action="?/respond" use:enhance={() => { submitting = true; return async ({ update }) => { await update(); submitting = false; }; }} class="decide-actions">
					<button class="btn accept" name="decision" value="accept" disabled={submitting}>{submitting ? 'Submitting…' : `Accept ${p.docLabel.toLowerCase()}`}</button>
					<button class="btn decline" name="decision" value="decline" disabled={submitting}>Decline</button>
				</form>
			{/if}
		</section>

		<!-- 11 · CONTACT -->
		<section class="contact reveal">
			<div class="contact-h">Questions? Talk to {biz.name}</div>
			<div class="contact-grid">
				{#if waLink}<a class="cbtn" href={waLink} target="_blank" rel="noopener"><span class="ci">💬</span>WhatsApp</a>{/if}
				{#if biz.phone}<a class="cbtn" href={`tel:${String(biz.phone).replace(/[^0-9+]/g, '')}`}><span class="ci">📞</span>Call</a>{/if}
				{#if biz.email}<a class="cbtn" href={`mailto:${biz.email}?subject=${encodeURIComponent(`${p.docLabel} ${p.number}`)}`}><span class="ci">✉</span>Email</a>{/if}
				<button class="cbtn" type="button" on:click={print}><span class="ci">🖨</span>Save PDF</button>
				<button class="cbtn" type="button" on:click={share}><span class="ci">↗</span>{copied ? 'Copied' : 'Share'}</button>
			</div>
		</section>

		<footer class="foot">Powered by <b>Makutano&nbsp;AI</b></footer>
	</main>

	<!-- Sticky mobile action bar -->
	{#if isOpen && !accepted && !declined}
		<div class="sticky-bar">
			{#if Number(p.total) > 0}<div class="sb-total"><span>Total</span><b>{money(p.total, p.currency, 0)}</b></div>{/if}
			<button class="btn accept sb-accept" form="acceptForm" name="decision" value="accept" disabled={submitting}>{submitting ? '…' : `Accept ${p.docLabel.toLowerCase()}`}</button>
		</div>
	{/if}
</div>

<style>
	:global(body) { margin: 0; background: #f4f3f0; }
	.wrap {
		--bg: #f4f3f0; --card: #ffffff; --text: #17211d; --muted: #63706a; --faint: #6b7770;
		--line: #eae7e0; --soft: #f4f2ee; --shadow: 0 1px 2px rgba(20, 40, 33, 0.04), 0 18px 40px -28px rgba(20, 40, 33, 0.22);
		min-height: 100vh; padding: clamp(16px, 4vw, 40px) 14px calc(96px + env(safe-area-inset-bottom));
		font-family: 'Lexend Deca', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		color: var(--text); box-sizing: border-box; -webkit-font-smoothing: antialiased;
		background: radial-gradient(120% 60% at 50% -10%, color-mix(in srgb, var(--brand) 7%, transparent), transparent 60%), var(--bg);
	}
	.doc { max-width: 660px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }

	.reveal { opacity: 0; transform: translateY(10px); }
	.mounted .reveal { opacity: 1; transform: none; transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
	.mounted .reveal:nth-child(2) { transition-delay: 0.04s; }
	.mounted .reveal:nth-child(3) { transition-delay: 0.08s; }
	.mounted .reveal:nth-child(4) { transition-delay: 0.12s; }
	.mounted .reveal:nth-child(5) { transition-delay: 0.16s; }
	.mounted .reveal:nth-child(n + 6) { transition-delay: 0.2s; }
	@media (prefers-reduced-motion: reduce) { .reveal { opacity: 1 !important; transform: none !important; } }

	.card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: clamp(18px, 3.5vw, 26px); box-shadow: var(--shadow); }
	.card-eyebrow { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: var(--brand); margin-bottom: 0.8rem; }

	.hero { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: clamp(20px, 4vw, 30px); box-shadow: var(--shadow); position: relative; overflow: hidden; }
	.hero::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 4px; background: linear-gradient(90deg, var(--brand), color-mix(in srgb, var(--brand) 55%, #fff)); }
	.hero-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 1.4rem; }
	.brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
	.logo { width: 40px; height: 40px; border-radius: 10px; object-fit: contain; background: #fff; border: 1px solid var(--line); }
	.mono { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: var(--brand); color: var(--ink); font-weight: 800; font-size: 15px; }
	.biz-name { font-weight: 700; font-size: 0.98rem; letter-spacing: -0.01em; }
	.status { display: inline-flex; align-items: center; gap: 7px; font-size: 0.78rem; font-weight: 700; padding: 0.34rem 0.7rem 0.34rem 0.6rem; border-radius: 999px; color: var(--sc); background: color-mix(in srgb, var(--sc) 12%, #fff); border: 1px solid color-mix(in srgb, var(--sc) 22%, #fff); white-space: nowrap; }
	.status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--sc); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sc) 20%, transparent); }
	.hero-kind { font-size: 0.78rem; font-weight: 600; color: var(--faint); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
	.ai-tag { color: var(--brand); }
	.hero-title { margin: 0 0 0.7rem; font-size: clamp(1.5rem, 5vw, 2.15rem); line-height: 1.12; letter-spacing: -0.02em; font-weight: 800; color: var(--text); }
	.hero-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.55rem; font-size: 0.9rem; color: var(--muted); }
	.hero-meta b { color: var(--text); font-weight: 600; }
	.dot-sep { color: var(--faint); }

	.summary-grid { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); border-top: 1px solid var(--line); border-left: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
	.sum-cell { background: var(--card); padding: 0.85rem 0.95rem; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
	.sum-cell dt { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); margin-bottom: 0.28rem; }
	.sum-cell dd { margin: 0; font-size: 0.98rem; font-weight: 650; color: var(--text); line-height: 1.3; }

	.ai-rec { display: flex; align-items: center; gap: clamp(16px, 4vw, 30px); background: linear-gradient(135deg, color-mix(in srgb, var(--brand) 8%, #fff), var(--card) 65%); }
	.ai-rec-body { flex: 1; min-width: 0; }
	.ai-badge { display: inline-block; font-size: 0.75rem; font-weight: 700; color: var(--brand); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.7rem; }
	.why { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45rem; }
	.why li { display: flex; align-items: flex-start; gap: 0.55rem; font-size: 0.92rem; color: var(--text); line-height: 1.4; }
	.tick { flex: none; width: 18px; height: 18px; border-radius: 50%; background: color-mix(in srgb, var(--brand) 15%, #fff); color: var(--brand); font-size: 0.7rem; display: grid; place-items: center; margin-top: 1px; }
	.ai-cta { margin: 0.9rem 0 0; font-size: 0.9rem; color: var(--muted); font-style: italic; }
	.match { flex: none; width: 104px; text-align: center; position: relative; }
	.ring { width: 104px; height: 104px; transform: rotate(-90deg); }
	.ring-bg { fill: none; stroke: color-mix(in srgb, var(--brand) 14%, #fff); stroke-width: 7; }
	.ring-fg { fill: none; stroke: var(--brand); stroke-width: 7; stroke-linecap: round; stroke-dasharray: 213.6; transition: stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.2s; }
	.match-num { position: absolute; top: 38px; left: 0; right: 0; font-size: 1.5rem; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }
	.match-num small { font-size: 0.8rem; font-weight: 700; color: var(--muted); }
	.match-lbl { position: absolute; top: 66px; left: 0; right: 0; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--faint); }

	.lede { margin: 0; font-size: 1.06rem; line-height: 1.65; color: var(--text); font-weight: 450; }
	.summary { margin: 0.5rem 0 0; font-size: 0.98rem; line-height: 1.62; color: var(--muted); }
	.summary.clamped { display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
	.link-btn { margin-top: 0.5rem; background: none; border: 0; padding: 0; color: var(--brand); font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer; }

	.items { display: flex; flex-direction: column; }
	.item { display: flex; align-items: flex-start; gap: 0.9rem; padding: 1rem 0; border-top: 1px solid var(--line); }
	.item:first-child { border-top: 0; padding-top: 0.3rem; }
	.item-mono { flex: none; width: 26px; height: 26px; border-radius: 8px; background: var(--soft); color: var(--muted); font-size: 0.8rem; font-weight: 700; display: grid; place-items: center; margin-top: 1px; }
	.item-main { flex: 1; min-width: 0; }
	.item-title { font-weight: 650; font-size: 1rem; letter-spacing: -0.01em; }
	.item-detail { font-size: 0.86rem; color: var(--muted); margin-top: 0.25rem; line-height: 1.5; }
	.item-right { display: flex; align-items: center; gap: 0.7rem; flex: none; }
	.qty { font-size: 0.82rem; color: var(--faint); font-variant-numeric: tabular-nums; }
	.item-amt { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; font-size: 1rem; }

	.pricing { margin-top: 0.6rem; padding-top: 1rem; border-top: 2px solid var(--line); }
	.pr { display: flex; justify-content: space-between; padding: 0.32rem 0; font-size: 0.94rem; color: var(--muted); font-variant-numeric: tabular-nums; }
	.pr.disc { color: #16a34a; }
	.pr-total { display: flex; align-items: baseline; justify-content: space-between; margin-top: 0.7rem; padding-top: 0.9rem; border-top: 1px solid var(--line); }
	.pr-total-lbl { font-size: 0.95rem; font-weight: 600; color: var(--muted); }
	.pr-total-val { font-size: clamp(1.7rem, 6vw, 2.3rem); font-weight: 850; letter-spacing: -0.03em; color: var(--text); font-variant-numeric: tabular-nums; }

	.addons { display: flex; flex-wrap: wrap; gap: 0.5rem; }
	.addon { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.85rem; border: 1px solid var(--line); border-radius: 999px; background: var(--soft); transition: border-color 0.15s, transform 0.15s; }
	.addon:hover { border-color: color-mix(in srgb, var(--brand) 40%, var(--line)); transform: translateY(-1px); }
	.addon-plus { color: var(--brand); font-weight: 800; }
	.addon-name { font-size: 0.9rem; font-weight: 600; }
	.addon-hint { font-size: 0.72rem; color: var(--faint); }

	.journey { display: flex; align-items: center; gap: 0.25rem; overflow-x: auto; padding-bottom: 0.2rem; }
	.jstep { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; flex: none; }
	.jdot { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--line); background: var(--card); display: grid; place-items: center; font-size: 0.7rem; color: transparent; transition: all 0.4s ease; }
	.jstep.done .jdot { border-color: var(--brand); background: var(--brand); color: var(--ink); }
	.jstep.current .jdot { box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 18%, transparent); }
	.jlabel { font-size: 0.72rem; color: var(--faint); white-space: nowrap; font-weight: 600; }
	.jstep.done .jlabel { color: var(--text); }
	.jline { flex: 1 1 16px; min-width: 14px; height: 2px; background: var(--line); transition: background 0.5s ease; }
	.jline.done { background: var(--brand); }

	.terms { padding: 0; }
	.terms summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: clamp(18px, 3.5vw, 22px); }
	.terms summary::-webkit-details-marker { display: none; }
	.chev { color: var(--faint); font-size: 1.1rem; transition: transform 0.2s; }
	.terms[open] .chev { transform: rotate(180deg); }
	.terms-body { margin: 0; padding: 0 clamp(18px, 3.5vw, 22px) clamp(18px, 3.5vw, 22px); font-size: 0.9rem; line-height: 1.65; color: var(--muted); white-space: pre-line; }

	.decide-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.2rem; }
	.decide-title { margin: 0; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; }
	.decide-sub { margin: 0.35rem 0 0; font-size: 0.92rem; color: var(--muted); }
	.decide-total { text-align: right; flex: none; }
	.decide-total span { display: block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); }
	.decide-total b { font-size: 1.25rem; font-weight: 800; font-variant-numeric: tabular-nums; }
	.decide-actions { display: flex; gap: 0.7rem; }
	.btn { border: 0; border-radius: 13px; padding: 1rem 1.3rem; font: inherit; font-weight: 700; font-size: 1rem; cursor: pointer; transition: transform 0.12s ease, box-shadow 0.2s ease, background 0.2s; }
	.btn:active { transform: scale(0.985); }
	.btn:disabled { opacity: 0.6; cursor: default; }
	.accept { flex: 1; background: var(--brand); color: var(--ink); box-shadow: 0 8px 22px -10px color-mix(in srgb, var(--brand) 75%, transparent); }
	.accept:hover:not(:disabled) { box-shadow: 0 12px 28px -10px color-mix(in srgb, var(--brand) 80%, transparent); transform: translateY(-1px); }
	.decline { flex: 0 0 auto; background: var(--soft); color: var(--muted); }
	.decline:hover:not(:disabled) { background: var(--line); }

	.celebrate { text-align: center; padding: 0.8rem 0; }
	.check-badge { width: 60px; height: 60px; margin: 0 auto 1rem; border-radius: 50%; background: #16a34a; color: #fff; font-size: 1.7rem; display: grid; place-items: center; box-shadow: 0 0 0 8px rgba(22, 163, 74, 0.12); animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
	@keyframes pop { 0% { transform: scale(0); } 100% { transform: scale(1); } }
	.celebrate h2 { margin: 0 0 0.5rem; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; }
	.celebrate p { margin: 0 auto; max-width: 42ch; font-size: 0.96rem; line-height: 1.6; color: var(--muted); }
	.next-steps { display: grid; gap: 0.6rem; margin-top: 1.3rem; text-align: left; }
	.ns { display: flex; justify-content: space-between; gap: 1rem; padding: 0.8rem 1rem; background: var(--soft); border-radius: 12px; font-size: 0.9rem; }
	.ns-k { color: var(--muted); }
	.ns-v { font-weight: 650; text-align: right; }
	.decided-msg { padding: 1rem 1.1rem; border-radius: 12px; background: var(--soft); color: var(--muted); font-size: 0.95rem; line-height: 1.5; }
	.decided-msg.warn { background: color-mix(in srgb, #a1723a 10%, #fff); color: #8a5a2b; }

	.contact { padding: 0.5rem 0.2rem 0; }
	.contact-h { font-size: 0.9rem; font-weight: 650; color: var(--muted); margin-bottom: 0.8rem; text-align: center; }
	.contact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 0.6rem; }
	.cbtn { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 0.85rem 0.5rem; background: var(--card); border: 1px solid var(--line); border-radius: 14px; font: inherit; font-size: 0.82rem; font-weight: 600; color: var(--text); text-decoration: none; cursor: pointer; transition: transform 0.15s ease, border-color 0.15s, box-shadow 0.2s; }
	.cbtn:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--brand) 35%, var(--line)); box-shadow: var(--shadow); }
	.ci { font-size: 1.2rem; }

	.foot { text-align: center; font-size: 0.78rem; color: var(--faint); padding: 1.4rem 0 0.5rem; }
	.foot b { color: var(--muted); }

	.sticky-bar { display: none; }
	@media (max-width: 620px) {
		.sticky-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: flex; align-items: center; gap: 0.8rem; padding: 0.7rem 1rem calc(0.7rem + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--card) 92%, transparent); backdrop-filter: blur(12px); border-top: 1px solid var(--line); }
		.sb-total { display: flex; flex-direction: column; line-height: 1.15; }
		.sb-total span { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); }
		.sb-total b { font-size: 1.1rem; font-weight: 800; font-variant-numeric: tabular-nums; }
		.sb-accept { flex: 1; padding: 0.85rem; }
	}

	@media print {
		:global(body) { background: #fff; }
		.wrap { padding: 0; background: #fff; }
		.reveal { opacity: 1 !important; transform: none !important; }
		.sticky-bar, .contact, .decide-actions, .link-btn { display: none !important; }
		.card, .hero { box-shadow: none; border-color: #ddd; break-inside: avoid; }
		.terms-body { display: block !important; }
	}
</style>
