<script>
	// Public privacy policy. Self-contained forest/gold/cream theme (matches the
	// marketing landing page, independent of the dark admin app.css). Written to
	// satisfy Meta WhatsApp Business Platform App Review: publicly reachable, and it
	// discloses what Meta/WhatsApp data we access, why, who processes it, how it's
	// secured, how long it's kept, and how to request deletion.
	export let data;

	const SITE = 'Makutano AI';
	const EFFECTIVE = 'July 20, 2026';
	const CONTACT_EMAIL = 'privacy@makutano.co.tz';
	const WA = '255752093014';
	const TEL = '+255 752 093 014';

	$: origin = data?.origin ?? 'https://ai.makutano.co.tz';
	$: canonical = `${origin}/privacy-policy`;

	const SEO_TITLE = `Privacy Policy — ${SITE}`;
	const SEO_DESC =
		'How Makutano AI collects, uses, secures and shares information — including data from the WhatsApp Business Platform — and how to exercise your privacy rights or request deletion.';

	// Table of contents — anchors mirror each <section id>.
	const toc = [
		{ id: 'overview', n: '01', t: 'Overview' },
		{ id: 'roles', n: '02', t: 'Our role & scope' },
		{ id: 'collect', n: '03', t: 'Information we collect' },
		{ id: 'whatsapp', n: '04', t: 'WhatsApp & Meta data' },
		{ id: 'use', n: '05', t: 'How we use information' },
		{ id: 'ai', n: '06', t: 'AI processing & providers' },
		{ id: 'sharing', n: '07', t: 'Sharing & disclosure' },
		{ id: 'security', n: '08', t: 'How we protect data' },
		{ id: 'retention', n: '09', t: 'Data retention' },
		{ id: 'rights', n: '10', t: 'Your rights & choices' },
		{ id: 'deletion', n: '11', t: 'Deleting your data' },
		{ id: 'transfers', n: '12', t: 'International transfers' },
		{ id: 'cookies', n: '13', t: 'Cookies' },
		{ id: 'children', n: '14', t: 'Children' },
		{ id: 'changes', n: '15', t: 'Changes' },
		{ id: 'contact', n: '16', t: 'Contact us' }
	];

	// Subprocessors — the third parties that process data to run the service.
	const processors = [
		{ name: 'Anthropic (Claude)', use: 'Powers the AI assistant — generates replies, drafts quotations and summaries from the message and knowledge you provide.', region: 'United States' },
		{ name: 'Voyage AI', use: 'Turns your knowledge base into searchable embeddings so the assistant can find the right answer.', region: 'United States' },
		{ name: 'Supabase (PostgreSQL)', use: 'Primary database and storage — hosts your account, knowledge, leads, conversations and proposals.', region: 'Managed cloud' },
		{ name: 'Meta Platforms (WhatsApp Business Platform)', use: 'Sends and receives WhatsApp messages between a business and its customers.', region: 'United States / global' },
		{ name: 'Resend', use: 'Delivers transactional and notification emails.', region: 'United States' },
		{ name: 'Snippe', use: 'Processes subscription and top-up payments. We never store full card details.', region: 'Global' }
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
				<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
				Legal
			</div>
			<h1>Privacy Policy</h1>
			<p class="lede">This policy explains what {SITE} collects, how we use and protect it, who we share it with, and the choices and rights you have — including data handled through the WhatsApp Business Platform.</p>
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
			<section id="overview">
				<h2><span class="s-n">01</span> Overview</h2>
				<p>{SITE} ("<strong>Makutano</strong>", "we", "us") provides an AI sales assistant that answers customer questions, captures leads and drafts quotations for businesses ("<strong>Operators</strong>") across websites, WhatsApp and other channels. We take privacy seriously and only collect what we need to run the service reliably and securely.</p>
				<p>By creating an account, connecting a WhatsApp number, or interacting with an assistant powered by Makutano, you acknowledge the practices described here.</p>
			</section>

			<section id="roles">
				<h2><span class="s-n">02</span> Our role &amp; scope</h2>
				<p>Makutano plays two distinct roles depending on the data:</p>
				<ul>
					<li><strong>Controller</strong> — for Operator account data (your name, email, business details, billing and how you use the product). We decide how this data is handled.</li>
					<li><strong>Processor</strong> — for the customer conversations, leads and messages that flow through an Operator's assistant. That content belongs to the Operator; we process it <em>on their behalf</em> to deliver the service, under their instructions.</li>
				</ul>
				<p>If you are a customer chatting with a business that uses Makutano, that business is the controller of your conversation. Please also review their own privacy notice.</p>
			</section>

			<section id="collect">
				<h2><span class="s-n">03</span> Information we collect</h2>
				<div class="cards">
					<div class="mini">
						<h3>Account &amp; business</h3>
						<p>Name, email, phone, business name, industry, logo, opening hours and preferences you enter when you sign up or configure your workspace.</p>
					</div>
					<div class="mini">
						<h3>Knowledge you provide</h3>
						<p>Products, services, pricing, FAQs and documents you import (CSV, JSON, PDF or pasted text), plus website content you ask us to sync.</p>
					</div>
					<div class="mini">
						<h3>Conversations &amp; leads</h3>
						<p>Messages exchanged with an assistant, contact details customers share, and lead/pipeline records generated from those chats.</p>
					</div>
					<div class="mini">
						<h3>WhatsApp connection</h3>
						<p>When you connect your number, the WhatsApp Business Account ID, phone number ID, display number and an access token (stored encrypted).</p>
					</div>
					<div class="mini">
						<h3>Payments</h3>
						<p>Plan, billing status and payment events from our payment provider. We do <strong>not</strong> receive or store full card numbers.</p>
					</div>
					<div class="mini">
						<h3>Technical &amp; usage</h3>
						<p>Log data such as IP address, device/browser type, timestamps and feature usage, used to keep the service secure and working.</p>
					</div>
				</div>
			</section>

			<section id="whatsapp">
				<h2><span class="s-n">04</span> WhatsApp &amp; Meta Platform data</h2>
				<p>Makutano integrates with the <strong>WhatsApp Business Platform</strong> (operated by Meta) so an Operator's AI assistant can reply to customers from the Operator's own WhatsApp number.</p>
				<p><strong>What we access from Meta</strong>, only after you explicitly connect your account through Meta's official Embedded Signup flow:</p>
				<ul>
					<li>Your WhatsApp Business Account and phone number identifiers, display phone number and verified business name.</li>
					<li>A business access token that authorises sending and receiving messages. This token is <strong>encrypted at rest</strong> and is never exposed to any browser or third party.</li>
					<li>Inbound and outbound message content and delivery/read status, so the assistant can respond and keep an accurate history.</li>
				</ul>
				<p><strong>How we use it:</strong> solely to operate the messaging features you enabled — routing each message to the correct business, generating grounded replies, updating proposals and notifying the Operator. We do <strong>not</strong> sell WhatsApp or Meta data, use it for advertising, or share it with unrelated parties.</p>
				<p>Our use of information received from Meta APIs follows Meta's Platform Terms and Developer Policies. You can disconnect your number at any time from <em>Portal → WhatsApp</em>, which stops all further access.</p>
			</section>

			<section id="use">
				<h2><span class="s-n">05</span> How we use information</h2>
				<ul>
					<li>Provide, operate and secure the assistant, proposals, leads and analytics.</li>
					<li>Generate AI answers, quotations and summaries grounded in the knowledge you provide.</li>
					<li>Route and deliver messages on the correct channel and number.</li>
					<li>Send service, billing and notification messages.</li>
					<li>Measure usage, prevent abuse, debug issues and improve the product.</li>
					<li>Comply with legal obligations and enforce our terms.</li>
				</ul>
				<p>We do <strong>not</strong> sell your personal information, and we do not use the private content of Operator conversations to train third-party foundation models.</p>
			</section>

			<section id="ai">
				<h2><span class="s-n">06</span> AI processing &amp; service providers</h2>
				<p>To deliver the service we share the minimum necessary data with vetted providers ("subprocessors") who process it on our instructions:</p>
				<div class="proc">
					{#each processors as p}
						<div class="proc-row">
							<div class="proc-name">{p.name}<span class="proc-region">{p.region}</span></div>
							<div class="proc-use">{p.use}</div>
						</div>
					{/each}
				</div>
				<p class="fine">Providers may change as the service evolves; we keep this list current and require each to protect data under contract.</p>
			</section>

			<section id="sharing">
				<h2><span class="s-n">07</span> Sharing &amp; disclosure</h2>
				<p>We share information only:</p>
				<ul>
					<li>with the subprocessors above, to run the service;</li>
					<li>with the Operator whose assistant a customer interacts with (they receive the lead and conversation);</li>
					<li>when required by law, legal process, or to protect the rights, safety and security of users and the public;</li>
					<li>in connection with a merger, acquisition or asset sale, under continued confidentiality.</li>
				</ul>
				<p>We never sell or rent personal information.</p>
			</section>

			<section id="security">
				<h2><span class="s-n">08</span> How we protect data</h2>
				<ul>
					<li>Data is encrypted in transit (TLS) and access tokens — including WhatsApp credentials — are <strong>encrypted at rest</strong> (AES-256-GCM).</li>
					<li>Each tenant's data is logically isolated; messages and credentials are scoped so one business can never read or send from another's number.</li>
					<li>Access to production systems is restricted, and secrets are never exposed to browsers or logs.</li>
				</ul>
				<p>No system is perfectly secure, but we work continuously to safeguard your information and to respond quickly if an issue arises.</p>
			</section>

			<section id="retention">
				<h2><span class="s-n">09</span> Data retention</h2>
				<p>We keep information for as long as your account is active and as needed to provide the service, then only as long as required for legitimate business or legal purposes. Operators can delete knowledge, leads, proposals and conversations from their workspace. Disconnecting WhatsApp removes our ability to use the stored token, and connection records are deleted or de-activated on request.</p>
			</section>

			<section id="rights">
				<h2><span class="s-n">10</span> Your rights &amp; choices</h2>
				<p>Depending on where you live, you may have the right to access, correct, export, restrict or delete your personal information, and to object to certain processing. To exercise these rights, contact us using the details below — we will respond within a reasonable timeframe. If you are a customer of an Operator, you can also contact that business directly.</p>
			</section>

			<section id="deletion" class="highlight">
				<h2><span class="s-n">11</span> Deleting your data</h2>
				<p>You can request deletion of your data at any time:</p>
				<ul>
					<li><strong>Operators:</strong> delete records inside your workspace, disconnect WhatsApp under <em>Portal → WhatsApp</em>, or email us to close your account and erase associated data.</li>
					<li><strong>Customers / message recipients:</strong> ask the business you chatted with, or email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the phone number or details concerned.</li>
				</ul>
				<p>Send deletion requests to <a href={`mailto:${CONTACT_EMAIL}?subject=Data%20deletion%20request`}>{CONTACT_EMAIL}</a> or via WhatsApp at <a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer">{TEL}</a>. We will verify the request and delete the data unless we are legally required to keep it.</p>
			</section>

			<section id="transfers">
				<h2><span class="s-n">12</span> International transfers</h2>
				<p>We operate from Tanzania and use providers located in other countries, including the United States. Where data crosses borders, we rely on appropriate safeguards and require our providers to protect it to a comparable standard.</p>
			</section>

			<section id="cookies">
				<h2><span class="s-n">13</span> Cookies</h2>
				<p>We use only the cookies necessary to sign you in and keep your session secure. We do not use third-party advertising or cross-site tracking cookies. You can clear cookies in your browser, though signing in requires them.</p>
			</section>

			<section id="children">
				<h2><span class="s-n">14</span> Children's privacy</h2>
				<p>The service is intended for businesses and adults. It is not directed to children under 16, and we do not knowingly collect their personal information. If you believe a child has provided us data, contact us and we will remove it.</p>
			</section>

			<section id="changes">
				<h2><span class="s-n">15</span> Changes to this policy</h2>
				<p>We may update this policy as the service and legal requirements change. We will revise the "Last updated" date above and, for material changes, provide additional notice. Continued use after an update means you accept the revised policy.</p>
			</section>

			<section id="contact">
				<h2><span class="s-n">16</span> Contact us</h2>
				<p>Questions or requests about privacy? Reach the Makutano team:</p>
				<div class="contact">
					<a class="c-item" href={`mailto:${CONTACT_EMAIL}`}>
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
						{CONTACT_EMAIL}
					</a>
					<a class="c-item" href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer">
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
						WhatsApp {TEL}
					</a>
					<span class="c-item static">
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
						Tanzania · East Africa
					</span>
				</div>
			</section>

			<div class="foot-note">
				<span>© {new Date().getFullYear()} {SITE}. All rights reserved.</span>
				<a href="#top">Back to top ↑</a>
			</div>
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

	/* Collect cards */
	.cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; }
	.mini { background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 0.95rem 1rem; }
	.mini p { font-size: 0.9rem; margin: 0; color: #3c4d45; }

	/* Processors */
	.proc { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin: 0.4rem 0 0.9rem; }
	.proc-row { display: grid; grid-template-columns: 210px 1fr; gap: 1rem; padding: 0.85rem 1rem; }
	.proc-row + .proc-row { border-top: 1px solid var(--line); }
	.proc-row:nth-child(odd) { background: var(--bg); }
	.proc-name { font-weight: 700; color: var(--forest); font-size: 0.92rem; display: flex; flex-direction: column; gap: 0.15rem; }
	.proc-region { font-weight: 500; font-size: 0.76rem; color: var(--muted); }
	.proc-use { font-size: 0.9rem; color: #3c4d45; line-height: 1.55; }

	/* Contact */
	.contact { display: flex; flex-wrap: wrap; gap: 0.7rem; margin-top: 0.3rem; }
	.c-item {
		display: inline-flex; align-items: center; gap: 0.5rem;
		background: var(--bg); border: 1px solid var(--line); border-radius: 999px;
		padding: 0.55rem 1rem; font-size: 0.92rem; font-weight: 600; text-decoration: none;
		color: var(--forest);
	}
	.c-item:hover:not(.static) { border-color: var(--gold); color: var(--gold-ink); }
	.c-item.static { cursor: default; color: var(--muted); }
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
		.proc-row { grid-template-columns: 1fr; gap: 0.25rem; }
		section { padding: 1.4rem 1.25rem; }
	}
</style>
