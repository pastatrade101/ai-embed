<script>
	// Public Terms of Service + Fair Usage. Self-contained forest/gold/cream theme
	// (matches the marketing landing page and the privacy policy, independent of the
	// dark admin app.css). The Fair Usage section explains — in customer-friendly
	// language — that standard conversations count normally while unusually heavy AI
	// workloads can consume plan capacity faster, which protects service quality for all.
	export let data;

	const SITE = 'Makutano AI';
	const EFFECTIVE = 'July 26, 2026';
	const CONTACT_EMAIL = 'pastory@makutano.co.tz';
	const WA = '255752093014';
	const TEL = '+255 752 093 014';

	$: origin = data?.origin ?? 'https://ai.makutano.co.tz';
	$: canonical = `${origin}/terms`;

	const SEO_TITLE = `Terms of Service & Fair Usage — ${SITE}`;
	const SEO_DESC =
		'The terms that govern use of Makutano AI, including the Fair Usage policy — how conversation capacity works and what happens with unusually heavy AI workloads.';

	const toc = [
		{ id: 'agreement', n: '01', t: 'Agreement' },
		{ id: 'service', n: '02', t: 'The service' },
		{ id: 'accounts', n: '03', t: 'Accounts & eligibility' },
		{ id: 'acceptable', n: '04', t: 'Acceptable use' },
		{ id: 'fair-usage', n: '05', t: 'Fair usage' },
		{ id: 'plans', n: '06', t: 'Plans & capacity' },
		{ id: 'content', n: '07', t: 'Your content' },
		{ id: 'ai-output', n: '08', t: 'AI output' },
		{ id: 'availability', n: '09', t: 'Availability & changes' },
		{ id: 'termination', n: '10', t: 'Termination' },
		{ id: 'liability', n: '11', t: 'Disclaimers & liability' },
		{ id: 'contact', n: '12', t: 'Contact' }
	];
</script>

<svelte:head>
	<title>{SEO_TITLE}</title>
	<meta name="description" content={SEO_DESC} />
	<link rel="canonical" href={canonical} />
	<meta name="robots" content="index, follow" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={SEO_TITLE} />
	<meta property="og:description" content={SEO_DESC} />
	<meta property="og:url" content={canonical} />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<div class="legal" id="top">
	<!-- HERO -->
	<header class="hero">
		<div class="wrap">
			<a class="home" href="/">
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
				Back to {SITE}
			</a>
			<div class="eyebrow">
				<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
				Legal
			</div>
			<h1>Terms of Service &amp; Fair Usage</h1>
			<p class="lede">These terms govern your use of {SITE}. They cover how the service works, how conversation capacity is measured, and a Fair Usage policy that keeps performance fast and reliable for every organisation on the platform.</p>
			<div class="meta-row">
				<span class="pill">Last updated: {EFFECTIVE}</span>
				<span class="pill ghost">Applies to {origin.replace(/^https?:\/\//, '')}</span>
			</div>
		</div>
	</header>

	<div class="wrap body">
		<!-- TABLE OF CONTENTS -->
		<aside class="toc" aria-label="On this page">
			<div class="toc-inner">
				<div class="toc-h">On this page</div>
				<nav>
					{#each toc as s}
						<a href={`#${s.id}`}><span class="toc-n">{s.n}</span>{s.t}</a>
					{/each}
				</nav>
			</div>
		</aside>

		<!-- CONTENT -->
		<main class="content">
			<section id="agreement">
				<h2><span class="s-n">01</span> Agreement</h2>
				<p>{SITE} ("<strong>Makutano</strong>", "we", "us") provides an AI assistant that answers questions, captures leads and drafts documents for businesses and public institutions ("<strong>you</strong>", the "<strong>Operator</strong>") across a hosted page, website widget, WhatsApp and other channels.</p>
				<p>By creating an account or using the service, you agree to these terms. If you are accepting on behalf of an organisation, you confirm you are authorised to bind it.</p>
			</section>

			<section id="service">
				<h2><span class="s-n">02</span> The service</h2>
				<p>The service lets you configure an AI assistant grounded in your own verified knowledge, connect live data sources, capture and qualify leads, and generate quotations or proposals. Availability of specific features depends on your plan.</p>
				<p>We continually improve the product. Non-material changes may happen at any time; material changes are described in section 09.</p>
			</section>

			<section id="accounts">
				<h2><span class="s-n">03</span> Accounts &amp; eligibility</h2>
				<ul>
					<li>You are responsible for the accuracy of your account details and for keeping your login credentials secure.</li>
					<li>You are responsible for the activity of the operators and team members you invite.</li>
					<li>You must have the right to use any content, knowledge, website or WhatsApp number you connect to the service.</li>
				</ul>
			</section>

			<section id="acceptable">
				<h2><span class="s-n">04</span> Acceptable use</h2>
				<p>You agree not to use the service to:</p>
				<ul>
					<li>break the law, infringe others' rights, or send spam or unlawful, harmful or deceptive content;</li>
					<li>upload content you do not have the right to use, or attempt to expose another tenant's data;</li>
					<li>probe, scrape, overload, reverse-engineer or circumvent the security, rate limits or usage controls of the service;</li>
					<li>resell or provide the service to third parties except as expressly permitted.</li>
				</ul>
			</section>

			<section id="fair-usage" class="highlight">
				<h2><span class="s-n">05</span> Fair usage</h2>
				<p>Our plans are described in <strong>conversations per month</strong> because that is the simplest way to size the service for a typical organisation. Behind that friendly number, each plan includes a generous allowance of AI processing. The Fair Usage policy makes sure that allowance is shared fairly so the service stays fast and reliable for everyone.</p>
				<div class="cards">
					<div class="mini">
						<h3>Standard conversations count normally</h3>
						<p>Everyday customer and citizen conversations are counted at the ordinary rate. For the vast majority of organisations, the published conversation estimate is exactly what you get.</p>
					</div>
					<div class="mini">
						<h3>Unusually heavy usage can go faster</h3>
						<p>Very long conversations, large document and PDF processing, AI research tasks, automated knowledge synchronisation and other heavy or automated workloads use more AI processing, and so may consume your monthly capacity faster than the standard estimate.</p>
					</div>
					<div class="mini">
						<h3>This protects everyone</h3>
						<p>Fair Usage lets us keep pricing simple and predictable while protecting response quality and speed for all customers on shared infrastructure.</p>
					</div>
					<div class="mini">
						<h3>No surprises</h3>
						<p>Your conversation history always stays accessible. If you approach your monthly capacity we notify you in advance, and you can upgrade your plan or add capacity at any time.</p>
					</div>
				</div>
				<p class="fine">Conversation estimates are based on standard usage. We reserve the right to apply reasonable safeguards to protect service quality against abusive, automated or disproportionately heavy usage. We will act in good faith and give reasonable notice where practical.</p>
			</section>

			<section id="plans">
				<h2><span class="s-n">06</span> Plans, billing &amp; capacity</h2>
				<ul>
					<li>Paid plans are billed in advance for the period shown at checkout. Conversation capacity resets each billing month.</li>
					<li>When you reach your monthly capacity, new conversations may be paused until the next cycle, an upgrade, or added capacity — but your existing history and account remain accessible.</li>
					<li>Upgrades take effect immediately; the applicable capacity follows your current plan.</li>
					<li>Fees are non-refundable except where required by law.</li>
				</ul>
			</section>

			<section id="content">
				<h2><span class="s-n">07</span> Your content &amp; knowledge</h2>
				<p>The knowledge, documents, conversations and leads that flow through your workspace remain <strong>yours</strong>. You grant us the limited rights needed to host and process them to operate the service on your behalf, as described in our <a href="/privacy-policy">Privacy Policy</a>.</p>
				<p>You are responsible for the accuracy and legality of the information you provide the assistant to answer from.</p>
			</section>

			<section id="ai-output">
				<h2><span class="s-n">08</span> AI-generated output</h2>
				<p>The assistant generates answers, summaries and documents from the information you provide and the sources you connect. While it is designed to answer only from your verified knowledge, AI output can contain errors and is provided for your review.</p>
				<p>You are responsible for reviewing AI-generated quotations, proposals and answers before relying on or sending them. AI output is not legal, financial or professional advice.</p>
			</section>

			<section id="availability">
				<h2><span class="s-n">09</span> Availability &amp; changes</h2>
				<p>We aim for high availability but do not guarantee uninterrupted service; maintenance, upstream providers or events beyond our control may cause downtime.</p>
				<p>We may update these terms. If a change is material, we will post the revised terms here with a new "Last updated" date and, where appropriate, notify you. Continued use after a change means you accept it.</p>
			</section>

			<section id="termination">
				<h2><span class="s-n">10</span> Termination</h2>
				<p>You may stop using the service at any time. We may suspend or terminate access for a material breach of these terms — including abuse of the Fair Usage policy — or where required by law. On termination, you may request an export of your data as described in the Privacy Policy.</p>
			</section>

			<section id="liability">
				<h2><span class="s-n">11</span> Disclaimers &amp; liability</h2>
				<p>The service is provided "as is" to the fullest extent permitted by law. We disclaim implied warranties of merchantability, fitness for a particular purpose and non-infringement.</p>
				<p>To the extent permitted by law, our aggregate liability arising from the service is limited to the fees you paid in the three months before the event giving rise to the claim. We are not liable for indirect, incidental or consequential losses.</p>
			</section>

			<section id="contact">
				<h2><span class="s-n">12</span> Contact</h2>
				<p>Questions about these terms or Fair Usage?</p>
				<div class="contact">
					<a class="c-item" href={`mailto:${CONTACT_EMAIL}`}>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
						{CONTACT_EMAIL}
					</a>
					<a class="c-item" href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
						{TEL}
					</a>
				</div>
				<div class="foot-note">
					<span>© {new Date().getFullYear()} {SITE}. All rights reserved.</span>
					<a href="/privacy-policy">Privacy Policy →</a>
				</div>
			</section>
		</main>
	</div>
</div>

<style>
	.legal {
		--forest: #10362a;
		--forest-2: #0c2c22;
		--forest-mid: #2c6b52;
		--gold: #e0b24c;
		--gold-soft: #ecca7d;
		--gold-ink: #23180a;
		--cream: #f7f2e8;
		--ink: #16261f;
		--muted: #5c6f66;
		--line: #e4ddce;
		--bg: #faf7ef;
		--card: #ffffff;
		background: var(--bg);
		color: var(--ink);
		font-family: 'Lexend Deca', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		min-height: 100vh;
		-webkit-font-smoothing: antialiased;
	}
	.wrap { width: min(1080px, 92vw); margin: 0 auto; }

	/* Hero */
	.hero {
		background:
			radial-gradient(90% 120% at 80% -10%, rgba(224, 178, 76, 0.22), transparent 60%),
			linear-gradient(160deg, var(--forest) 0%, var(--forest-2) 70%, #0a231b 100%);
		color: var(--cream);
		padding: 1.6rem 0 3.4rem;
	}
	.home {
		display: inline-flex; align-items: center; gap: 0.45rem;
		color: rgba(247, 242, 232, 0.82); text-decoration: none;
		font-size: 0.9rem; font-weight: 600; padding: 0.5rem 0;
		transition: color 0.15s ease;
	}
	.home:hover { color: var(--gold-soft); }
	.eyebrow {
		display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 1.6rem;
		color: var(--gold); font-weight: 700; font-size: 0.78rem;
		text-transform: uppercase; letter-spacing: 0.14em;
	}
	.hero h1 {
		font-size: clamp(2.1rem, 5vw, 3.2rem); line-height: 1.05; margin: 0.7rem 0 0;
		letter-spacing: -0.02em; font-weight: 800;
	}
	.lede {
		max-width: 60ch; margin: 1rem 0 0; font-size: 1.06rem; line-height: 1.6;
		color: rgba(247, 242, 232, 0.86);
	}
	.meta-row { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1.5rem; }
	.pill {
		font-size: 0.82rem; font-weight: 600; padding: 0.4rem 0.85rem; border-radius: 999px;
		background: var(--gold); color: var(--gold-ink);
	}
	.pill.ghost { background: rgba(247, 242, 232, 0.12); color: var(--cream); }

	/* Body layout */
	.body {
		display: grid; grid-template-columns: 232px 1fr; gap: 2.6rem;
		align-items: start; padding: 2.6rem 0 4rem; margin-top: -2rem;
	}
	.toc { position: sticky; top: 1.4rem; }
	.toc-inner {
		background: var(--card); border: 1px solid var(--line); border-radius: 16px;
		padding: 1.1rem 0.8rem; box-shadow: 0 18px 40px -28px rgba(16, 54, 42, 0.4);
	}
	.toc-h {
		font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em;
		color: var(--muted); font-weight: 700; padding: 0 0.6rem 0.5rem;
	}
	.toc nav { display: flex; flex-direction: column; }
	.toc nav a {
		display: flex; align-items: center; gap: 0.55rem; padding: 0.4rem 0.6rem;
		border-radius: 9px; color: var(--ink); text-decoration: none;
		font-size: 0.88rem; font-weight: 500; transition: background 0.14s ease, color 0.14s ease;
	}
	.toc nav a:hover { background: rgba(44, 107, 82, 0.09); color: var(--forest); }
	.toc-n { color: var(--gold); font-weight: 700; font-size: 0.74rem; font-variant-numeric: tabular-nums; }

	/* Content */
	.content { min-width: 0; }
	section {
		background: var(--card); border: 1px solid var(--line); border-radius: 18px;
		padding: 1.7rem 1.8rem; margin-bottom: 1.1rem;
		box-shadow: 0 22px 50px -40px rgba(16, 54, 42, 0.5);
		scroll-margin-top: 1.2rem;
	}
	section.highlight { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold), 0 22px 50px -40px rgba(224, 178, 76, 0.5); }
	h2 {
		display: flex; align-items: baseline; gap: 0.6rem;
		font-size: 1.32rem; letter-spacing: -0.01em; margin: 0 0 0.8rem; font-weight: 750;
		color: var(--forest);
	}
	.s-n { color: var(--gold); font-size: 0.9rem; font-weight: 800; font-variant-numeric: tabular-nums; }
	h3 { font-size: 0.98rem; margin: 0 0 0.35rem; color: var(--forest); font-weight: 700; }
	p { margin: 0 0 0.85rem; line-height: 1.68; color: #33443c; font-size: 0.99rem; }
	p:last-child { margin-bottom: 0; }
	.fine { font-size: 0.86rem; color: var(--muted); }
	strong { color: var(--ink); font-weight: 700; }
	a { color: var(--forest-mid); text-decoration: underline; text-underline-offset: 2px; }
	a:hover { color: var(--gold-ink); }
	ul { margin: 0 0 0.85rem; padding-left: 1.15rem; }
	li { line-height: 1.62; color: #33443c; margin-bottom: 0.42rem; font-size: 0.99rem; }
	li:last-child { margin-bottom: 0; }

	/* Fair-usage cards */
	.cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; margin: 0.4rem 0 0.9rem; }
	.mini { background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 0.95rem 1rem; }
	.mini p { font-size: 0.9rem; margin: 0; color: #3c4d45; }

	/* Contact */
	.contact { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.3rem 0 0.4rem; }
	.c-item {
		display: inline-flex; align-items: center; gap: 0.5rem;
		background: var(--bg); border: 1px solid var(--line); border-radius: 999px;
		padding: 0.55rem 1rem; font-size: 0.92rem; font-weight: 600; text-decoration: none;
		color: var(--forest);
	}
	.c-item:hover { border-color: var(--gold); color: var(--gold-ink); }
	.c-item svg { color: var(--gold); flex: none; }

	.foot-note {
		display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem;
		padding: 1.2rem 0.3rem 0; color: var(--muted); font-size: 0.86rem;
	}
	.foot-note a { color: var(--forest-mid); font-weight: 600; text-decoration: none; }

	@media (max-width: 860px) {
		.body { grid-template-columns: 1fr; gap: 1.2rem; }
		.toc { position: static; }
		.toc nav { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.1rem; }
		.cards { grid-template-columns: 1fr; }
		section { padding: 1.4rem 1.25rem; }
	}
</style>
