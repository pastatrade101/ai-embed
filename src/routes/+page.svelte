<script>
	// Public marketing landing page. Self-contained forest/gold/cream theme so it
	// doesn't inherit the dark admin app.css. All CTAs lead to the existing /login.
	import Icon from '$lib/Icon.svelte';
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';

	const LOGIN = '/login';
	const ONBOARD = '/onboarding';

	// Dogfood the product: embed our own AI assistant on the marketing site so it
	// can answer questions about Makutano and convert visitors. Point
	// PUBLIC_SITE_ASSISTANT_SLUG at a Makutano tenant (industry: ICT / Tech Agency
	// or Other Business) that has the product knowledge imported. Inert until set.
	onMount(() => {
		const slug = env.PUBLIC_SITE_ASSISTANT_SLUG;
		if (!slug) return;
		const s = document.createElement('script');
		s.src = '/widget.js';
		s.async = true;
		s.setAttribute('data-client', slug);
		document.body.appendChild(s);
	});

	const unanswered = [
		'How much does this cost?',
		'Do you have it available this week?',
		'What’s included in the price?',
		'Can you deliver to my area?',
		'How do I get started?'
	];
	const capabilities = [
		'Recommend the right option',
		'Answer questions instantly',
		'Explain pricing & details',
		'Compare your options',
		'Check what’s available',
		'Suggest upgrades & add-ons',
		'Reply in the customer’s language',
		'Read photos & PDFs',
		'Qualify serious buyers',
		'Capture leads automatically',
		'Hand off to WhatsApp with full context',
		'Work 24/7, even while you sleep'
	];
	const steps = [
		{ n: '01', t: 'Create your AI assistant', d: 'Set it up in minutes — no code, no technical skills.' },
		{ n: '02', t: 'Add your knowledge', d: 'Import from CSV, JSON, PDF, or paste content. The AI organises everything.' },
		{ n: '03', t: 'Share your assistant', d: 'WhatsApp, Instagram bio, Facebook, Google Business, QR code, your website.' },
		{ n: '04', t: 'Receive sales-ready leads', d: 'Qualified customers arrive in your WhatsApp with all the important details.' }
	];
	const proposalPower = [
		'Drafts the quote straight from the chat',
		'Priced from your real catalogue — never guessed',
		'A premium, branded quotation page',
		'Customers accept in a single tap',
		'Smart upsell & cross-sell suggestions',
		'Stays in sync as the details change',
		'See when it’s opened and accepted',
		'Explains why it recommended each option'
	];
	const builtWith = ['Your prices', 'Your products & services', 'Your availability', 'Your FAQs', 'Your policies', 'Your process'];
	const channels = ['Instagram', 'WhatsApp', 'Facebook', 'Google Business', 'Your website', 'QR Codes'];
	const reasons = [
		'Setup in under 10 minutes',
		'No coding required',
		'No website required',
		'Mobile friendly',
		'AI auto-updates',
		'Adapts to your industry',
		'Professional experience',
		'Captures qualified leads',
		'Saves hours each week',
		'Converts more enquiries'
	];
	// Live pricing from the plans catalogue (see +page.server.js). Prices come
	// through in the plan's own currency (TZS for the paid tiers).
	export let data;
	const nf = new Intl.NumberFormat('en-US');
	// Estimated monthly conversations from a plan's AI budget — the same basis the
	// operator billing and admin screens use, so all three always show one number.
	// Falls back to the legacy conversation cap only if a plan has no budget set.
	const cpc = data.costPerConversation || 0.004;
	const planConversations = (p) => {
		const budget = Number(p.included_ai_budget) || 0;
		return budget > 0 ? Math.round(budget / cpc) : Number(p.monthly_conversation_cap) || 0;
	};
	$: plans = (data.plans ?? []).map((p, i, arr) => {
		const amount = Number(p.price_amount) || 0;
		return {
			name: p.name,
			// A free (zero) plan just reads "Free"; paid tiers show "TZS 55,000".
			price: amount === 0 ? 'Free' : `${p.price_currency} ${nf.format(amount)}`,
			paid: amount > 0,
			tag: `≈ ${nf.format(planConversations(p))} conversations / mo`,
			features: p.features ?? [],
			// Spotlight the middle tier as the recommended one.
			highlight: arr.length > 1 && i === Math.floor(arr.length / 2)
		};
	});
	const faqs = [
		{ q: 'Is this just a chatbot?', a: 'No. Alongside the customer-facing assistant, you get an AI analyst that answers questions about your business from your real numbers, an AI researcher that drafts new knowledge from the web for you to approve, automatic website sync, and a scored sales pipeline.' },
		{ q: 'Do I need a website?', a: 'No. Makutano AI creates a hosted AI page automatically — just share the link or QR code. If you do have a website, it can scan and import your content for you.' },
		{ q: 'Does the AI use my own prices?', a: 'Yes. It answers only from your verified catalogue — never generic internet knowledge — so every price, date and detail is accurate.' },
		{ q: 'Can customers still reach me on WhatsApp?', a: 'Yes. The AI hands sales-ready customers directly to your WhatsApp, carrying the full conversation so you pick up right where it left off.' },
		{ q: 'Can it create quotations and proposals?', a: 'Yes. When a customer is ready to buy, Makutano AI drafts a full quotation from the conversation — priced from your real catalogue — which you review in a click. Your customer opens a premium branded page and accepts in one tap, and you can see the moment it’s viewed and accepted.' },
		{ q: 'What languages does it speak?', a: 'It replies in the customer’s language automatically, and can read photos and PDFs they send.' },
		{ q: 'How do I add my information?', a: 'Import from CSV, JSON or PDF, paste your content, or point it at your website and let it import automatically. The AI organises everything.' },
		{ q: 'How much does the AI cost to run?', a: 'Every plan includes a generous monthly AI allowance shown as simple usage — no tokens to think about — with clear forecasts and top-ups if you ever need more.' },
		{ q: 'How long does setup take?', a: 'Most businesses are live in less than 10 minutes.' }
	];

	// ---- SEO / social share ----
	const SITE = 'Makutano AI';
	const SEO_TITLE = 'Makutano AI — AI Sales Assistant for Every Business';
	const SEO_DESC =
		'The complete AI team for any business: an assistant that answers customers, recommends the right option and qualifies leads 24/7 — then drafts branded quotations customers accept in one tap. Plus an AI analyst that reads your numbers, an AI researcher that fills knowledge gaps, website auto-sync and a sales pipeline. No website needed.';
	$: seoOrigin = data.origin ?? 'https://ai.makutano.co.tz';
	$: canonicalUrl = `${seoOrigin}/`;
	$: ogImage = `${seoOrigin}/og-image.png`;
	// Structured data: the product + its live plans, and an FAQ block for rich results.
	$: jsonLd = JSON.stringify([
		{
			'@context': 'https://schema.org',
			'@type': 'SoftwareApplication',
			name: SITE,
			applicationCategory: 'BusinessApplication',
			operatingSystem: 'Web',
			url: canonicalUrl,
			description: SEO_DESC,
			image: ogImage,
			offers: (data.plans ?? []).map((p) => ({
				'@type': 'Offer',
				name: p.name,
				price: String(Number(p.price_amount) || 0),
				priceCurrency: p.price_currency || 'USD'
			})),
			publisher: {
				'@type': 'Organization',
				name: SITE,
				url: canonicalUrl,
				logo: `${seoOrigin}/ICON-AI.png`
			}
		},
		{
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: faqs.map((f) => ({
				'@type': 'Question',
				name: f.q,
				acceptedAnswer: { '@type': 'Answer', text: f.a }
			}))
		}
	]);
</script>

<svelte:head>
	<title>{SEO_TITLE}</title>
	<meta name="description" content={SEO_DESC} />
	<link rel="canonical" href={canonicalUrl} />
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<meta name="theme-color" content="#10362a" />
	<meta name="author" content={SITE} />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE} />
	<meta property="og:title" content={SEO_TITLE} />
	<meta property="og:description" content={SEO_DESC} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="Makutano AI — AI sales assistant for every business" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={SEO_TITLE} />
	<meta name="twitter:description" content={SEO_DESC} />
	<meta name="twitter:image" content={ogImage} />

	<!-- Structured data -->
	{@html `<script type="application/ld+json">${jsonLd}<\/script>`}
</svelte:head>

<div class="landing">
	<!-- NAV -->
	<header class="nav">
		<div class="wrap nav-in">
			<a class="brand" href="#top">
				<img src="/ICON-AI.png" alt="" />
				<span>Makutano&nbsp;AI</span>
			</a>
			<nav class="nav-pill">
				<a class="nav-link active" href="#top">Home</a>
				<a class="nav-link" href="#features">Features</a>
				<a class="nav-link" href="#how">How it works</a>
				<a class="nav-link" href="#pricing">Pricing</a>
				<a class="nav-link" href="#faq">FAQ</a>
			</nav>
			<a class="btn gold sm nav-cta" href={LOGIN}>Sign in <Icon name="arrow-right" size={15} /></a>
		</div>
	</header>

	<!-- HERO -->
	<section id="top" class="hero">
		<div class="hero-bg"></div>
		<div class="wrap hero-in">
			<div class="hero-copy">
				<span class="pill"><Icon name="sparkles" size={14} /> Built for modern businesses</span>
				<h1>Your best salesperson<br /><em>never sleeps.</em></h1>
				<p class="lead">
					Turn every website visitor, WhatsApp enquiry, Instagram bio click, Google Business visitor or QR scan into a
					qualified sales conversation — 24/7.
				</p>
				<p class="sub">
					Makutano AI instantly answers customer questions, recommends the right option, qualifies leads, and hands
					sales-ready customers directly to your WhatsApp.
				</p>
				<div class="cta-row">
					<a class="btn gold" href={ONBOARD}>Get started free <Icon name="arrow-right" size={18} /></a>
					<a class="btn ghost" href="#how"><Icon name="play" size={17} /> See how it works</a>
				</div>
				<p class="trust">Trusted by modern businesses to capture more leads with AI</p>
			</div>
			<div class="hero-art">
				<span class="hero-art-glow"></span>
				<img
					src="/hero-device.png"
					alt="The Makutano AI assistant live on a business's website, shown on a laptop and phone"
					width="1600"
					height="986"
					loading="eager"
				/>
			</div>
		</div>
	</section>

	<!-- WHY -->
	<section class="why">
		<div class="wrap grid-2">
			<div>
				<div class="label">Why Makutano AI</div>
				<h2 class="dark">Customers don't wait. If nobody replies quickly, they book somewhere else.</h2>
				<p class="muted">
					Makutano AI makes sure that never happens — answering every enquiry the moment it arrives, in your voice,
					with your prices.
				</p>
			</div>
			<div class="card qcard">
				<p class="qcard-label">Real questions, unanswered</p>
				<ul>
					{#each unanswered as q}
						<li>"{q}"</li>
					{/each}
				</ul>
			</div>
		</div>
	</section>

	<!-- MEET AI ASSISTANT -->
	<section class="meet">
		<div class="wrap grid-2 aligned">
			<div class="chatmock">
				<div class="cm-head"><img src="/ICON-AI.png" alt="" /><span>Goldie · your AI assistant</span></div>
				<div class="cm-body">
					<div class="cm-msg cm-user">Hi! How much is this, and do you have it available this week?</div>
					<div class="cm-msg cm-ai">It's <b>$120</b> and yes — we have availability this week. It includes everything you need to get started. Want me to hold a slot for you?</div>
					<div class="cm-msg cm-user">Yes please. Can I pay on delivery?</div>
					<div class="cm-msg cm-ai">Of course. Shall I hand you to the team on WhatsApp to confirm the details and get you sorted?</div>
				</div>
			</div>
			<div>
				<div class="label">Meet your AI sales assistant</div>
				<h2>The first person every customer speaks to.</h2>
				<p class="cream-muted">It works 24 hours a day — even while you're sleeping or busy with a customer.</p>
				<ul class="cap-grid">
					{#each capabilities as c}
						<li><span class="dot"></span>{c}</li>
					{/each}
				</ul>
			</div>
		</div>
	</section>

	<!-- AI TEAM -->
	<section class="team">
		<div class="wrap">
			<div class="head-narrow">
				<div class="label">More than a chatbot</div>
				<h2 class="dark">One subscription. A whole AI team working your sales.</h2>
				<p class="muted">Makutano AI isn't a single bot — it's several specialists, each doing a job you'd otherwise hire for.</p>
			</div>
			<div class="roles">
				<div class="role card">
					<div class="role-ico"><Icon name="bot" size={24} /></div>
					<h3>Your AI salesperson</h3>
					<p>Answers every customer in seconds, recommends the right option from your own catalogue, explains pricing and availability, qualifies the serious buyers and hands them to WhatsApp with the full conversation — day and night.</p>
				</div>
				<div class="role card">
					<div class="role-ico"><Icon name="bar-chart" size={24} /></div>
					<h3>Your AI analyst</h3>
					<p>Ask it anything about your business and it answers from your real numbers — top performers, conversion, potential sales value, what's in demand, where enquiries stall — and flags the catalogue gaps quietly costing you sales.</p>
				</div>
				<div class="role card">
					<div class="role-ico"><Icon name="search" size={24} /></div>
					<h3>Your AI researcher</h3>
					<p>Point it at a question customers keep asking and it researches the web, drafts a knowledge entry for you to approve, and keeps your website content in sync — so your assistant only ever gets sharper.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- AI PROPOSALS -->
	<section class="proposals">
		<div class="proposals-bg"></div>
		<div class="wrap grid-2 aligned">
			<div class="proposals-copy">
				<div class="label">New · AI Proposals &amp; Quotations</div>
				<h2>From a conversation to a signed quotation — automatically.</h2>
				<p class="cream-muted">The moment a customer is ready to buy, Makutano AI turns the whole conversation into a polished, branded quotation — priced from your real catalogue. Review it in a click; your customer opens a beautiful page and accepts in a single tap.</p>
				<ul class="cap-grid">
					{#each proposalPower as c}
						<li><span class="dot"></span>{c}</li>
					{/each}
				</ul>
				<div class="cta-row">
					<a class="btn gold" href={ONBOARD}>Start sending AI quotes <Icon name="arrow-right" size={18} /></a>
				</div>
			</div>
			<div class="quote-mock">
				<span class="qm-accent"></span>
				<div class="qm-top">
					<div class="qm-brand"><span class="qm-logo">GS</span><span>Goldfinch Studio</span></div>
					<span class="qm-status"><span class="qm-dot"></span>Accepted</span>
				</div>
				<div class="qm-kind">Quotation · QUO-2026-0148</div>
				<div class="qm-title">Website &amp; Brand Launch Package</div>
				<div class="qm-items">
					<div class="qm-item"><span>Website design &amp; build</span><b>$2,400</b></div>
					<div class="qm-item"><span>Brand identity kit</span><b>$850</b></div>
					<div class="qm-item"><span>3 months of support</span><b>$600</b></div>
				</div>
				<div class="qm-total"><span>Total</span><b>$3,850</b></div>
				<div class="qm-accept">Accept quotation</div>
				<div class="qm-foot"><span class="qm-match">96%</span> AI match to this customer</div>
			</div>
		</div>
	</section>

	<!-- HOW IT WORKS -->
	<section id="how" class="how">
		<div class="wrap">
			<div class="head-narrow">
				<div class="label">How it works</div>
				<h2 class="dark">Live in under 10 minutes. Four simple steps.</h2>
			</div>
			<div class="steps">
				{#each steps as s}
					<div class="step card">
						<div class="step-n">{s.n}</div>
						<h3>{s.t}</h3>
						<p class="muted">{s.d}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- FEATURES (bento) -->
	<section id="features" class="features">
		<div class="wrap">
			<div class="head-narrow">
				<div class="label">Everything you need</div>
				<h2 class="dark">A complete sales engine. Powered by AI, tuned to your business.</h2>
			</div>
			<div class="bento">
				<div class="b b-hero">
					<div class="b-ico"><Icon name="bot" size={26} /></div>
					<h3>AI Sales Assistant</h3>
					<p>Answers customer questions instantly using your own business information — not random internet knowledge.</p>
					<div class="b-chat">
						<div class="bc user">"How much is this, and do you have it available this week?"</div>
						<div class="bc ai">It's $120 and yes — we have availability this week. It includes everything you need to get started. Want me to hold a slot for you?</div>
					</div>
				</div>
				<div class="b b-card"><div class="b-ico"><Icon name="book-open" size={22} /></div><h3>AI Knowledge</h3><p>Upload once. The AI learns your products, services, prices, policies, FAQs and everything customers ask about.</p></div>
				<div class="b b-card"><div class="b-ico"><Icon name="calendar" size={22} /></div><h3>Real-Time Availability</h3><p>"Do you have it available next week?" The AI checks your real schedule before answering.</p></div>
				<div class="b b-gold"><div class="b-ico b-ico-ink"><Icon name="message-circle" size={26} /></div><h3>WhatsApp Handoff</h3><p>Sales-ready customers land directly in your WhatsApp. No copying. No exporting. No CRM headaches.</p></div>
				<div class="b b-card b-wide"><div class="b-ico"><Icon name="trending-up" size={22} /></div><h3>AI Lead Qualification</h3><p>Budget, timing, needs, interests & buying intent — extracted automatically into a clean lead record before you even reply.</p></div>
					<div class="b b-card b-wide"><div class="b-ico"><Icon name="file-text" size={22} /></div><h3>AI Proposals & Quotations</h3><p>Turn a ready-to-buy chat into a branded quotation priced from your catalogue — your customer opens a premium page and accepts in one tap.</p></div>
				<div class="b b-card"><div class="b-ico"><Icon name="bar-chart" size={22} /></div><h3>AI Data Analyst</h3><p>Ask your business anything — "What converts best?", "Where are leads dropping off?" — answered from your real numbers, never guessed.</p></div>
				<div class="b b-card"><div class="b-ico"><Icon name="search" size={22} /></div><h3>AI Research Assistant</h3><p>Point it at a topic customers keep asking about; it researches the web and drafts a ready-to-publish knowledge entry for you to approve.</p></div>
				<div class="b b-card"><div class="b-ico"><Icon name="refresh" size={22} /></div><h3>Website Sync</h3><p>Connect your website and it imports your pages automatically — deep-scanning your whole site — and keeps your AI in sync as things change.</p></div>
				<div class="b b-card"><div class="b-ico"><Icon name="trending-up" size={22} /></div><h3>Sales Pipeline & Revenue</h3><p>Every enquiry scored and staged automatically — track pipeline value, conversion and revenue in one clear dashboard.</p></div>
				<div class="b b-card"><div class="b-ico"><Icon name="languages" size={22} /></div><h3>Speaks Their Language</h3><p>Replies in each customer's own language, and reads photos & PDFs they send — a receipt, an ID, a screenshot of another quote.</p></div>
				<div class="b b-card"><div class="b-ico"><Icon name="globe" size={22} /></div><h3>Hosted AI Page</h3><p>No website? We create a professional AI page for your business — with rich product & pricing cards. Just share the link.</p></div>
				<div class="b b-card"><div class="b-ico"><Icon name="qr" size={22} /></div><h3>QR Code Chat</h3><p>Print your QR on your storefront, packaging, flyers & cards. Visitors scan and start chatting.</p></div>
			</div>
		</div>
	</section>

	<!-- BUILT FOR OPERATORS -->
	<section class="built">
		<div class="built-bg"></div>
		<div class="wrap built-in">
			<div class="built-copy">
				<div class="head-narrow">
					<div class="label">Built for your business</div>
					<h2>Unlike generic chatbots, Makutano AI understands your business.</h2>
					<p class="cream-muted">It answers using your verified business information — never random internet content. So customers always receive accurate answers.</p>
				</div>
				<ul class="built-list">
					{#each builtWith as b}
						<li><span class="tick"><Icon name="check" size={15} stroke={2.5} /></span>{b}</li>
					{/each}
				</ul>
			</div>
			<div class="built-art">
				<img
					src="/dedicated_ai-web.png"
					alt="A customer chatting with a business's Makutano AI page on a phone"
					width="814"
					height="1000"
					loading="lazy"
				/>
			</div>
		</div>
	</section>

	<!-- NO WEBSITE -->
	<section class="nowebsite">
		<div class="wrap center">
			<div class="label">No website? No problem.</div>
			<h2 class="dark narrow">Wherever your customers already are, Makutano AI meets them.</h2>
			<div class="chips">
				{#each channels as c}<span class="chip">{c}</span>{/each}
			</div>
		</div>
	</section>

	<!-- LOVE -->
	<section class="love">
		<div class="wrap">
			<div class="head-narrow">
				<div class="label">Why businesses love it</div>
				<h2 class="dark">Ten reasons businesses switch to Makutano AI.</h2>
			</div>
			<div class="reasons">
				{#each reasons as r}<div class="reason"><span class="tick"><Icon name="check" size={15} stroke={2.5} /></span>{r}</div>{/each}
			</div>
		</div>
	</section>

	<!-- PRICING -->
	<section id="pricing" class="pricing">
		<div class="wrap">
			<div class="head-narrow">
				<div class="label">Pricing</div>
				<h2 class="dark">One sale can pay for months of Makutano AI.</h2>
				<p class="muted">Choose the plan that fits your business. Upgrade anytime. No hidden fees.</p>
			</div>
			<div class="plans">
				{#each plans as p}
					<div class="plan" class:hot={p.highlight}>
						{#if p.highlight}<div class="plan-pop">Most popular</div>{/if}
						<div class="plan-tag">{p.tag}</div>
						<div class="plan-name">{p.name}</div>
						<div class="plan-price">{p.price}{#if p.paid}<span>/mo</span>{/if}</div>
						<ul>
							{#each p.features as f}<li><span class="tick"><Icon name="check" size={15} stroke={2.5} /></span>{f}</li>{/each}
						</ul>
						<a class="btn {p.highlight ? 'gold' : 'outline'} full" href={ONBOARD}>Get started</a>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- FAQ -->
	<section id="faq" class="faq">
		<div class="wrap grid-2">
			<div>
				<div class="label">FAQ</div>
				<h2 class="dark">Questions, answered.</h2>
			</div>
			<div class="faq-list">
				{#each faqs as f}
					<details class="card">
						<summary>{f.q}<span class="plus">+</span></summary>
						<p class="muted">{f.a}</p>
					</details>
				{/each}
			</div>
		</div>
	</section>

	<!-- FINAL CTA -->
	<section class="final">
		<div class="wrap center">
			<div class="label">Final call</div>
			<h2 class="big">Stop losing customers <em>while you're offline.</em></h2>
			<p class="cream-muted narrow">
				Your next customer is already asking questions somewhere. Make sure your business answers first — let Makutano
				AI become your smartest employee.
			</p>
			<div class="cta-row center-row">
				<a class="btn gold" href={ONBOARD}>Get started free</a>
				<a class="btn ghost" href="#features">Explore features</a>
			</div>
			<p class="fineprint-cta">Setup in under 10 minutes · No technical skills needed</p>
		</div>
	</section>

	<!-- FOOTER -->
	<footer class="foot">
		<div class="wrap foot-grid">
			<div class="foot-brand">
				<a class="brand" href="#top">
					<img src="/ICON-AI.png" alt="" />
					<span class="foot-name">Makutano&nbsp;AI</span>
				</a>
				<p class="foot-tag">The AI sales assistant built for modern businesses — turn every website visitor, WhatsApp enquiry and QR scan into a qualified lead, 24/7.</p>
				<a class="foot-chip" href="https://wa.me/255752093014" target="_blank" rel="noopener noreferrer">
					<Icon name="message-circle" size={15} /> Chat with us on WhatsApp
				</a>
			</div>

			<nav class="foot-col">
				<div class="foot-h">Product</div>
				<a href="#features">Features</a>
				<a href="#how">How it works</a>
				<a href="#pricing">Pricing</a>
				<a href="#faq">FAQ</a>
			</nav>

			<nav class="foot-col">
				<div class="foot-h">Get started</div>
				<a href={ONBOARD}>Create free account</a>
				<a href={LOGIN}>Sign in</a>
				<a href="#top">Back to top</a>
			</nav>

			<div class="foot-col">
				<div class="foot-h">Contact</div>
				<a class="foot-contact" href="tel:+255752093014"><Icon name="phone" size={15} /> +255 752 093 014</a>
				<a class="foot-contact" href="https://wa.me/255752093014" target="_blank" rel="noopener noreferrer"><Icon name="message-circle" size={15} /> WhatsApp</a>
				<span class="foot-contact"><Icon name="map-pin" size={15} /> Tanzania · East Africa</span>
				<span class="foot-contact"><Icon name="globe" size={15} /> Mon–Sat, 8am–8pm EAT</span>
			</div>
		</div>

		<div class="wrap foot-bar">
			<div class="foot-copy">© {new Date().getFullYear()} Makutano&nbsp;AI. All rights reserved.</div>
			<a class="foot-top" href="#top">Back to top <Icon name="arrow-up" size={14} /></a>
		</div>
	</footer>
</div>

<style>
	.landing {
		--forest: #10362a;
		--forest-2: #0c2c22;
		--forest-mid: #2c6b52;
		--gold: #e0b24c;
		--gold-soft: #ecca7d;
		--gold-ink: #23180a;
		--cream: #f7f2e8;
		--bg: #faf7f0;
		--bg-2: #f1ece1;
		--card: #ffffff;
		--ink: #123528;
		--ink-2: #3c5245;
		--muted: #6b7c72;
		--line: rgba(18, 53, 40, 0.12);
		background: var(--bg);
		color: var(--ink);
		font-family: 'Geist', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
		-webkit-font-smoothing: antialiased;
		letter-spacing: -0.011em;
		min-height: 100vh;
		overflow-x: hidden;
	}

	/* Neutralise the dark admin app.css element rules that would leak in */
	.landing :global(h1),
	.landing :global(h2),
	.landing :global(h3),
	.landing :global(strong),
	.landing :global(b) {
		color: inherit;
	}
	.landing :global(a) {
		color: inherit;
		text-decoration: none;
	}

	.wrap {
		width: 100%;
		max-width: 1180px;
		margin: 0 auto;
		padding: 0 24px;
	}
	.label {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--gold);
		margin-bottom: 1rem;
	}
	h2 {
		font-size: clamp(1.9rem, 3.6vw, 3rem);
		font-weight: 640;
		line-height: 1.1;
		letter-spacing: -0.02em;
		margin: 0;
		/* Even out multi-line headings instead of cramped, lopsided wraps. */
		text-wrap: balance;
	}
	h3 {
		text-wrap: balance;
	}
	h2.dark {
		color: var(--ink);
	}
	.head-narrow {
		max-width: 40rem;
	}
	h2.narrow {
		max-width: 46rem;
	}
	h2.big {
		font-size: clamp(2.2rem, 5vw, 3.8rem);
	}
	h2 em,
	h1 em {
		font-style: italic;
		color: var(--gold);
	}

	/* Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border-radius: 999px;
		padding: 0.85rem 1.6rem;
		font-size: 0.92rem;
		font-weight: 650;
		cursor: pointer;
		border: 1px solid transparent;
		transition: transform 0.15s, background 0.15s, box-shadow 0.15s, color 0.15s;
	}
	.btn.sm {
		padding: 0.55rem 1.15rem;
		font-size: 0.86rem;
	}
	.btn.full {
		width: 100%;
	}
	.btn.gold {
		background: var(--gold);
		color: var(--gold-ink);
	}
	.btn.gold:hover {
		background: var(--gold-soft);
		box-shadow: 0 12px 30px -10px rgba(224, 178, 76, 0.6);
		transform: translateY(-1px);
	}
	.btn.ghost {
		border-color: rgba(247, 242, 232, 0.35);
		color: var(--cream);
	}
	.btn.ghost:hover {
		background: rgba(247, 242, 232, 0.1);
	}
	.btn.outline {
		border-color: var(--forest);
		color: var(--forest);
	}
	.btn.outline:hover {
		background: var(--forest);
		color: var(--cream);
	}

	/* Nav — sticky bar with a centred pill of links */
	.nav {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 50;
		background: rgba(11, 42, 32, 0.72);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border-bottom: 1px solid rgba(247, 242, 232, 0.08);
	}
	.nav-in {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		padding-top: 0.75rem;
		padding-bottom: 0.75rem;
	}
	.nav-in .brand {
		justify-self: start;
	}
	.nav-in .nav-cta {
		justify-self: end;
	}
	/* Below the pill breakpoint the centre track is hidden — fall back to a
	   simple brand-left / button-right bar so the button stays flush right. */
	@media (max-width: 899px) {
		.nav-in {
			display: flex;
			justify-content: space-between;
		}
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--cream);
		font-weight: 680;
		font-size: 1.1rem;
		letter-spacing: -0.02em;
	}
	.brand img {
		width: 38px;
		height: 38px;
		border-radius: 10px;
		object-fit: cover;
	}
	.nav-pill {
		display: none;
		flex-direction: row;
		align-items: center;
		gap: 0.15rem;
		padding: 0.3rem;
		border-radius: 999px;
		background: rgba(247, 242, 232, 0.06);
		border: 1px solid rgba(247, 242, 232, 0.1);
	}
	@media (min-width: 900px) {
		.nav-pill {
			display: inline-flex;
		}
	}
	.nav-link {
		padding: 0.5rem 0.95rem;
		border-radius: 999px;
		font-size: 0.86rem;
		font-weight: 500;
		color: rgba(247, 242, 232, 0.72);
		white-space: nowrap;
		transition: color 0.15s, background 0.15s;
	}
	.nav-link:hover {
		color: var(--cream);
	}
	.nav-link.active {
		background: var(--cream);
		color: var(--forest);
		font-weight: 600;
	}

	/* Anchored sections clear the fixed nav; smooth-scroll the pill links */
	:global(html) {
		scroll-behavior: smooth;
	}
	#features,
	#how,
	#pricing,
	#faq {
		scroll-margin-top: 82px;
	}

	/* Hero */
	.hero {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		color: var(--cream);
		display: flex;
		align-items: center;
		min-height: 100vh;
		min-height: 100svh;
	}
	.hero-bg {
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			radial-gradient(90% 60% at 78% 8%, rgba(224, 178, 76, 0.5), transparent 55%),
			radial-gradient(70% 50% at 12% 100%, rgba(44, 107, 82, 0.55), transparent 60%),
			linear-gradient(160deg, var(--forest) 0%, var(--forest-2) 60%, #0a231b 100%);
	}
	.hero-bg::after {
		content: '';
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(247, 242, 232, 0.05) 1px, transparent 1.3px);
		background-size: 22px 22px;
		-webkit-mask-image: linear-gradient(180deg, transparent, #000 40%, transparent);
		mask-image: linear-gradient(180deg, transparent, #000 40%, transparent);
	}
	.hero-in {
		width: 100%;
		padding: 7.5rem 24px 3.5rem;
		max-width: 1180px;
		display: grid;
		gap: 2.75rem;
		align-items: center;
	}
	@media (min-width: 960px) {
		.hero-in {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr);
			gap: 3rem;
			padding: 6.5rem 24px 4.5rem;
		}
	}
	.hero-copy {
		max-width: 640px;
	}

	/* Entrance animation — plays once on load, staggered down the hero */
	@keyframes heroRise {
		from {
			opacity: 0;
			transform: translateY(26px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes heroArtIn {
		from {
			opacity: 0;
			transform: translateX(48px) scale(0.94);
		}
		to {
			opacity: 1;
			transform: translateX(0) scale(1);
		}
	}
	.hero-copy > * {
		animation: heroRise 0.7s cubic-bezier(0.22, 0.7, 0.2, 1) both;
	}
	.hero-copy > *:nth-child(1) {
		animation-delay: 0.05s;
	}
	.hero-copy > *:nth-child(2) {
		animation-delay: 0.14s;
	}
	.hero-copy > *:nth-child(3) {
		animation-delay: 0.23s;
	}
	.hero-copy > *:nth-child(4) {
		animation-delay: 0.32s;
	}
	.hero-copy > *:nth-child(5) {
		animation-delay: 0.41s;
	}
	.hero-copy > *:nth-child(6) {
		animation-delay: 0.5s;
	}

	/* Product shot */
	.hero-art {
		position: relative;
		display: flex;
		justify-content: center;
		animation: heroArtIn 0.9s cubic-bezier(0.22, 0.7, 0.2, 1) 0.3s both;
	}
	.hero-art-glow {
		position: absolute;
		inset: -14% -10%;
		z-index: 0;
		background: radial-gradient(58% 52% at 55% 42%, rgba(224, 178, 76, 0.32), transparent 68%);
		filter: blur(26px);
		pointer-events: none;
	}
	.hero-art img {
		position: relative;
		z-index: 1;
		width: 100%;
		height: auto;
		filter: drop-shadow(0 34px 55px rgba(0, 0, 0, 0.45));
		animation: heroFloat 7s ease-in-out infinite;
	}
	@media (min-width: 960px) {
		.hero-art img {
			width: 108%;
			max-width: none;
			margin-right: -8%;
		}
	}
	@keyframes heroFloat {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hero-art,
		.hero-art img,
		.hero-copy > * {
			animation: none;
			opacity: 1;
			transform: none;
		}
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid rgba(224, 178, 76, 0.4);
		background: rgba(224, 178, 76, 0.12);
		color: var(--gold);
		border-radius: 999px;
		padding: 0.35rem 0.85rem;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.pill i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--gold);
	}
	.hero h1 {
		margin: 1.5rem 0 0;
		font-size: clamp(2.4rem, 4vw, 3.1rem);
		font-weight: 660;
		line-height: 1.06;
		letter-spacing: -0.03em;
		color: var(--cream);
	}
	/* Keep the headline to exactly two lines on desktop (the <br> splits it);
	   mobile is free to wrap the first line so it never overflows a phone. */
	@media (min-width: 960px) {
		.hero h1 {
			white-space: nowrap;
		}
	}
	.lead {
		margin: 1.5rem 0 0;
		font-size: clamp(1.05rem, 2vw, 1.3rem);
		line-height: 1.5;
		color: rgba(247, 242, 232, 0.82);
	}
	.sub {
		margin: 1rem 0 0;
		font-size: 1rem;
		line-height: 1.6;
		color: rgba(247, 242, 232, 0.6);
		max-width: 640px;
	}
	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
		margin-top: 2rem;
	}
	.center-row {
		justify-content: center;
	}
	/* Full-width, stacked hero CTAs on phones for easy tapping. */
	@media (max-width: 560px) {
		.hero .cta-row {
			flex-direction: column;
			align-items: stretch;
		}
		.hero .cta-row .btn {
			width: 100%;
		}
	}
	.trust {
		margin-top: 1.6rem;
		font-size: 0.72rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: rgba(247, 242, 232, 0.5);
	}

	/* Shared section rhythm */
	.why,
	.team,
	.how,
	.features,
	.nowebsite,
	.love,
	.pricing,
	.faq,
	.meet,
	.built,
	.final {
		padding: 6rem 0;
	}
	@media (min-width: 860px) {
		.why,
		.team,
		.how,
		.features,
		.nowebsite,
		.love,
		.pricing,
		.faq,
		.meet,
		.built,
		.final {
			padding: 8rem 0;
		}
	}
	/* Cream band, same as .how directly below it (dark heading + white cards). */
	.team {
		background: var(--bg);
	}
	.grid-2 {
		display: grid;
		gap: 3.5rem;
	}
	@media (min-width: 860px) {
		.grid-2 {
			grid-template-columns: 1fr 1.15fr;
		}
		.grid-2.aligned {
			align-items: center;
		}
		/* The Why section leads with a long statement — give it the wider column
		   so it lands as a tidy few lines instead of a cramped stack. */
		.why .grid-2 {
			grid-template-columns: 1.35fr 1fr;
			align-items: center;
		}
	}
	.muted {
		color: var(--muted);
		font-size: 1.05rem;
		line-height: 1.6;
		margin: 1.4rem 0 0;
	}
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 22px;
		box-shadow: 0 1px 2px rgba(18, 53, 40, 0.04);
	}

	/* Why */
	.why {
		background: var(--bg);
		border-bottom: 1px solid var(--line);
	}
	.qcard {
		padding: 2rem;
	}
	.qcard-label {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--forest-mid);
	}
	.qcard ul {
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.qcard li {
		border-left: 2px solid rgba(224, 178, 76, 0.6);
		padding-left: 1rem;
		font-size: 1.1rem;
		font-style: italic;
		color: var(--ink);
	}

	/* Meet AI (dark forest) */
	.meet {
		background: var(--forest);
		color: var(--cream);
	}
	.meet h2 {
		color: var(--cream);
	}
	.cream-muted {
		color: rgba(247, 242, 232, 0.7);
		font-size: 1.05rem;
		line-height: 1.6;
		margin: 1.4rem 0 0;
	}
	.cap-grid {
		margin: 2rem 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.7rem;
		font-size: 0.92rem;
		color: rgba(247, 242, 232, 0.88);
	}
	@media (min-width: 560px) {
		.cap-grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.cap-grid li {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
	}
	.cap-grid .dot {
		margin-top: 0.5rem;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--gold);
		flex: none;
	}
	.chatmock {
		background: linear-gradient(180deg, rgba(247, 242, 232, 0.06), rgba(247, 242, 232, 0.02));
		border: 1px solid rgba(247, 242, 232, 0.12);
		border-radius: 24px;
		overflow: hidden;
		box-shadow: 0 30px 60px -25px rgba(0, 0, 0, 0.6);
	}
	.cm-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.9rem 1.1rem;
		background: rgba(0, 0, 0, 0.2);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--cream);
	}
	.cm-head img {
		width: 30px;
		height: 30px;
		border-radius: 8px;
	}
	.cm-body {
		padding: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.cm-msg {
		max-width: 84%;
		padding: 0.7rem 0.9rem;
		border-radius: 16px;
		font-size: 0.9rem;
		line-height: 1.45;
	}
	.cm-user {
		align-self: flex-end;
		background: var(--gold);
		color: var(--gold-ink);
		border-bottom-right-radius: 5px;
	}
	.cm-ai {
		align-self: flex-start;
		background: rgba(247, 242, 232, 0.1);
		color: var(--cream);
		border-bottom-left-radius: 5px;
	}
	.cm-ai b {
		color: var(--gold-soft);
	}

	/* AI Proposals (dark forest) */
	.proposals {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		background: var(--forest);
		color: var(--cream);
		padding: 6rem 0;
	}
	@media (min-width: 860px) {
		.proposals {
			padding: 8rem 0;
		}
		.proposals .grid-2 {
			grid-template-columns: 1.08fr 0.92fr;
			align-items: center;
		}
	}
	.proposals-bg {
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			radial-gradient(55% 60% at 92% 12%, rgba(224, 178, 76, 0.2), transparent 60%),
			radial-gradient(50% 60% at 4% 92%, rgba(44, 107, 82, 0.42), transparent 60%);
	}
	.proposals h2 {
		color: var(--cream);
	}
	.proposals .cta-row {
		margin-top: 2rem;
	}
	.quote-mock {
		position: relative;
		background: #fff;
		color: var(--ink);
		border-radius: 22px;
		padding: 1.6rem 1.6rem 1.4rem;
		box-shadow: 0 40px 70px -30px rgba(0, 0, 0, 0.6);
		overflow: hidden;
		width: 100%;
		max-width: 420px;
		justify-self: center;
		animation: heroFloat 8s ease-in-out infinite;
	}
	.qm-accent {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		background: linear-gradient(90deg, var(--gold), var(--gold-soft));
	}
	.qm-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1.1rem;
	}
	.qm-brand {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-weight: 650;
		font-size: 0.9rem;
	}
	.qm-logo {
		width: 32px;
		height: 32px;
		border-radius: 9px;
		display: grid;
		place-items: center;
		background: var(--forest);
		color: var(--cream);
		font-size: 0.75rem;
		font-weight: 800;
	}
	.qm-status {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: #16a34a;
		background: rgba(22, 163, 74, 0.1);
		border: 1px solid rgba(22, 163, 74, 0.25);
		border-radius: 999px;
		padding: 0.25rem 0.6rem;
	}
	.qm-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #16a34a;
	}
	.qm-kind {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.qm-title {
		margin: 0.35rem 0 1.1rem;
		font-size: 1.2rem;
		font-weight: 680;
		letter-spacing: -0.01em;
		color: var(--ink);
	}
	.qm-items {
		display: flex;
		flex-direction: column;
	}
	.qm-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem 0;
		border-top: 1px solid var(--line);
		font-size: 0.9rem;
		color: var(--ink-2);
	}
	.qm-item:first-child {
		border-top: 0;
	}
	.qm-item b {
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.qm-total {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-top: 0.5rem;
		padding-top: 0.9rem;
		border-top: 2px solid var(--line);
	}
	.qm-total span {
		font-size: 0.85rem;
		color: var(--muted);
		font-weight: 600;
	}
	.qm-total b {
		font-size: 1.7rem;
		font-weight: 780;
		letter-spacing: -0.02em;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.qm-accept {
		margin-top: 1.1rem;
		text-align: center;
		background: var(--forest);
		color: var(--cream);
		border-radius: 12px;
		padding: 0.8rem;
		font-size: 0.9rem;
		font-weight: 650;
	}
	.qm-foot {
		margin-top: 0.9rem;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.qm-match {
		display: inline-grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(224, 178, 76, 0.16);
		color: var(--forest);
		font-size: 0.72rem;
		font-weight: 800;
		border: 2px solid rgba(224, 178, 76, 0.5);
	}

	/* How */
	.how {
		background: var(--bg);
	}
	.steps {
		margin-top: 3.5rem;
		display: grid;
		gap: 1rem;
	}
	@media (min-width: 560px) {
		.steps {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (min-width: 1000px) {
		.steps {
			grid-template-columns: repeat(4, 1fr);
		}
	}
	.step {
		padding: 1.6rem;
		transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
	}
	.step:hover {
		transform: translateY(-3px);
		border-color: var(--gold);
		box-shadow: 0 18px 40px -20px rgba(18, 53, 40, 0.25);
	}
	.step-n {
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		color: var(--gold);
	}
	.step h3 {
		margin: 1rem 0 0;
		font-size: 1.2rem;
		color: var(--ink);
	}
	.step p {
		margin-top: 0.7rem;
		font-size: 0.9rem;
	}

	/* Features bento */
	.features {
		background: var(--bg-2);
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.bento {
		margin-top: 3.5rem;
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(6, 1fr);
	}
	.b {
		border-radius: 22px;
		padding: 1.6rem;
		grid-column: span 6;
	}
	.b-ico {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 14px;
		background: rgba(224, 178, 76, 0.14);
		color: var(--gold);
		border: 1px solid rgba(224, 178, 76, 0.28);
	}
	.b-hero .b-ico {
		width: 54px;
		height: 54px;
		background: rgba(224, 178, 76, 0.16);
	}
	.b-ico-ink {
		background: rgba(35, 24, 10, 0.14);
		color: var(--gold-ink);
		border-color: rgba(35, 24, 10, 0.28);
	}
	.b h3 {
		margin: 1rem 0 0;
		font-size: 1.15rem;
	}
	.b p {
		margin: 0.6rem 0 0;
		font-size: 0.9rem;
		line-height: 1.55;
	}
	.b-card {
		background: var(--card);
		border: 1px solid var(--line);
		color: var(--ink);
	}
	.b-card p {
		color: var(--muted);
	}
	.b-hero {
		background: var(--forest);
		color: var(--cream);
	}
	.b-hero h3 {
		font-size: 1.6rem;
	}
	.b-hero p {
		color: rgba(247, 242, 232, 0.7);
		max-width: 30rem;
		font-size: 0.98rem;
	}
	.b-gold {
		background: var(--gold);
		color: var(--gold-ink);
	}
	.b-gold h3 {
		font-size: 1.5rem;
	}
	.b-gold p {
		color: rgba(35, 24, 10, 0.8);
	}
	.b-chat {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.bc {
		max-width: 22rem;
		border-radius: 16px;
		padding: 0.6rem 0.9rem;
		font-size: 0.85rem;
		line-height: 1.4;
	}
	.bc.user {
		align-self: flex-end;
		background: var(--gold);
		color: var(--gold-ink);
		border-top-right-radius: 4px;
	}
	.bc.ai {
		background: rgba(247, 242, 232, 0.12);
		color: rgba(247, 242, 232, 0.92);
		border-top-left-radius: 4px;
	}
	@media (min-width: 800px) {
		.b-hero {
			grid-column: span 4;
			grid-row: span 2;
		}
		.b-card {
			grid-column: span 2;
		}
		.b-gold {
			grid-column: span 3;
		}
		.b-wide {
			grid-column: span 3;
		}
	}

	/* AI team (light) */
	.roles {
		margin-top: 3rem;
		display: grid;
		gap: 1rem;
		grid-template-columns: 1fr;
	}
	@media (min-width: 800px) {
		.roles {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.role {
		padding: 1.8rem;
		transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
	}
	.role:hover {
		transform: translateY(-3px);
		border-color: rgba(224, 178, 76, 0.5);
		box-shadow: 0 14px 34px -16px rgba(18, 53, 40, 0.28);
	}
	.role-ico {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 14px;
		background: rgba(224, 178, 76, 0.14);
		color: var(--gold);
		border: 1px solid rgba(224, 178, 76, 0.28);
	}
	.role h3 {
		margin: 1.1rem 0 0.5rem;
		font-size: 1.25rem;
		color: var(--ink);
	}
	.role p {
		margin: 0;
		color: var(--muted);
		line-height: 1.6;
	}

	/* Built for operators (dark) */
	.built {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		background: var(--forest);
		color: var(--cream);
	}
	.built h2 {
		color: var(--cream);
	}
	.built-bg {
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			radial-gradient(60% 80% at 100% 50%, rgba(224, 178, 76, 0.22), transparent 55%),
			linear-gradient(90deg, var(--forest-2), var(--forest) 45%, rgba(16, 54, 42, 0.4));
	}
	.built-list {
		margin: 2.2rem 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.7rem;
		max-width: 44ch;
	}
	@media (min-width: 560px) {
		.built-list {
			grid-template-columns: 1fr 1fr;
		}
	}
	.built-list li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		border: 1px solid rgba(247, 242, 232, 0.1);
		background: rgba(247, 242, 232, 0.05);
		border-radius: 10px;
		padding: 0.8rem 1rem;
		font-size: 0.9rem;
	}
	/* Phone product shot — sits flush on the section's bottom edge so the hand
	   reads as rising up from below, cut cleanly at the forest → next-section line. */
	.built {
		padding-bottom: 0;
	}
	.built-in {
		display: grid;
		gap: 2.5rem;
	}
	.built-copy {
		padding-bottom: 4rem;
	}
	.built-art {
		display: flex;
		justify-content: center;
		align-items: flex-end;
	}
	.built-art img {
		display: block;
		width: 100%;
		max-width: 280px;
		height: auto;
		margin-bottom: -1px;
		filter: drop-shadow(0 22px 42px rgba(0, 0, 0, 0.5));
	}
	@media (min-width: 960px) {
		.built-in {
			grid-template-columns: 1.12fr 0.88fr;
			gap: 3rem;
			align-items: end;
		}
		.built-copy {
			padding-bottom: 8rem;
		}
		.built-art img {
			max-width: 400px;
		}
	}
	.tick {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		color: var(--gold);
	}

	/* No website */
	.nowebsite {
		background: var(--bg);
	}
	.center {
		text-align: center;
	}
	.center .head-narrow,
	.center h2 {
		margin-left: auto;
		margin-right: auto;
	}
	.chips {
		margin-top: 2.5rem;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.7rem;
	}
	.chip {
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--ink);
		border-radius: 999px;
		padding: 0.55rem 1.25rem;
		font-size: 0.9rem;
		font-weight: 550;
	}

	/* Love */
	.love {
		background: var(--bg-2);
		border-top: 1px solid var(--line);
	}
	.reasons {
		margin-top: 3rem;
		display: grid;
		gap: 0.8rem;
		grid-template-columns: 1fr;
	}
	@media (min-width: 560px) {
		.reasons {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (min-width: 1000px) {
		.reasons {
			grid-template-columns: repeat(5, 1fr);
		}
	}
	.reason {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 1.1rem;
		font-size: 0.88rem;
		font-weight: 550;
		color: var(--ink);
		display: flex;
		gap: 0.5rem;
	}

	/* Pricing */
	.pricing {
		background: var(--bg);
	}
	.plans {
		margin-top: 3.5rem;
		display: grid;
		gap: 1.2rem;
		grid-template-columns: 1fr;
	}
	@media (min-width: 640px) {
		.plans {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (min-width: 1000px) {
		.plans {
			grid-template-columns: repeat(4, 1fr);
		}
	}
	.plan {
		position: relative;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--ink);
		border-radius: 24px;
		padding: 1.6rem;
	}
	.plan.hot {
		background: var(--forest);
		color: var(--cream);
		border-color: var(--gold);
		box-shadow: 0 24px 50px -22px rgba(16, 54, 42, 0.5);
	}
	.plan-pop {
		position: absolute;
		/* Straddle the top edge, centred — clears the conversation tag beneath it
		   instead of overlapping the top-right corner. */
		top: -0.75rem;
		left: 50%;
		transform: translateX(-50%);
		background: var(--gold);
		color: var(--gold-ink);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		white-space: nowrap;
		padding: 0.32rem 0.8rem;
		border-radius: 999px;
		box-shadow: 0 6px 16px -6px rgba(18, 53, 40, 0.45);
	}
	.plan-tag {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--forest-mid);
	}
	.plan.hot .plan-tag {
		color: var(--gold);
	}
	.plan-name {
		margin-top: 0.5rem;
		font-size: 1.4rem;
		font-weight: 640;
	}
	.plan-price {
		margin-top: 1rem;
		font-size: 1.85rem;
		font-weight: 680;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}
	.plan-price span {
		font-size: 1rem;
		font-weight: 400;
		color: var(--muted);
	}
	.plan.hot .plan-price span {
		color: rgba(247, 242, 232, 0.6);
	}
	.plan ul {
		margin: 1.5rem 0;
		padding: 0;
		list-style: none;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.plan.hot ul {
		color: rgba(247, 242, 232, 0.85);
	}
	.plan li {
		display: flex;
		gap: 0.5rem;
	}

	/* FAQ */
	.faq {
		background: var(--bg-2);
		border-top: 1px solid var(--line);
	}
	.faq-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.faq-list details {
		padding: 1.4rem 1.6rem;
	}
	.faq-list summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		cursor: pointer;
		list-style: none;
		font-size: 1.1rem;
		font-weight: 620;
		color: var(--ink);
	}
	.faq-list summary::-webkit-details-marker {
		display: none;
	}
	.faq-list .plus {
		color: var(--gold);
		font-size: 1.3rem;
		transition: transform 0.2s;
	}
	.faq-list details[open] .plus {
		transform: rotate(45deg);
	}
	.faq-list p {
		margin: 1rem 0 0;
		font-size: 0.98rem;
	}

	/* Final CTA */
	.final {
		background: var(--forest);
		color: var(--cream);
	}
	.final h2 {
		color: var(--cream);
		margin: 0 auto;
		max-width: 20ch;
	}
	.final .cream-muted {
		margin-left: auto;
		margin-right: auto;
		max-width: 46ch;
	}
	.fineprint-cta {
		margin-top: 1.5rem;
		font-size: 0.85rem;
		color: rgba(247, 242, 232, 0.5);
	}

	/* Footer */
	.foot {
		background: var(--forest-2);
		border-top: 1px solid rgba(247, 242, 232, 0.1);
		color: rgba(247, 242, 232, 0.6);
	}
	.foot-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2.5rem;
		padding-top: 3.5rem;
		padding-bottom: 2.5rem;
	}
	@media (min-width: 560px) {
		.foot-grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (min-width: 900px) {
		.foot-grid {
			grid-template-columns: 1.7fr 1fr 1fr 1.2fr;
			gap: 3rem;
		}
	}
	.foot-brand {
		max-width: 24rem;
	}
	.foot .brand {
		color: var(--cream);
		font-size: 1.05rem;
	}
	.foot-name {
		font-weight: 680;
		color: var(--cream);
	}
	.foot-tag {
		margin: 0.9rem 0 0;
		font-size: 0.85rem;
		line-height: 1.6;
		color: rgba(247, 242, 232, 0.55);
	}
	.foot-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 1.2rem;
		border: 1px solid rgba(247, 242, 232, 0.18);
		border-radius: 999px;
		padding: 0.55rem 0.95rem;
		font-size: 0.82rem;
		font-weight: 550;
		color: var(--cream);
		transition: border-color 0.15s, background 0.15s;
	}
	.foot-chip:hover {
		border-color: var(--gold);
		background: rgba(224, 178, 76, 0.1);
	}
	.foot-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.foot-h {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--gold);
		margin-bottom: 0.25rem;
	}
	.foot-col a,
	.foot-contact {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.88rem;
		color: rgba(247, 242, 232, 0.68);
		transition: color 0.15s;
	}
	.foot-col a:hover {
		color: var(--cream);
	}
	.foot-contact :global(svg) {
		color: var(--gold);
		flex: none;
	}
	.foot-bar {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		align-items: flex-start;
		padding-top: 1.5rem;
		padding-bottom: 2.5rem;
		border-top: 1px solid rgba(247, 242, 232, 0.08);
		font-size: 0.82rem;
	}
	@media (min-width: 560px) {
		.foot-bar {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}
	.foot-copy {
		color: rgba(247, 242, 232, 0.5);
	}
	.foot-copy a {
		color: var(--gold);
	}
	.foot-top {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: rgba(247, 242, 232, 0.68);
		transition: color 0.15s;
	}
	.foot-top:hover {
		color: var(--gold);
	}

	@media (prefers-reduced-motion: reduce) {
		.landing :global(*) {
			transition-duration: 0.001ms !important;
		}
	}
</style>
