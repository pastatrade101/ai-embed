<script>
	// Public marketing landing page. Self-contained forest/gold/cream theme so it
	// doesn't inherit the dark admin app.css. All CTAs lead to the existing /login.
	const LOGIN = '/login';
	const ONBOARD = '/onboarding';

	const unanswered = [
		'How much is a 5-day Serengeti safari?',
		'Do you have departures in July?',
		'Can children join?',
		'Can I combine Zanzibar with a safari?',
		'How much does Kilimanjaro cost?'
	];
	const capabilities = [
		'Recommend the perfect safari',
		'Answer questions instantly',
		'Explain itineraries',
		'Compare tour packages',
		'Explain pricing',
		'Check departures',
		'Recommend upgrades',
		'Collect traveller information',
		'Qualify serious buyers',
		'Capture leads automatically',
		'Transfer directly to WhatsApp'
	];
	const steps = [
		{ n: '01', t: 'Create your AI assistant', d: 'Set it up in minutes — no code, no technical skills.' },
		{ n: '02', t: 'Add your tours', d: 'Import from CSV, JSON, PDF, or paste content. The AI organises everything.' },
		{ n: '03', t: 'Share your assistant', d: 'WhatsApp, Instagram bio, Facebook, Google Business, QR code, your website.' },
		{ n: '04', t: 'Receive booking-ready leads', d: 'Qualified customers arrive in your WhatsApp with all the important details.' }
	];
	const builtWith = ['Your prices', 'Your itineraries', 'Your departures', 'Your accommodation', 'Your availability', 'Your business policies'];
	const channels = ['Instagram', 'WhatsApp', 'Facebook', 'Google Business', 'TripAdvisor', 'QR Codes'];
	const reasons = [
		'Setup in under 10 minutes',
		'No coding required',
		'No website required',
		'Mobile friendly',
		'AI auto-updates',
		'Designed for tourism',
		'Professional experience',
		'Captures qualified leads',
		'Saves hours each week',
		'Converts more enquiries'
	];
	const plans = [
		{ name: 'Free', tag: 'Try it out', price: '$0', features: ['1 AI assistant', 'Hosted AI page', 'QR code', 'WhatsApp handoff'] },
		{ name: 'Starter', tag: 'Solo operator', price: '$29', features: ['More conversations', 'Website chat widget', 'Email lead alerts', 'Structured tours'] },
		{ name: 'Professional', tag: 'Most popular', price: '$79', features: ['AI lead qualification', 'Advanced AI model', 'Chat file attachments', 'Priority responses'], highlight: true },
		{ name: 'Enterprise', tag: 'Scale', price: 'Custom', features: ['Unlimited volume', 'Multiple brands', 'Dedicated support', 'Custom branding'] }
	];
	const faqs = [
		{ q: 'Do I need a website?', a: 'No. Makutano AI creates a hosted AI page automatically — just share the link or QR code.' },
		{ q: 'Can customers still reach me on WhatsApp?', a: 'Yes. The AI hands booking-ready customers directly to your WhatsApp.' },
		{ q: 'Can I upload my existing itineraries?', a: 'Yes. Import from CSV or JSON, or simply paste your existing content.' },
		{ q: 'Does the AI use my own prices?', a: 'Yes. It answers from your verified catalogue — not generic internet knowledge.' },
		{ q: 'How long does setup take?', a: 'Most operators are live in less than 10 minutes.' }
	];
</script>

<svelte:head>
	<title>Makutano AI — the AI booking assistant for tour operators</title>
	<meta name="description" content="Turn every website visitor, WhatsApp enquiry, Instagram click or QR scan into a qualified booking conversation — 24/7." />
	<meta name="robots" content="index,follow" />
</svelte:head>

<div class="landing">
	<!-- NAV -->
	<header class="nav">
		<div class="wrap nav-in">
			<a class="brand" href="/">
				<img src="/ICON-AI.png" alt="" />
				<span>Makutano&nbsp;AI</span>
			</a>
			<nav class="nav-links">
				<a href="#features">Features</a>
				<a href="#how">How it works</a>
				<a href="#pricing">Pricing</a>
				<a href="#faq">FAQ</a>
			</nav>
			<a class="btn gold sm" href={LOGIN}>Sign in</a>
		</div>
	</header>

	<!-- HERO -->
	<section class="hero">
		<div class="hero-bg"></div>
		<div class="wrap hero-in">
			<span class="pill"><i></i> Built for tour operators</span>
			<h1>Your best salesperson <em>never sleeps.</em></h1>
			<p class="lead">
				Turn every website visitor, WhatsApp enquiry, Instagram bio click, Google Business visitor or QR scan into a
				qualified booking conversation — 24/7.
			</p>
			<p class="sub">
				Makutano AI instantly answers customer questions, recommends the perfect safari, qualifies leads, and hands
				booking-ready customers directly to your WhatsApp.
			</p>
			<div class="cta-row">
				<a class="btn gold" href={ONBOARD}>Get started free</a>
				<a class="btn ghost" href="#how">See how it works</a>
			</div>
			<p class="trust">Trusted by modern tour operators to capture more bookings with AI</p>
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
					<div class="cm-msg cm-user">How much for a 7-day Serengeti safari for 2 in August?</div>
					<div class="cm-msg cm-ai">Our 7-Day Northern Circuit is <b>$3,240 pp</b> in August — 3 nights Serengeti, 2 nights Ngorongoro, all game drives, park fees & meals. Want me to check availability?</div>
					<div class="cm-msg cm-user">Yes please, and can we add Zanzibar?</div>
					<div class="cm-msg cm-ai">Absolutely — I can add a 3-night Zanzibar beach extension. Shall I hand you to the team on WhatsApp to hold your dates?</div>
				</div>
			</div>
			<div>
				<div class="label">Meet your AI booking assistant</div>
				<h2>The first person every customer speaks to.</h2>
				<p class="cream-muted">It works 24 hours a day — even while you're sleeping or guiding a safari.</p>
				<ul class="cap-grid">
					{#each capabilities as c}
						<li><span class="dot"></span>{c}</li>
					{/each}
				</ul>
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
				<h2 class="dark">A complete booking engine. Powered by AI, tuned for tourism.</h2>
			</div>
			<div class="bento">
				<div class="b b-hero">
					<div class="b-emoji">🤖</div>
					<h3>AI Booking Assistant</h3>
					<p>Answers customer questions instantly using your own business information — not random internet knowledge.</p>
					<div class="b-chat">
						<div class="bc user">"How much for a 7-day Serengeti safari for 2 in August?"</div>
						<div class="bc ai">Our 7-day Northern Circuit is $3,240 pp in August. Includes 3 nights Serengeti, 2 nights Ngorongoro, all game drives, park fees & meals. Want me to check availability?</div>
					</div>
				</div>
				<div class="b b-card"><div class="b-emoji">📚</div><h3>AI Knowledge</h3><p>Upload once. The AI learns tours, prices, destinations, policies, FAQs, accommodation, transfers & travel tips.</p></div>
				<div class="b b-card"><div class="b-emoji">📅</div><h3>Departure Management</h3><p>"Do you have departures next month?" The AI checks your real schedule before answering.</p></div>
				<div class="b b-gold"><div class="b-emoji">💬</div><h3>WhatsApp Handoff</h3><p>Booking-ready customers land directly in your WhatsApp. No copying. No exporting. No CRM headaches.</p></div>
				<div class="b b-card b-wide"><div class="b-emoji">📈</div><h3>AI Lead Qualification</h3><p>Know the budget, dates, group size, destination, interests & buying intent — before you reply.</p></div>
				<div class="b b-card"><div class="b-emoji">📊</div><h3>Lead Dashboard</h3><p>Track new enquiries, qualified leads, potential bookings, follow-ups & interests in one place.</p></div>
				<div class="b b-card"><div class="b-emoji">🌐</div><h3>Hosted AI Page</h3><p>No website? We create a professional AI booking page for your business. Just share the link.</p></div>
				<div class="b b-card"><div class="b-emoji">📷</div><h3>QR Code Booking</h3><p>Print your QR on safari vehicles, hotels, flyers & cards. Visitors scan and start chatting.</p></div>
			</div>
		</div>
	</section>

	<!-- BUILT FOR OPERATORS -->
	<section class="built">
		<div class="built-bg"></div>
		<div class="wrap built-in">
			<div class="head-narrow">
				<div class="label">Built specifically for tour operators</div>
				<h2>Unlike generic chatbots, Makutano AI understands tourism.</h2>
				<p class="cream-muted">It answers using your verified business information — never random internet content. So customers always receive accurate answers.</p>
			</div>
			<ul class="built-list">
				{#each builtWith as b}
					<li><span class="tick">✓</span>{b}</li>
				{/each}
			</ul>
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
				<div class="label">Why operators love it</div>
				<h2 class="dark">Ten reasons tour operators switch to Makutano AI.</h2>
			</div>
			<div class="reasons">
				{#each reasons as r}<div class="reason"><span class="tick">✓</span>{r}</div>{/each}
			</div>
		</div>
	</section>

	<!-- PRICING -->
	<section id="pricing" class="pricing">
		<div class="wrap">
			<div class="head-narrow">
				<div class="label">Pricing</div>
				<h2 class="dark">One booking can pay for months of Makutano AI.</h2>
				<p class="muted">Choose the plan that fits your business. Upgrade anytime. No hidden fees.</p>
			</div>
			<div class="plans">
				{#each plans as p}
					<div class="plan" class:hot={p.highlight}>
						<div class="plan-tag">{p.tag}</div>
						<div class="plan-name">{p.name}</div>
						<div class="plan-price">{p.price}{#if p.price !== 'Custom'}<span>/mo</span>{/if}</div>
						<ul>
							{#each p.features as f}<li><span class="tick">✓</span>{f}</li>{/each}
						</ul>
						<a class="btn {p.highlight ? 'gold' : 'outline'} full" href={p.name === 'Enterprise' ? LOGIN : ONBOARD}>{p.name === 'Enterprise' ? 'Contact sales' : 'Get started'}</a>
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
		<div class="wrap foot-in">
			<div class="brand">
				<img src="/ICON-AI.png" alt="" />
				<div>
					<div class="foot-name">Makutano AI</div>
					<div class="foot-tag">The AI booking assistant built for tour operators.</div>
				</div>
			</div>
			<div class="foot-copy">© {new Date().getFullYear()} Makutano AI · <a href={LOGIN}>Sign in</a></div>
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
		font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
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
		line-height: 1.08;
		letter-spacing: -0.02em;
		margin: 0;
	}
	h2.dark {
		color: var(--ink);
	}
	h2.narrow,
	.head-narrow {
		max-width: 44ch;
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

	/* Nav */
	.nav {
		position: absolute;
		inset: 0 0 auto 0;
		z-index: 30;
	}
	.nav-in {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 1.5rem;
		padding-bottom: 1.5rem;
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
	.nav-links {
		display: none;
		gap: 2rem;
		font-size: 0.9rem;
		color: rgba(247, 242, 232, 0.8);
	}
	.nav-links a:hover {
		color: var(--gold);
	}
	@media (min-width: 860px) {
		.nav-links {
			display: flex;
		}
	}

	/* Hero */
	.hero {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		color: var(--cream);
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
		padding: 10rem 24px 7rem;
		max-width: 1180px;
	}
	.hero-in > * {
		max-width: 780px;
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
		font-size: clamp(2.6rem, 6.5vw, 4.6rem);
		font-weight: 660;
		line-height: 1.03;
		letter-spacing: -0.03em;
		color: var(--cream);
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
	.trust {
		margin-top: 1.6rem;
		font-size: 0.72rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: rgba(247, 242, 232, 0.5);
	}

	/* Shared section rhythm */
	.why,
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
	.b-emoji {
		font-size: 1.6rem;
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
	.tick {
		color: var(--gold);
		font-weight: 700;
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
		font-size: 2.4rem;
		font-weight: 680;
		letter-spacing: -0.02em;
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
	.foot-in {
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
		padding-top: 2.5rem;
		padding-bottom: 2.5rem;
	}
	@media (min-width: 700px) {
		.foot-in {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}
	.foot .brand {
		color: var(--cream);
		font-size: 1rem;
	}
	.foot-name {
		font-weight: 650;
		color: var(--cream);
		font-size: 0.95rem;
	}
	.foot-tag {
		font-size: 0.8rem;
		color: rgba(247, 242, 232, 0.55);
	}
	.foot-copy a {
		color: var(--gold);
	}

	@media (prefers-reduced-motion: reduce) {
		.landing :global(*) {
			transition-duration: 0.001ms !important;
		}
	}
</style>
