<script>
	// Public marketing landing page. Self-contained light/forest/gold theme so it
	// doesn't inherit the dark admin app.css. All CTAs lead to /login or /onboarding.
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import Icon from '$lib/Icon.svelte';

	const LOGIN = '/login';
	const ONBOARD = '/onboarding';

	// Dogfood the product: embed our own AI assistant on the marketing site.
	onMount(() => {
		const slug = env.PUBLIC_SITE_ASSISTANT_SLUG;
		if (!slug) return;
		const s = document.createElement('script');
		s.src = '/widget.js';
		s.async = true;
		s.setAttribute('data-client', slug);
		document.body.appendChild(s);
	});

	const navLinks = [
		{ label: 'Features', href: '#features' },
		{ label: 'How it works', href: '#how' },
		{ label: 'Pricing', href: '#pricing' },
		{ label: 'FAQ', href: '#faq' }
	];

	// Hero chat mockup — one example that reads for a customer OR a citizen.
	const chat = [
		{ from: 'user', text: 'Hi! What do I need to get started, and is it available right now?' },
		{ from: 'ai', text: "Great question — here's what you'll need, and yes, it's available. I just checked the latest status for you… it's live. Want me to walk you through the next step?" },
		{ from: 'user', text: 'Yes please. Can someone help me finish it?' },
		{ from: 'ai', text: "Of course — I'll connect you to the team on WhatsApp with everything we've covered, so you don't repeat a thing." }
	];
	const heroStats = [
		{ n: '24/7', l: 'Always answering' },
		{ n: '<10 min', l: 'To go live' },
		{ n: 'EN + SW', l: 'and more languages' }
	];

	const capabilities = [
		{ icon: 'sparkles', title: 'Instant answers, 24/7', desc: 'Answers every question the moment it’s asked — from your own verified information — around the clock, so no enquiry goes cold.' },
		{ icon: 'bot', title: 'A whole AI team', desc: 'One brief and you get an AI assistant, an AI analyst and an AI researcher — each doing a job you’d otherwise hire for.' },
		{ icon: 'refresh', title: 'Live data & lookups', desc: 'Connect your live systems and official data sources; the assistant answers from current data, not a stale FAQ.' },
		{ icon: 'file-text', title: 'Conversation to document', desc: 'Turn a ready-to-proceed chat into a branded quotation or proposal, priced from your catalogue and accepted in one tap.' },
		{ icon: 'message-circle', title: 'Meets people where they are', desc: 'WhatsApp, Instagram, Facebook, Google Business, a QR code or your site — one engine, every channel your people use.' },
		{ icon: 'languages', title: 'Speaks their language', desc: 'Replies in each person’s own language — including Swahili & English — and reads photos & PDFs they send.' },
		{ icon: 'phone', title: 'Human handoff with context', desc: 'Anyone who needs a person goes straight to your team, carrying the full conversation — no repeating, no lost context.' },
		{ icon: 'book-open', title: 'Answers only from your info', desc: 'Your verified knowledge and connected systems — never random internet content. Accurate every time.' },
		{ icon: 'play', title: 'Live in under 10 minutes', desc: 'No code and no website needed. Paste your content, connect a channel, and go live the same day.' }
	];

	const roles = [
		{ icon: 'bot', title: 'Your AI assistant', desc: 'Answers everyone in seconds from your own information, looks things up in your live systems, recommends the right option and hands anyone who needs a person to your team — day and night.' },
		{ icon: 'bar-chart', title: 'Your AI analyst', desc: 'Ask it anything about your operation and it answers from your real numbers — demand, conversion, where enquiries stall — and flags the gaps quietly costing you.' },
		{ icon: 'search', title: 'Your AI researcher', desc: 'Point it at a question people keep asking; it researches, drafts a knowledge entry for you to approve, and keeps your published information in sync.' }
	];

	const contactList = ['Replies in Swahili, English and more', 'Handles many conversations at once', 'Escalates complex cases to your team with full context'];
	const cityMsgs = [
		{ city: 'Dodoma', msg: 'Je, nahitaji nini kuanza?' },
		{ city: 'Arusha', msg: 'What documents do I need?' },
		{ city: 'Mwanza', msg: 'How do I apply online?' }
	];

	const steps = [
		{ n: '01', t: 'Create your AI assistant', d: 'Set it up in minutes — no code, no technical skills.' },
		{ n: '02', t: 'Add your knowledge', d: 'Import from CSV, JSON, PDF or your website — and connect live data sources. The AI organises everything.' },
		{ n: '03', t: 'Share it anywhere', d: 'WhatsApp, Instagram, Facebook, Google Business, a QR code, or your own site.' },
		{ n: '04', t: 'Let it handle the rest', d: 'It answers every enquiry, looks up what’s needed, and routes people to the right outcome — day and night.' }
	];

	const reasons = [
		'Setup in under 10 minutes',
		'No coding required',
		'No website required',
		'Works on any device',
		'Answers only from your verified information',
		'Adapts to your sector',
		'Serves customers & citizens alike',
		'Connects to your live systems',
		'Captures qualified leads',
		'Saves hours every week'
	];

	const channels = [
		{ name: 'WhatsApp', brand: 'whatsapp' },
		{ name: 'Instagram', brand: 'instagram' },
		{ name: 'Facebook', brand: 'facebook' },
		{ name: 'Google Business', brand: 'google' },
		{ name: 'Your website', brand: 'globe' },
		{ name: 'QR Codes', brand: 'qr' }
	];

	// Live pricing from the plans catalogue (see +page.server.js).
	export let data;
	const nf = new Intl.NumberFormat('en-US');
	const cpc = data.costPerConversation || 0.004;
	const planConversations = (p) => {
		const budget = Number(p.included_ai_budget) || 0;
		return budget > 0 ? Math.round(budget / cpc) : Number(p.monthly_conversation_cap) || 0;
	};
	$: plans = (data.plans ?? []).map((p, i, arr) => {
		const amount = Number(p.price_amount) || 0;
		return {
			name: p.name,
			price: amount === 0 ? 'Free' : `${p.price_currency} ${nf.format(amount)}`,
			paid: amount > 0,
			tag: `≈ ${nf.format(planConversations(p))} conversations / mo`,
			features: p.features ?? [],
			highlight: arr.length > 1 && i === Math.floor(arr.length / 2)
		};
	});

	const faqs = [
		{ q: 'Is this just a chatbot?', a: 'No. It answers from your own verified information — and can look things up in your live systems in real time. Alongside the public-facing assistant you get an AI analyst that answers questions from your real data, an AI researcher that drafts new knowledge for you to approve, automatic website sync, and a scored pipeline of everyone who reaches out.' },
		{ q: 'Who is it for?', a: 'Any organisation that answers questions all day — businesses turning enquiries into sales, and public institutions serving citizens. The same assistant adapts to your sector, your language and your information.' },
		{ q: 'Can it look up live, real-time information?', a: 'Yes. Beyond your uploaded knowledge, Makutano AI can connect to live data sources and official systems and answer from current data — so people get accurate, up-to-the-minute answers instead of a stale FAQ.' },
		{ q: 'Does the AI use only my own information?', a: 'Yes. It answers from your verified knowledge and connected systems — never random internet content — so every price, rule, date and detail is accurate.' },
		{ q: 'Do I need a website?', a: 'No. Makutano AI creates a hosted AI page automatically — just share the link or QR code. If you do have a website, it can scan and import your content for you.' },
		{ q: 'Can people still reach a human?', a: 'Yes. The assistant hands anyone who needs a person straight to your WhatsApp or your team, carrying the full conversation so they pick up right where it left off.' },
		{ q: 'Can it create quotations, proposals or documents?', a: 'Yes. When someone is ready to proceed, Makutano AI drafts a full quotation or proposal from the conversation — priced from your real catalogue — which you review in a click. They open a premium branded page and accept in one tap.' },
		{ q: 'What languages does it speak?', a: 'It replies in each person’s own language automatically, and can read photos and PDFs they send.' },
		{ q: 'How long does setup take?', a: 'Most organisations are live in under 10 minutes.' }
	];
	let open = -1;

	// ---- SEO / social share ----
	const SITE = 'Makutano AI';
	const SEO_TITLE = 'Makutano AI — The AI Assistant for Every Organization';
	const SEO_DESC =
		'An AI assistant your customers and citizens can actually talk to. It answers every question instantly from your own knowledge, looks things up in your live systems, and guides people to the right next step — 24/7, in their language. Businesses turn enquiries into sales; public institutions serve citizens. No website needed.';
	$: seoOrigin = data.origin ?? 'https://ai.makutano.co.tz';
	$: canonicalUrl = `${seoOrigin}/`;
	$: ogImage = `${seoOrigin}/og-image.png`;
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
			offers: (data.plans ?? []).map((p) => ({ '@type': 'Offer', name: p.name, price: String(Number(p.price_amount) || 0), priceCurrency: p.price_currency || 'USD' })),
			publisher: { '@type': 'Organization', name: SITE, url: canonicalUrl, logo: `${seoOrigin}/ICON-AI.png` }
		},
		{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
	]);
</script>

<svelte:head>
	<title>{SEO_TITLE}</title>
	<meta name="description" content={SEO_DESC} />
	<link rel="canonical" href={canonicalUrl} />
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<meta name="theme-color" content="#10362a" />
	<meta name="author" content={SITE} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE} />
	<meta property="og:title" content={SEO_TITLE} />
	<meta property="og:description" content={SEO_DESC} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="Makutano AI — the AI assistant for every organization" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={SEO_TITLE} />
	<meta name="twitter:description" content={SEO_DESC} />
	<meta name="twitter:image" content={ogImage} />
	{@html `<script type="application/ld+json">${jsonLd}<\/script>`}
</svelte:head>

<div class="lp">
	<!-- NAV -->
	<header class="nav">
		<div class="container nav-in">
			<a class="brand" href="#top"><img class="brand-logo" src="/ICON-AI.png" alt="" width="32" height="32" /><span class="brand-name">Makutano&nbsp;AI</span></a>
			<nav class="navlinks">
				{#each navLinks as l}<a href={l.href}>{l.label}</a>{/each}
			</nav>
			<div class="nav-actions">
				<a class="signin" href={LOGIN}>Sign in</a>
				<a class="btn btn-green" href={ONBOARD}>Get Started Free</a>
			</div>
		</div>
	</header>

	<!-- HERO -->
	<section id="top" class="hero">
		<div class="hero-grid"></div>
		<div class="hero-glow"></div>
		<div class="container hero-in">
			<div class="hero-copy">
				<span class="badge"><span class="dot"></span> For businesses &amp; public institutions</span>
				<h1>The AI that speaks <span class="accent">for your organization.</span></h1>
				<p class="hero-sub">
					An assistant your customers and citizens can actually talk to — it answers every question the moment it's
					asked, looks things up in your live systems, and guides people to the right next step. 24/7, in their
					language.
				</p>
				<div class="hero-cta">
					<a class="btn btn-gold lg" href={ONBOARD}>Start free — no card needed</a>
					<a class="btn btn-outline-l lg" href="#how">See how it works →</a>
				</div>
				<div class="hero-stats">
					{#each heroStats as s}<div class="stat"><div class="stat-n">{s.n}</div><div class="stat-l">{s.l}</div></div>{/each}
				</div>
			</div>

			<div class="hero-art">
				<div class="chat">
					<span class="chat-shine"></span>
					<div class="chat-head">
						<span class="dots"><i class="r"></i><i class="y"></i><i class="g"></i></span>
						<span class="chat-brand"><span class="chat-m">M</span> Makutano AI · WhatsApp</span>
						<span class="chat-live"><i></i>Active</span>
					</div>
					<div class="chat-body">
						{#each chat as m}
							<div class="row {m.from}">
								{#if m.from === 'ai'}<span class="av">M</span>{/if}
								<div class="msg {m.from}">{m.text}</div>
							</div>
						{/each}
						<div class="row ai">
							<span class="av">M</span>
							<div class="msg ai typing"><i></i><i></i><i></i></div>
						</div>
					</div>
					<div class="chat-input"><span>Type a message…</span><span class="send"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M22 2 11 13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /><path d="M22 2 15 22 11 13 2 9 22 2Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg></span></div>
				</div>
				<div class="fcard fcard-a"><span class="fc-ico"><Icon name="sparkles" size={20} /></span><div><b>Instant</b><span>Replies</span></div></div>
				<div class="fcard fcard-b"><span class="fc-ico"><Icon name="globe" size={20} /></span><div><b>Swahili &amp; English</b><span>Every visitor</span></div></div>
			</div>
		</div>
	</section>

	<!-- PROBLEM -->
	<section class="section center narrow-sec">
		<p class="eyebrow">Why Makutano AI</p>
		<h2 class="h2">People don't wait. When no one answers, they give up — or ask again, and again.</h2>
		<p class="lead-muted">
			Every unanswered question is a missed opportunity — or a frustrated citizen. Makutano AI makes sure every question
			gets a clear, accurate answer the moment it's asked — without hiring a single extra person.
		</p>
	</section>

	<!-- CAPABILITIES -->
	<section id="features" class="section alt">
		<div class="container">
			<div class="sec-head">
				<p class="eyebrow">Everything you need</p>
				<h2 class="h2">A complete AI engine, tuned to your organization.</h2>
			</div>
			<div class="cap-grid">
				{#each capabilities as c}
					<div class="cap-card">
						<div class="cap-ico"><Icon name={c.icon} size={24} /></div>
						<h3>{c.title}</h3>
						<p>{c.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- AI TEAM -->
	<section class="section">
		<div class="container">
			<div class="sec-head">
				<p class="eyebrow">More than a chatbot</p>
				<h2 class="h2">One subscription. A whole AI team working for your organization.</h2>
			</div>
			<div class="role-grid">
				{#each roles as r}
					<div class="role-card">
						<div class="role-ico"><Icon name={r.icon} size={26} /></div>
						<h3>{r.title}</h3>
						<p>{r.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- CALLOUT 1 -->
	<section class="section alt">
		<div class="container callout">
			<div class="callout-copy">
				<p class="eyebrow">First point of contact</p>
				<h2 class="h2 sm">The first point of contact for everyone who reaches out.</h2>
				<p class="lead-muted">Whether someone messages at 2am or during your busiest hour, Makutano AI greets them, understands the need, and delivers the right answer immediately — in your voice, in their language.</p>
				<ul class="clist">
					{#each contactList as c}<li><span class="tick"><Icon name="check" size={12} stroke={3} /></span>{c}</li>{/each}
				</ul>
			</div>
			<div class="callout-visual city-wrap">
				{#each cityMsgs as m}
					<div class="city-row">
						<span class="city-av">{m.city[0]}</span>
						<div class="city-txt"><span class="city-name">{m.city}</span><span class="city-msg">{m.msg}</span></div>
						<span class="city-live"><i></i></span>
					</div>
				{/each}
				<div class="city-more">Handling many conversations at once</div>
			</div>
		</div>
	</section>

	<!-- HOW IT WORKS -->
	<section id="how" class="section">
		<div class="container">
			<div class="sec-head">
				<p class="eyebrow">Setup process</p>
				<h2 class="h2">Live in under 10 minutes. Four simple steps.</h2>
			</div>
			<div class="steps">
				{#each steps as s}
					<div class="step">
						<div class="step-n">{s.n}</div>
						<h3>{s.t}</h3>
						<p>{s.d}</p>
					</div>
				{/each}
			</div>
			<div class="center" style="margin-top:2.5rem">
				<a class="btn btn-green lg" href={ONBOARD}>Get started — it's free</a>
			</div>
		</div>
	</section>

	<!-- CALLOUT 2 -->
	<section class="section alt">
		<div class="container callout rev">
			<div class="callout-visual doc">
				<div class="doc-head"><span class="doc-dot"></span> Document generated</div>
				<div class="doc-body">
					<span class="ln w75"></span><span class="ln w100"></span><span class="ln w83"></span><span class="ln w66"></span>
					<span class="ln w50 gap"></span><span class="ln w100"></span><span class="ln w75"></span>
					<div class="doc-btns"><span class="doc-b green"></span><span class="doc-b"></span></div>
				</div>
			</div>
			<div class="callout-copy">
				<p class="eyebrow">Documents &amp; proposals</p>
				<h2 class="h2 sm">From a conversation to a finished document — automatically.</h2>
				<p class="lead-muted">When someone's ready to proceed, Makutano AI turns the whole conversation into a polished, branded quotation or proposal — priced from your real catalogue. Review it in a click; they open a beautiful page and accept in a single tap.</p>
				<p class="lead-muted">No copy-pasting transcripts, no manual data entry — your team focuses on decisions, not admin.</p>
				<a class="btn btn-green" href={ONBOARD} style="margin-top:.4rem">Start sending AI quotes</a>
			</div>
		</div>
	</section>

	<!-- TRUST REASONS -->
	<section class="section dark">
		<div class="container">
			<div class="sec-head">
				<p class="eyebrow light">Why organizations choose us</p>
				<h2 class="h2 white">Ten reasons organizations choose Makutano AI.</h2>
			</div>
			<div class="reasons">
				{#each reasons as r, i}
					<div class="reason"><span class="reason-n">{String(i + 1).padStart(2, '0')}</span><p>{r}</p></div>
				{/each}
			</div>
		</div>
	</section>

	<!-- INTEGRATIONS -->
	<section class="section center">
		<div class="container">
			<p class="eyebrow">No website? No problem.</p>
			<h2 class="h2">Wherever your people already are, Makutano AI meets them.</h2>
			<p class="lead-muted center-lead">Makutano AI meets your customers and citizens on the platforms they use every day — not the ones they don't.</p>
			<div class="chips">
				{#each channels as c}
					<span class="chip">
						<span class="chip-ico">
							{#if c.brand === 'whatsapp'}
								<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
							{:else if c.brand === 'instagram'}
								<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#E4405F" d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793 0 1.44.645 1.44 1.439z"/></svg>
							{:else if c.brand === 'facebook'}
								<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
							{:else if c.brand === 'google'}
								<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
							{:else}
								<Icon name={c.brand} size={17} />
							{/if}
						</span>
						{c.name}
					</span>
				{/each}
			</div>
		</div>
	</section>

	<!-- PRICING -->
	<section id="pricing" class="section alt">
		<div class="container">
			<div class="sec-head">
				<p class="eyebrow">Pricing</p>
				<h2 class="h2">Simple plans that scale with your organization.</h2>
				<p class="lead-muted center-lead">Start free, upgrade anytime. No hidden fees.</p>
			</div>
			<div class="plans">
				{#each plans as p}
					<div class="plan" class:hot={p.highlight}>
						{#if p.highlight}<div class="plan-pop">Most popular</div>{/if}
						<div class="plan-tag">{p.tag}</div>
						<div class="plan-name">{p.name}</div>
						<div class="plan-price">{p.price}{#if p.paid}<span>/mo</span>{/if}</div>
						<ul>
							{#each p.features as f}<li><span class="tick"><Icon name="check" size={12} stroke={3} /></span>{f}</li>{/each}
						</ul>
						<a class="btn full {p.highlight ? 'btn-green' : 'btn-outline'}" href={ONBOARD}>Get started</a>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- FAQ -->
	<section id="faq" class="section">
		<div class="container narrow">
			<div class="sec-head">
				<p class="eyebrow">FAQ</p>
				<h2 class="h2">Questions, answered.</h2>
			</div>
			<div class="faq-card">
				{#each faqs as f, i}
					<div class="faq-item">
						<button class="faq-q" on:click={() => (open = open === i ? -1 : i)} aria-expanded={open === i}>
							<span>{f.q}</span>
							<span class="faq-plus" class:on={open === i}>+</span>
						</button>
						{#if open === i}<div class="faq-a">{f.a}</div>{/if}
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- CTA -->
	<section class="cta">
		<div class="cta-dots"></div>
		<div class="container cta-in">
			<h2>Never leave a question <span class="accent">unanswered.</span></h2>
			<p>Be there for every customer and citizen — instantly, accurately, 24 hours a day, on every channel they already use. Let Makutano AI be the assistant that never clocks off.</p>
			<div class="cta-btns">
				<a class="btn btn-gold lg" href={ONBOARD}>Start free today →</a>
				<a class="btn btn-outline-l lg" href="https://wa.me/255752093014" target="_blank" rel="noopener noreferrer">Talk to our team</a>
			</div>
		</div>
	</section>

	<!-- FOOTER -->
	<footer class="foot">
		<div class="container foot-in">
			<div class="foot-brand">
				<a class="brand" href="#top"><img class="brand-logo" src="/ICON-AI.png" alt="" width="32" height="32" /><span class="brand-name">Makutano&nbsp;AI</span></a>
				<p>The AI assistant for businesses and public institutions — answer every customer and citizen instantly from your own information, 24/7.</p>
				<a class="foot-mail" href="mailto:pastory@makutano.co.tz">pastory@makutano.co.tz</a>
			</div>
			<nav class="foot-links">
				<a href="#features">Features</a>
				<a href="#pricing">Pricing</a>
				<a href="#faq">FAQ</a>
				<a href={ONBOARD}>Get started</a>
				<a href={LOGIN}>Sign in</a>
				<a href="/privacy-policy">Privacy Policy</a>
				<a href="https://wa.me/255752093014" target="_blank" rel="noopener noreferrer">WhatsApp</a>
			</nav>
			<p class="foot-copy">© {new Date().getFullYear()} Makutano&nbsp;AI. All rights reserved.</p>
		</div>
	</footer>
</div>

<style>
	.lp {
		/* Brand palette — warm forest + gold + cream (matches app theme). */
		--forest: #10362a;
		--forest2: #2c6b52; /* mid forest for dark-section gradients */
		--ink: #0c2c22; /* darkest forest — gradient ends, faq active */
		--gold: #e0b24c;
		--gold-soft: #ecca7d;
		--green: #2f7a5a; /* subtle forest-green accent (doc "generated" dot) */
		--green-l: #ecca7d; /* warm accent for badge text + hover borders */
		--mint: #f4ecd6; /* warm gold-tint chip background */
		--cream: #faf5ea;
		--bg2: #faf7f0; /* warm cream section background */
		--text: #123528;
		--muted: #6b7c72;
		--border: #e7ded0;
		background: #fff;
		color: var(--text);
		font-family: 'Lexend Deca', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
		/* clip (not hidden) so horizontal overflow is contained WITHOUT creating a
		   scroll container — hidden here would break the sticky nav below. */
		overflow-x: clip;
	}
	.lp :global(*) { box-sizing: border-box; }
	.container { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
	.narrow { max-width: 780px; }
	.center { text-align: center; }

	/* Buttons */
	.btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; font-weight: 600; font-size: 0.9rem; padding: 0.7rem 1.25rem; border-radius: 12px; text-decoration: none; cursor: pointer; border: 1px solid transparent; transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease, background 0.15s ease; white-space: nowrap; }
	.btn:hover { transform: translateY(-1px); }
	.btn.lg { padding: 0.95rem 1.6rem; font-size: 0.95rem; }
	.btn.full { width: 100%; }
	.btn-green { background: linear-gradient(135deg, var(--forest), var(--ink)); color: #fff; box-shadow: 0 6px 18px -8px rgba(11, 37, 24, 0.6); }
	.btn-gold { background: var(--gold); color: var(--ink); box-shadow: 0 8px 22px -10px rgba(201, 153, 26, 0.7); }
	.btn-gold:hover { filter: brightness(1.05); }
	.btn-outline { background: #fff; color: var(--forest); border-color: var(--border); }
	.btn-outline:hover { border-color: var(--gold-soft); background: var(--cream); }
	.btn-outline-l { background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.9); border-color: rgba(255, 255, 255, 0.25); }
	.btn-outline-l:hover { background: rgba(255, 255, 255, 0.12); }

	/* Nav */
	.nav { position: sticky; top: 0; z-index: 50; background: rgba(255, 255, 255, 0.9); backdrop-filter: saturate(150%) blur(12px); border-bottom: 1px solid var(--border); }
	.nav-in { height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
	.brand { display: inline-flex; align-items: center; gap: 0.55rem; text-decoration: none; }
	.brand-logo { width: 32px; height: 32px; border-radius: 8px; display: block; object-fit: contain; }
	.brand-name { font-weight: 800; color: var(--ink); font-size: 1.05rem; }
	.navlinks { display: flex; gap: 1.75rem; }
	.navlinks a { color: var(--muted); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.15s; }
	.navlinks a:hover { color: var(--text); }
	.nav-actions { display: flex; align-items: center; gap: 0.85rem; }
	.signin { color: var(--muted); text-decoration: none; font-size: 0.9rem; font-weight: 500; }
	.signin:hover { color: var(--text); }

	/* Hero */
	.hero { position: relative; overflow: hidden; background: linear-gradient(160deg, #10362a 0%, #17493a 58%, #0a231b 100%); }
	.hero-grid { position: absolute; inset: 0; opacity: 0.09; background-image: linear-gradient(rgba(255, 255, 255, 0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.6) 1px, transparent 1px); background-size: 64px 64px; }
	.hero-glow { position: absolute; top: 40%; left: 18%; width: 420px; height: 420px; border-radius: 50%; background: #e0b24c; opacity: 0.14; filter: blur(90px); pointer-events: none; }
	.hero-in { position: relative; display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 4rem; align-items: center; padding: 5.5rem 24px 6rem; }
	.badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.82rem; font-weight: 500; color: var(--green-l); background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16); margin-bottom: 1.6rem; }
	.badge .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 0 0 rgba(224, 178, 76, 0.6); animation: pulse 2s infinite; }
	@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(224, 178, 76, 0.5); } 70% { box-shadow: 0 0 0 7px rgba(224, 178, 76, 0); } 100% { box-shadow: 0 0 0 0 rgba(224, 178, 76, 0); } }
	.hero h1 { color: #fff; font-weight: 800; font-size: clamp(2.4rem, 5vw, 3.7rem); line-height: 1.08; letter-spacing: -0.02em; margin: 0 0 1.25rem; }
	.accent { color: var(--gold); }
	.hero-sub { color: rgba(255, 255, 255, 0.68); font-size: 1.08rem; font-weight: 300; max-width: 500px; margin: 0 0 2rem; }
	.hero-cta { display: flex; flex-wrap: wrap; gap: 0.8rem; margin-bottom: 2.75rem; }
	.hero-stats { display: flex; gap: 2.4rem; }
	.stat-n { color: #fff; font-weight: 800; font-size: 1.5rem; }
	.stat-l { color: rgba(255, 255, 255, 0.5); font-size: 0.78rem; margin-top: 0.15rem; }

	/* Hero chat mockup */
	.hero-art { position: relative; }
	.chat { position: relative; border-radius: 18px; overflow: hidden; background: #0f1f15; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 30px 60px -25px rgba(0, 0, 0, 0.6); }
	.chat-shine { position: absolute; inset: -30px; background: radial-gradient(ellipse at 50% 0%, rgba(224, 178, 76, 0.22), transparent 70%); pointer-events: none; }
	.chat-head { position: relative; display: flex; align-items: center; gap: 0.7rem; padding: 0.85rem 1.1rem; background: #0b2518; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
	.dots { display: flex; gap: 0.35rem; }
	.dots i { width: 10px; height: 10px; border-radius: 50%; }
	.dots .r { background: #ef4444; } .dots .y { background: #eab308; } .dots .g { background: #22c55e; }
	.chat-brand { display: inline-flex; align-items: center; gap: 0.45rem; color: rgba(255, 255, 255, 0.8); font-size: 0.82rem; font-weight: 500; }
	.chat-m { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; background: var(--gold); color: var(--ink); font-weight: 800; font-size: 0.7rem; }
	.chat-live { margin-left: auto; display: inline-flex; align-items: center; gap: 0.35rem; color: #4ade80; font-size: 0.72rem; }
	.chat-live i { width: 7px; height: 7px; border-radius: 50%; background: var(--gold); animation: pulse 2s infinite; }
	.chat-body { position: relative; padding: 1.1rem; display: flex; flex-direction: column; gap: 0.7rem; min-height: 260px; }
	.row { display: flex; gap: 0.5rem; }
	.row.user { justify-content: flex-end; }
	.av { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--gold); color: var(--ink); font-weight: 800; font-size: 0.72rem; flex-shrink: 0; margin-top: 2px; }
	.msg { max-width: 78%; padding: 0.65rem 0.85rem; font-size: 0.82rem; line-height: 1.45; border-radius: 16px; }
	.msg.user { background: var(--gold); color: var(--ink); border-radius: 16px 16px 4px 16px; }
	.msg.ai { background: #1a3a26; color: #e2f4e8; border-radius: 16px 16px 16px 4px; }
	.msg.typing { display: inline-flex; gap: 4px; align-items: center; }
	.msg.typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--gold); animation: bounce 1.2s infinite; }
	.msg.typing i:nth-child(2) { animation-delay: 0.15s; } .msg.typing i:nth-child(3) { animation-delay: 0.3s; }
	@keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }
	.chat-input { display: flex; align-items: center; gap: 0.6rem; padding: 0.85rem 1.1rem; background: #0b2518; border-top: 1px solid rgba(255, 255, 255, 0.08); }
	.chat-input span:first-child { flex: 1; color: rgba(255, 255, 255, 0.3); font-size: 0.82rem; padding: 0.5rem 0.8rem; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; background: #0f1f15; }
	.chat-input .send { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--gold); color: var(--ink); font-size: 0.8rem; }
	.fcard { position: absolute; display: flex; align-items: center; gap: 0.6rem; background: #fff; border-radius: 12px; box-shadow: 0 18px 40px -18px rgba(0, 0, 0, 0.35); padding: 0.6rem 0.85rem; font-size: 1.3rem; }
	.fcard div { display: flex; flex-direction: column; }
	.fcard b { font-size: 0.82rem; color: var(--text); font-weight: 700; }
	.fcard span { font-size: 0.7rem; color: var(--muted); }
	.fc-ico { display: grid; place-items: center; color: var(--forest); }
	.fcard-a { top: 22px; left: -34px; }
	.fcard-b { bottom: 70px; right: -26px; }

	/* Sections */
	.section { padding: 5.5rem 0; }
	.section.alt { background: var(--bg2); }
	.section.center { text-align: center; }
	.narrow-sec { max-width: 820px; margin: 0 auto; padding-left: 24px; padding-right: 24px; }
	.eyebrow { text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.74rem; font-weight: 700; color: var(--forest); margin: 0 0 0.9rem; }
	.eyebrow.light { color: var(--green-l); }
	.h2 { font-weight: 800; font-size: clamp(1.8rem, 3.6vw, 2.6rem); line-height: 1.15; letter-spacing: -0.02em; color: var(--text); margin: 0; }
	.h2.sm { font-size: clamp(1.6rem, 3vw, 2.15rem); }
	.h2.white { color: #fff; }
	.sec-head { text-align: center; max-width: 720px; margin: 0 auto 3rem; }
	.lead-muted { color: var(--muted); font-size: 1.05rem; margin: 1rem 0 0; }
	.center-lead { max-width: 620px; margin-left: auto; margin-right: auto; }

	/* Capabilities */
	.cap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4rem; }
	.cap-card { background: #fff; border: 1px solid var(--border); border-radius: 18px; padding: 1.7rem; transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s; }
	.cap-card:hover { border-color: var(--gold-soft); box-shadow: 0 16px 36px -22px rgba(16, 54, 42, 0.28); transform: translateY(-2px); }
	.cap-ico { width: 48px; height: 48px; border-radius: 13px; display: grid; place-items: center; color: var(--forest); background: var(--mint); margin-bottom: 1.1rem; }
	.cap-card h3 { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.5rem; color: var(--text); }
	.cap-card p { color: var(--muted); font-size: 0.92rem; margin: 0; }

	/* Roles */
	.role-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.6rem; }
	.role-card { background: #fff; border: 1px solid var(--border); border-radius: 18px; padding: 2rem 1.8rem; }
	.role-ico { width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; color: var(--gold); background: linear-gradient(135deg, var(--forest), var(--ink)); margin-bottom: 1.2rem; }
	.role-card h3 { font-size: 1.2rem; font-weight: 700; margin: 0 0 0.6rem; }
	.role-card p { color: var(--muted); font-size: 0.95rem; margin: 0; }

	/* Callout */
	.callout { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }
	.callout-copy .lead-muted { margin-top: 1.1rem; }
	.clist { list-style: none; padding: 0; margin: 1.6rem 0 0; display: flex; flex-direction: column; gap: 0.8rem; }
	.clist li { display: flex; align-items: flex-start; gap: 0.7rem; font-size: 0.95rem; color: var(--text); }
	.tick { width: 20px; height: 20px; border-radius: 50%; background: var(--mint); color: var(--forest); font-size: 0.72rem; font-weight: 800; display: grid; place-items: center; flex-shrink: 0; margin-top: 1px; }
	.city-wrap { background: linear-gradient(135deg, var(--ink), var(--forest2)); border-radius: 20px; padding: 2rem; display: flex; flex-direction: column; gap: 0.9rem; min-height: 320px; justify-content: center; }
	.city-row { display: flex; align-items: center; gap: 0.8rem; background: rgba(255, 255, 255, 0.09); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 13px; padding: 0.8rem 1rem; }
	.city-av { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 0.8rem; background: rgba(224, 178, 76, 0.55); flex-shrink: 0; }
	.city-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
	.city-name { color: rgba(255, 255, 255, 0.5); font-size: 0.72rem; }
	.city-msg { color: #fff; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.city-live i { width: 7px; height: 7px; border-radius: 50%; background: var(--gold); display: block; animation: pulse 2s infinite; }
	.city-more { text-align: center; color: rgba(255, 255, 255, 0.45); font-size: 0.8rem; margin-top: 0.3rem; }

	/* Doc mock */
	.doc { background: #fff; border: 1px solid var(--border); border-radius: 20px; overflow: hidden; min-height: 320px; }
	.doc-head { display: flex; align-items: center; gap: 0.5rem; padding: 1rem 1.3rem; border-bottom: 1px solid var(--border); font-weight: 700; font-size: 0.9rem; }
	.doc-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--green); }
	.doc-body { padding: 1.6rem; display: flex; flex-direction: column; gap: 0.7rem; }
	.ln { height: 12px; border-radius: 6px; background: #eef2f6; }
	.ln.gap { margin-top: 1rem; }
	.w100 { width: 100%; } .w83 { width: 83%; } .w75 { width: 75%; } .w66 { width: 66%; } .w50 { width: 50%; }
	.doc-btns { display: flex; gap: 0.8rem; margin-top: 1.2rem; }
	.doc-b { height: 38px; border-radius: 10px; flex: 1; background: #eef2f6; }
	.doc-b.green { background: var(--mint); }

	/* Steps */
	.steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.6rem; }
	.step-n { width: 66px; height: 66px; border-radius: 18px; display: grid; place-items: center; font-weight: 800; font-size: 1.4rem; color: #fff; background: linear-gradient(135deg, var(--forest), var(--ink)); box-shadow: 0 12px 26px -14px rgba(11, 37, 24, 0.5); margin-bottom: 1.3rem; }
	.step h3 { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.5rem; }
	.step p { color: var(--muted); font-size: 0.92rem; margin: 0; }

	/* Trust reasons (dark) */
	.section.dark { background: linear-gradient(160deg, var(--ink), var(--forest2)); }
	.reasons { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; }
	.reason { display: flex; align-items: flex-start; gap: 0.7rem; padding: 1.1rem; border-radius: 14px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); }
	.reason-n { color: var(--gold); font-weight: 800; font-size: 1.1rem; flex-shrink: 0; }
	.reason p { color: rgba(255, 255, 255, 0.78); font-size: 0.86rem; margin: 0; }

	/* Integrations chips */
	.chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.9rem; margin-top: 2.5rem; }
	.chip { display: inline-flex; align-items: center; gap: 0.55rem; padding: 0.72rem 1.2rem; border-radius: 12px; border: 1px solid var(--border); background: #fff; font-weight: 600; font-size: 0.9rem; color: var(--text); transition: border-color 0.15s, background 0.15s; }
	.chip-ico { display: inline-grid; place-items: center; width: 18px; height: 18px; color: var(--forest); flex-shrink: 0; }
	.chip-ico svg { width: 18px; height: 18px; display: block; }
	.chip:hover { border-color: var(--gold-soft); background: var(--cream); }

	/* Pricing */
	.plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 1.4rem; align-items: start; }
	.plan { position: relative; background: #fff; border: 1px solid var(--border); border-radius: 20px; padding: 2rem 1.7rem; display: flex; flex-direction: column; }
	.plan.hot { border-color: var(--forest); box-shadow: 0 24px 50px -28px rgba(16, 54, 42, 0.4); }
	.plan-pop { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--gold); color: var(--ink); font-size: 0.72rem; font-weight: 700; padding: 0.28rem 0.9rem; border-radius: 999px; }
	.plan-tag { color: var(--muted); font-size: 0.78rem; }
	.plan-name { font-weight: 700; font-size: 1.15rem; margin: 0.3rem 0 0.6rem; }
	.plan-price { font-weight: 800; font-size: 2rem; color: var(--ink); margin-bottom: 1.2rem; }
	.plan-price span { font-size: 0.9rem; font-weight: 500; color: var(--muted); }
	.plan ul { list-style: none; padding: 0; margin: 0 0 1.5rem; display: flex; flex-direction: column; gap: 0.65rem; flex: 1; }
	.plan li { display: flex; align-items: flex-start; gap: 0.55rem; font-size: 0.88rem; color: var(--text); }

	/* FAQ */
	.faq-card { background: #fff; border: 1px solid var(--border); border-radius: 20px; padding: 0.4rem 1.7rem; }
	.faq-item { border-bottom: 1px solid var(--border); }
	.faq-item:last-child { border-bottom: 0; }
	.faq-q { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.3rem 0; background: none; border: 0; cursor: pointer; text-align: left; font-family: inherit; font-weight: 600; font-size: 1rem; color: var(--text); }
	.faq-plus { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--border); display: grid; place-items: center; font-size: 1.2rem; color: var(--muted); flex-shrink: 0; transition: transform 0.2s, background 0.2s, color 0.2s; }
	.faq-plus.on { transform: rotate(45deg); background: var(--ink); color: #fff; border-color: var(--ink); }
	.faq-a { padding: 0 0 1.3rem; color: var(--muted); font-size: 0.92rem; margin-top: -0.3rem; max-width: 90%; }

	/* CTA */
	.cta { position: relative; overflow: hidden; padding: 7rem 0; text-align: center; background: linear-gradient(160deg, #10362a, #17493a); }
	.cta-dots { position: absolute; inset: 0; opacity: 0.12; background-image: radial-gradient(circle, rgba(255, 255, 255, 0.6) 1px, transparent 1px); background-size: 32px 32px; }
	.cta-in { position: relative; }
	.cta h2 { color: #fff; font-weight: 800; font-size: clamp(2.2rem, 5vw, 3.5rem); line-height: 1.1; margin: 0 0 1.2rem; letter-spacing: -0.02em; }
	.cta p { color: rgba(255, 255, 255, 0.62); font-size: 1.1rem; max-width: 540px; margin: 0 auto 2.5rem; }
	.cta-btns { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; }

	/* Footer */
	.foot { background: #fff; border-top: 1px solid var(--border); padding: 3rem 0; }
	.foot-in { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 2rem; }
	.foot-brand { max-width: 340px; }
	.foot-brand p { color: var(--muted); font-size: 0.85rem; margin: 0.8rem 0 0; }
	.foot-mail { display: inline-block; margin-top: 0.7rem; color: var(--forest); font-size: 0.85rem; font-weight: 600; text-decoration: none; }
	.foot-mail:hover { text-decoration: underline; }
	.foot-links { display: flex; flex-wrap: wrap; gap: 1.4rem; }
	.foot-links a { color: var(--muted); text-decoration: none; font-size: 0.88rem; }
	.foot-links a:hover { color: var(--text); }
	.foot-copy { color: var(--muted); font-size: 0.8rem; width: 100%; border-top: 1px solid var(--border); padding-top: 1.4rem; margin-top: 0.6rem; }

	/* Responsive */
	@media (max-width: 900px) {
		.navlinks { display: none; }
		.hero-in { grid-template-columns: 1fr; gap: 3rem; padding-top: 3.5rem; padding-bottom: 4rem; }
		.hero-art { max-width: 420px; }
		.callout { grid-template-columns: 1fr; gap: 2.5rem; }
		.callout.rev .doc { order: 2; }
		.cap-grid, .role-grid { grid-template-columns: repeat(2, 1fr); }
		.steps { grid-template-columns: repeat(2, 1fr); }
		.reasons { grid-template-columns: repeat(2, 1fr); }
		.fcard-a { left: -10px; } .fcard-b { right: -6px; }
	}
	@media (max-width: 560px) {
		.section { padding: 3.75rem 0; }
		.hero-stats { gap: 1.5rem; }
		.cap-grid, .role-grid, .steps, .reasons { grid-template-columns: 1fr; }
		.nav-actions .signin { display: none; }
		.hero-cta .btn, .cta-btns .btn { width: 100%; }
	}
	@media (prefers-reduced-motion: reduce) {
		.badge .dot, .chat-live i, .msg.typing i, .city-live i { animation: none; }
		.btn:hover, .cap-card:hover { transform: none; }
	}
</style>
