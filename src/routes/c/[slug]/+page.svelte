<script>
	// Public, no-auth AI travel concierge — THREAD-FIRST direction.
	// A calm, centered conversation column is the star. The hero lives INSIDE the
	// empty thread as a welcome state (greeting + suggested prompts + featured
	// tours) and recedes the moment the first message arrives. Rich cards render
	// inline in assistant turns. Sticky rounded composer centered at the bottom.
	//
	// Self-contained: system font stack, inline SVG icons, component-scoped styles.
	// Light theme by default; dark via prefers-color-scheme + [data-theme].
	import { onMount, afterUpdate, tick } from 'svelte';
	import { renderMarkdown } from '$lib/markdown.js';

	export let data;

	// ---- Data ---------------------------------------------------------------
	$: client = data?.client ?? {};
	$: tours = Array.isArray(data?.tours) ? data.tours : [];
	$: brand = client.brand || '#0f6e56';
	$: brandInk = readableInk(brand);
	$: assistantName = client.assistantName || 'Concierge';
	$: allowAttachments = !!client.allowAttachments;
	$: waLink = client.whatsapp ? 'https://wa.me/' + String(client.whatsapp).replace(/[^0-9]/g, '') : null;
	$: telLink = client.phone ? 'tel:' + String(client.phone).replace(/[^0-9+]/g, '') : null;
	$: mapLink = client.address ? 'https://maps.google.com/?q=' + encodeURIComponent(client.address) : null;
	$: initials = (client.name ?? 'A')
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => w[0])
		.join('')
		.toUpperCase();
	$: greeting =
		client.welcome ||
		`Hello — I'm ${assistantName}, your private travel guide for ${client.name || 'our journeys'}.`;
	$: suggestions =
		Array.isArray(client.suggestions) && client.suggestions.length
			? client.suggestions.slice(0, 6)
			: DEFAULT_SUGGESTIONS;
	// Feature up to 3 tours proactively beneath the hero.
	$: featured = tours.slice(0, 3);

	const DEFAULT_SUGGESTIONS = [
		'Design a 7-day safari for two',
		'Best time for the Great Migration',
		'Family-friendly tours under $2,500',
		'What should I pack?'
	];

	// ---- Contrast helper (readable ink on an arbitrary brand color) ----------
	function readableInk(hex) {
		const c = String(hex || '').replace('#', '');
		const v =
			c.length === 3
				? c.split('').map((x) => parseInt(x + x, 16))
				: [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) || 0);
		const [r, g, b] = v.map((n) => {
			const s = n / 255;
			return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
		});
		const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		return L > 0.45 ? '#1a1815' : '#ffffff';
	}

	// ---- Conversation state --------------------------------------------------
	let messages = []; // { role:'user'|'assistant', content, id }
	let input = '';
	let busy = false;
	let conversationId = null;
	let started = false;
	let toursLoading = true; // skeletons for the initial featured list
	let logEl;
	let taEl;
	let pinned = true; // autoscroll only when the user is at the bottom
	let uid = 0;
	let attachment = null; // { name, kind:'image'|'pdf', mediaType, data(base64), previewUrl }
	let fileEl;
	const MAX_ATT = 5 * 1024 * 1024; // 5 MB

	function openFilePicker() {
		fileEl?.click();
	}
	function onPickFile(e) {
		const file = e.target.files?.[0];
		e.target.value = ''; // allow re-picking the same file
		if (!file) return;
		const isPdf = file.type === 'application/pdf';
		const isImg = /^image\/(png|jpe?g|gif|webp)$/.test(file.type);
		if (!isPdf && !isImg) return alert('Please attach a photo (JPG, PNG, WebP) or a PDF.');
		if (file.size > MAX_ATT) return alert('That file is too large — keep it under 5 MB.');
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = String(reader.result || '');
			attachment = {
				name: file.name,
				kind: isPdf ? 'pdf' : 'image',
				mediaType: file.type,
				data: dataUrl.split(',')[1] || '',
				previewUrl: isImg ? dataUrl : null
			};
		};
		reader.readAsDataURL(file);
	}
	function clearAttachment() {
		attachment = null;
	}

	const STORE = 'concierge_' + (data?.client?.slug ?? 'x');

	onMount(() => {
		// Restore a recent session so returning visitors keep their thread.
		try {
			const raw = localStorage.getItem(STORE);
			if (raw) {
				const s = JSON.parse(raw);
				if (s?.ts && Date.now() - s.ts < 2 * 60 * 60 * 1000 && Array.isArray(s.messages)) {
					messages = s.messages;
					conversationId = s.conversationId || null;
					started = messages.length > 0;
				}
			}
		} catch (_) {}
		// Reveal featured tours after a beat so skeletons read as intentional.
		const t = setTimeout(() => (toursLoading = false), 650);
		setupVoice();
		return () => clearTimeout(t);
	});

	function persist() {
		try {
			// Drop heavy inline attachment previews before saving (localStorage quota).
			const light = messages.map(({ attPreview, ...m }) => m);
			localStorage.setItem(STORE, JSON.stringify({ messages: light, conversationId, ts: Date.now() }));
		} catch (_) {}
	}

	// Autoscroll, but respect a user who has scrolled up to read.
	function onScroll() {
		if (!logEl) return;
		const gap = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight;
		pinned = gap < 120;
	}
	afterUpdate(() => {
		if (logEl && pinned) logEl.scrollTop = logEl.scrollHeight;
	});

	// ---- Thinking phrases (contextual, cycling) ------------------------------
	const THINKING = [
		'Searching tours…',
		'Checking live availability…',
		'Building your itinerary…',
		'Comparing seasons…',
		'Finding the best value…'
	];
	let thinkIx = 0;
	let thinkTimer = null;
	function startThinking(seed) {
		// Pick an opening phrase that suits the question.
		const q = (seed || '').toLowerCase();
		thinkIx = /avail|seat|date|depart/.test(q)
			? 1
			: /itinerary|day|plan|route/.test(q)
				? 2
				: /price|cost|budget|\$/.test(q)
					? 4
					: 0;
		clearInterval(thinkTimer);
		thinkTimer = setInterval(() => (thinkIx = (thinkIx + 1) % THINKING.length), 1900);
	}
	function stopThinking() {
		clearInterval(thinkTimer);
		thinkTimer = null;
	}

	// ---- Send ----------------------------------------------------------------
	async function send(text) {
		const q = (text ?? input).trim();
		const att = attachment;
		if ((!q && !att) || busy) return;
		const shown = q || (att ? `📎 ${att.name}` : '');
		messages = [...messages, { role: 'user', content: shown, id: ++uid, attPreview: att?.previewUrl ?? null, attName: att?.name ?? null }];
		input = '';
		attachment = null;
		if (taEl) taEl.style.height = 'auto';
		busy = true;
		started = true;
		pinned = true;
		startThinking(q);
		await tick();
		try {
			const r = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					clientSlug: client.slug,
					messages: messages.map((m) => ({ role: m.role, content: m.content })),
					conversationId,
					source: 'hosted',
					attachment: att ? { kind: att.kind, mediaType: att.mediaType, data: att.data } : undefined
				})
			});
			const d = await r.json();
			if (d?.conversationId) conversationId = d.conversationId;
			messages = [
				...messages,
				{
					role: 'assistant',
					content: d?.answer || "I'm sorry — I couldn't reach the itinerary desk just now. Please try again.",
					id: ++uid
				}
			];
		} catch (_) {
			messages = [
				...messages,
				{ role: 'assistant', content: 'Connection hiccup. Please try that again in a moment.', id: ++uid }
			];
		}
		stopThinking();
		busy = false;
		persist();
	}

	function onSubmit(e) {
		e.preventDefault();
		send();
	}
	function onKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
	function autogrow() {
		if (!taEl) return;
		taEl.style.height = 'auto';
		taEl.style.height = Math.min(taEl.scrollHeight, 180) + 'px';
	}

	function resetThread() {
		messages = [];
		started = false;
		conversationId = null;
		try {
			localStorage.removeItem(STORE);
		} catch (_) {}
	}

	// ---- Voice (Web Speech API, progressive enhancement) ---------------------
	let recog = null;
	let listening = false;
	let voiceOK = false;
	function setupVoice() {
		const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
		if (!SR) return;
		voiceOK = true;
		recog = new SR();
		recog.lang = 'en-US';
		recog.interimResults = true;
		recog.continuous = false;
		recog.onresult = (ev) => {
			let t = '';
			for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
			input = t;
			autogrow();
		};
		recog.onend = () => (listening = false);
		recog.onerror = () => (listening = false);
	}
	function toggleVoice() {
		if (!recog) return;
		if (listening) {
			recog.stop();
			listening = false;
		} else {
			try {
				input = '';
				recog.start();
				listening = true;
			} catch (_) {}
		}
	}

	// ---- Theme toggle --------------------------------------------------------
	let theme = 'auto'; // 'auto' | 'light' | 'dark'
	function cycleTheme() {
		theme = theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto';
	}

	// ---- Inline rich-block parsing -------------------------------------------
	// The assistant may surface rich UI by emitting fenced blocks the renderer
	// intercepts. Everything else is ordinary markdown.
	//   ```tour {"title":"Great Migration Safari"}```   → hydrate from tours[]
	//   ```tour {"title":"…","price":2450,"currency":"USD","durationDays":7,…}```
	//   ```pricing {"lines":[{"label":"Per person","value":"$2,450"}],"total":"…"}```
	//   ```itinerary {"days":[{"title":"Arrival","body":"…"}]}```  (or {"text":"…"})
	//   ```destination {"name":"Serengeti","note":"…"}```
	//   ```collapsible {"title":"What's included","body":"…"}```
	const FENCE = /```(tour|pricing|itinerary|destination|collapsible)\s*([\s\S]*?)```/g;

	function parseBlocks(content) {
		const out = [];
		let last = 0;
		let m;
		FENCE.lastIndex = 0;
		while ((m = FENCE.exec(content))) {
			if (m.index > last) out.push({ kind: 'md', text: content.slice(last, m.index) });
			const data = safeJson(m[2]);
			out.push(hydrate(m[1], data));
			last = m.index + m[0].length;
		}
		if (last < content.length) out.push({ kind: 'md', text: content.slice(last) });
		return out.filter((b) => !(b.kind === 'md' && !b.text.trim()));
	}
	function safeJson(s) {
		try {
			return JSON.parse(s.trim());
		} catch (_) {
			return { text: s.trim() };
		}
	}
	function hydrate(kind, d) {
		if (kind === 'tour') {
			// Merge server tour data (by title) with any inline overrides.
			const match = tours.find((t) => t.title && d.title && t.title.toLowerCase() === d.title.toLowerCase());
			return { kind: 'tour', tour: { ...(match || {}), ...d } };
		}
		if (kind === 'itinerary') {
			let days = Array.isArray(d.days) ? d.days : null;
			if (!days && d.text) days = freeTextToDays(d.text); // graceful degrade
			return { kind: 'itinerary', days: days || [], raw: d.text || '', data: d };
		}
		return { kind, data: d };
	}
	// Best-effort structure from a free-text itinerary (no guaranteed format).
	function freeTextToDays(text) {
		const lines = String(text)
			.split(/\n+/)
			.map((l) => l.trim())
			.filter(Boolean);
		const days = [];
		for (const l of lines) {
			const m = l.match(/^(?:day\s*\d+\s*[:.\-–]?\s*)(.*)$/i);
			if (m) days.push({ title: l.split(/[:.\-–]/)[0].trim(), body: m[1].trim() });
			else if (days.length) days[days.length - 1].body += (days[days.length - 1].body ? ' ' : '') + l;
			else days.push({ title: '', body: l });
		}
		return days;
	}

	function money(n, cur) {
		if (n == null || n === '') return null;
		const num = Number(n);
		if (Number.isNaN(num)) return String(n);
		try {
			return new Intl.NumberFormat(undefined, {
				style: 'currency',
				currency: cur || 'USD',
				maximumFractionDigits: 0
			}).format(num);
		} catch (_) {
			return (cur ? cur + ' ' : '$') + num.toLocaleString();
		}
	}
	function monogram(title) {
		return (title || '?')
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase();
	}
	function nextDeparture(t) {
		const d = Array.isArray(t?.departures) ? t.departures.filter((x) => x?.date) : [];
		if (!d.length) return null;
		d.sort((a, b) => String(a.date).localeCompare(String(b.date)));
		return d[0];
	}
	function fmtDate(s) {
		const d = new Date(s);
		return Number.isNaN(+d) ? s : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}
	function bookLink(t) {
		if (!waLink) return null;
		const msg = `Hi ${assistantName}, I'd like to book "${t?.title || 'a tour'}".`;
		return waLink + '?text=' + encodeURIComponent(msg);
	}

	// Collapsible open-state, keyed by message id + block index.
	let openSet = {};
	function toggleOpen(k) {
		openSet = { ...openSet, [k]: !openSet[k] };
	}
</script>

<div
	class="concierge"
	data-theme={theme === 'auto' ? null : theme}
	style="--brand:{brand}; --brand-ink:{brandInk};"
>
	<!-- Minimal top chrome ---------------------------------------------------->
	<header class="topbar">
		<button class="brandmark" on:click={resetThread} title="Start over">
			{#if client.logo}
				<img src={client.logo} alt="" />
			{:else}
				<span class="mono">{initials}</span>
			{/if}
			<span class="bname">{client.name || 'Travel Concierge'}</span>
		</button>

		<div class="top-actions">
			{#if waLink}
				<a class="chip-btn" href={waLink} target="_blank" rel="noopener" aria-label="WhatsApp">
					<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"
						><path
							fill="currentColor"
							d="M.06 24l1.68-6.13A11.86 11.86 0 010 12C0 5.37 5.37 0 12 0s12 5.37 12 12-5.37 12-12 12a11.9 11.9 0 01-5.7-1.45L.06 24zM6.6 20.14l.36.22A9.86 9.86 0 0012 21.82c5.42 0 9.82-4.4 9.82-9.82S17.42 2.18 12 2.18 2.18 6.58 2.18 12c0 1.86.52 3.66 1.5 5.22l.24.38-1 3.66 3.68-1.12zM17.4 14.3c-.07-.12-.26-.2-.55-.34s-1.72-.85-1.98-.94-.46-.14-.66.14-.76.94-.93 1.14-.34.2-.63.07a8.1 8.1 0 01-2.38-1.47 9 9 0 01-1.65-2.05c-.17-.3 0-.45.13-.6l.4-.46c.13-.16.17-.27.26-.46s.05-.34-.02-.48-.66-1.58-.9-2.17c-.24-.57-.48-.49-.66-.5h-.56c-.2 0-.5.07-.77.36s-1.02.99-1.02 2.42 1.05 2.8 1.2 3 2.06 3.15 5 4.42c.7.3 1.24.48 1.66.62.7.22 1.33.19 1.83.11.56-.08 1.72-.7 1.96-1.38s.24-1.26.17-1.38z"
						/></svg
					>
				</a>
			{/if}
			<button class="chip-btn" on:click={cycleTheme} aria-label="Toggle theme">
				{#if theme === 'dark'}
					<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"
						><path fill="currentColor" d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36A7 7 0 0112 3z" /></svg
					>
				{:else if theme === 'light'}
					<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"
						><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
							><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></g
						></svg
					>
				{:else}
					<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"
						><path fill="currentColor" d="M12 2a10 10 0 000 20V2z" /><circle
							cx="12"
							cy="12"
							r="9.2"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
						/></svg
					>
				{/if}
			</button>
		</div>
	</header>

	<!-- The thread ------------------------------------------------------------>
	<main class="thread" bind:this={logEl} on:scroll={onScroll}>
		<div class="column">
			{#if !started}
				<!-- HERO welcome, living inside the empty thread ------------------>
				<section class="welcome">
					<p class="eyebrow">{assistantName} · Private travel desk</p>
					<h1 class="hello">{greeting}</h1>
					<p class="sub">
						Ask anything — routes, seasons, prices, availability. I'll craft options and hold your
						dates the moment you're ready.
					</p>

					<div class="chips">
						{#each suggestions as s}
							<button class="chip" on:click={() => send(s)}>
								<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
									><path
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M5 12h14M13 6l6 6-6 6"
									/></svg
								>
								<span>{s}</span>
							</button>
						{/each}
					</div>

					<!-- Featured tours (proactive) ------------------------------->
					{#if toursLoading}
						<div class="featured">
							<div class="feat-head"><span class="label">Featured journeys</span></div>
							<div class="feat-grid">
								{#each Array(3) as _}
									<div class="skel-card">
										<div class="skel-mono shimmer"></div>
										<div class="skel-line shimmer" style="width:70%"></div>
										<div class="skel-line shimmer" style="width:92%"></div>
										<div class="skel-line shimmer" style="width:50%"></div>
										<div class="skel-foot">
											<div class="skel-pill shimmer"></div>
											<div class="skel-btn shimmer"></div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{:else if featured.length}
						<div class="featured">
							<div class="feat-head"><span class="label">Featured journeys</span></div>
							<div class="feat-grid">
								{#each featured as t}
									<article class="tour-card feat">
										<div class="tc-cover">
											{#if t.image}<img class="tc-img" src={t.image} alt={t.title} loading="lazy" />{:else}<span class="tc-mono">{monogram(t.title)}</span>{/if}
											{#if t.duration}<span class="tc-badge">{t.duration}</span>{/if}
										</div>
										<div class="tc-body">
											<h3 class="tc-title">{t.title}</h3>
											{#if t.summary}<p class="tc-sum">{t.summary}</p>{/if}
											<div class="tc-meta">
												{#if t.season}<span class="tc-tag">{t.season}</span>{/if}
												{#if t.destination}<span class="tc-tag">{t.destination}</span>{/if}
												{#if t.maxGroup}<span class="tc-tag">Max {t.maxGroup}</span>{/if}
											</div>
										</div>
										<div class="tc-foot">
											{#if t.price != null}
												<div class="tc-price">
													<span class="from">from</span>
													<strong>{money(t.price, t.currency)}</strong>
												</div>
											{/if}
											<button class="tc-cta" on:click={() => send(`Tell me more about "${t.title}"`)}>
												Explore
											</button>
										</div>
									</article>
								{/each}
							</div>
						</div>
					{/if}
				</section>
			{:else}
				<!-- Conversation ---------------------------------------------->
				<ul class="turns">
					{#each messages as m (m.id)}
						<li class="turn {m.role}">
							{#if m.role === 'assistant'}
								<div class="avatar"><span class="mono-sm">{initials}</span></div>
							{/if}
							<div class="bubble-wrap">
								{#if m.role === 'assistant'}
									<div class="assistant-body">
										{#each parseBlocks(m.content) as b, bi}
											{#if b.kind === 'md'}
												<div class="prose">{@html renderMarkdown(b.text)}</div>
											{:else if b.kind === 'tour'}
												<!-- Inline TOUR CARD ------------------------------->
												<article class="tour-card inline">
													<div class="tc-cover">
														{#if b.tour.image}<img class="tc-img" src={b.tour.image} alt={b.tour.title} loading="lazy" />{:else}<span class="tc-mono">{monogram(b.tour.title)}</span>{/if}
														{#if b.tour.duration}<span class="tc-badge">{b.tour.duration}</span>{/if}
													</div>
													<div class="tc-body">
														<h3 class="tc-title">{b.tour.title || 'Custom journey'}</h3>
														{#if b.tour.summary}<p class="tc-sum">{b.tour.summary}</p>{/if}
														<div class="tc-meta">
															{#if b.tour.season}<span class="tc-tag">
																	<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"
																		><path fill="currentColor" d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7zm0 4.5A2.5 2.5 0 1012 11a2.5 2.5 0 000-4.5z"/></svg
																	>{b.tour.season}</span
																>{/if}
															{#if b.tour.maxGroup}<span class="tc-tag">
																	<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"
																		><path fill="currentColor" d="M16 11a3 3 0 10-3-3 3 3 0 003 3zm-8 0a3 3 0 10-3-3 3 3 0 003 3zm0 2c-2.3 0-7 1.2-7 3.5V19h9v-2.5c0-1 .5-1.9 1.3-2.6A11 11 0 008 13zm8 0c-.5 0-1 0-1.6.1 1 .8 1.6 1.8 1.6 2.9V19h8v-2.5c0-2.3-4.7-3.5-8-3.5z"/></svg
																	>Max {b.tour.maxGroup}</span
																>{/if}
														</div>
													</div>
													<div class="tc-foot">
														{#if b.tour.price != null}
															<div class="tc-price">
																<span class="from">from</span>
																<strong>{money(b.tour.price, b.tour.currency)}</strong>
																<span class="pp">/ person</span>
															</div>
														{/if}
														{#if bookLink(b.tour)}
															<a class="tc-cta filled" href={bookLink(b.tour)} target="_blank" rel="noopener">
																<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
																	><path fill="currentColor" d="M.06 24l1.68-6.13A11.86 11.86 0 010 12C0 5.37 5.37 0 12 0s12 5.37 12 12-5.37 12-12 12a11.9 11.9 0 01-5.7-1.45L.06 24z"/></svg
																>Book on WhatsApp
															</a>
														{:else}
															<button class="tc-cta filled" on:click={() => send(`I'd like to book "${b.tour.title}"`)}>Book this</button>
														{/if}
													</div>
													{#if nextDeparture(b.tour)}
														{@const dep = nextDeparture(b.tour)}
														<div class="tc-avail">
															<span class="dot"></span>
															Next departure {fmtDate(dep.date)}
															{#if dep.seats != null}<b>· {dep.seats} seats left</b>{/if}
														</div>
													{/if}
												</article>
											{:else if b.kind === 'pricing'}
												<!-- PRICING CARD --------------------------------->
												<div class="pricing">
													{#if b.data.title}<div class="pr-title">{b.data.title}</div>{/if}
													{#each b.data.lines || [] as ln}
														<div class="pr-row"><span>{ln.label}</span><span>{ln.value}</span></div>
													{/each}
													{#if b.data.total}
														<div class="pr-total"><span>Total</span><span>{b.data.total}</span></div>
													{/if}
													{#if b.data.note}<p class="pr-note">{b.data.note}</p>{/if}
												</div>
											{:else if b.kind === 'itinerary'}
												<!-- ITINERARY TIMELINE --------------------------->
												<div class="timeline">
													{#if b.data?.title}<div class="tl-title">{b.data.title}</div>{/if}
													{#if b.days.length}
														<ol class="tl-list">
															{#each b.days as day, i}
																<li class="tl-item">
																	<span class="tl-node">{i + 1}</span>
																	<div class="tl-content">
																		{#if day.title}<div class="tl-day">{day.title}</div>{/if}
																		{#if day.body}<p class="tl-body">{day.body}</p>{/if}
																	</div>
																</li>
															{/each}
														</ol>
													{:else if b.raw}
														<p class="tl-raw">{b.raw}</p>
													{/if}
												</div>
											{:else if b.kind === 'destination'}
												<!-- DESTINATION HIGHLIGHT ------------------------->
												<div class="destination">
													<div class="ds-glow"></div>
													<div class="ds-body">
														<span class="ds-kicker">Destination</span>
														<h4 class="ds-name">{b.data.name}</h4>
														{#if b.data.note}<p class="ds-note">{b.data.note}</p>{/if}
													</div>
												</div>
											{:else if b.kind === 'collapsible'}
												<!-- COLLAPSIBLE ---------------------------------->
												<div class="collapsible" class:open={openSet[m.id + '-' + bi]}>
													<button class="cl-head" on:click={() => toggleOpen(m.id + '-' + bi)}>
														<span>{b.data.title || 'Details'}</span>
														<svg class="cl-caret" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"
															><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg
														>
													</button>
													{#if openSet[m.id + '-' + bi]}
														<div class="cl-body prose">{@html renderMarkdown(b.data.body || '')}</div>
													{/if}
												</div>
											{/if}
										{/each}
									</div>
								{:else}
									<div class="bubble user">
						{#if m.attPreview}<img class="msg-att" src={m.attPreview} alt={m.attName || 'attachment'} />{/if}
						{m.content}
					</div>
								{/if}
							</div>
						</li>
					{/each}

					{#if busy}
						<li class="turn assistant thinking">
							<div class="avatar"><span class="mono-sm">{initials}</span></div>
							<div class="bubble-wrap">
								<div class="think">
									<span class="think-dots"><i></i><i></i><i></i></span>
									{#key thinkIx}
										<span class="think-phrase">{THINKING[thinkIx]}</span>
									{/key}
								</div>
								<div class="skel-bubble">
									<div class="skel-line shimmer" style="width:88%"></div>
									<div class="skel-line shimmer" style="width:96%"></div>
									<div class="skel-line shimmer" style="width:64%"></div>
								</div>
							</div>
						</li>
					{/if}
				</ul>
			{/if}
		</div>
	</main>

	<!-- Composer (sticky, centered) ------------------------------------------->
	<footer class="composer">
		<div class="column">
			{#if attachment}
				<div class="att-chip">
					{#if attachment.previewUrl}<img src={attachment.previewUrl} alt="" />{:else}<span class="att-doc">PDF</span>{/if}
					<span class="att-name">{attachment.name}</span>
					<button type="button" class="att-x" on:click={clearAttachment} aria-label="Remove attachment">✕</button>
				</div>
			{/if}
			<form class="bar" on:submit={onSubmit} data-no-busy>
				{#if allowAttachments}
					<input type="file" bind:this={fileEl} accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" on:change={onPickFile} hidden />
					<button type="button" class="ic-btn" on:click={openFilePicker} aria-label="Attach" title="Attach a photo or PDF">
						<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
							><path
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M21.4 11.05l-8.49 8.49a5 5 0 01-7.07-7.07l8.49-8.49a3 3 0 014.24 4.24l-8.49 8.49a1 1 0 01-1.41-1.41l7.78-7.78"
							/></svg
						>
					</button>
				{/if}

				<textarea
					bind:this={taEl}
					bind:value={input}
					on:input={autogrow}
					on:keydown={onKeydown}
					rows="1"
					placeholder={started ? `Message ${assistantName}…` : 'Ask about tours, dates, prices…'}
				></textarea>

				{#if voiceOK}
					<button
						type="button"
						class="ic-btn mic"
						class:live={listening}
						on:click={toggleVoice}
						aria-label="Voice input"
						title="Speak your question"
					>
						<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
							><path
								fill="currentColor"
								d="M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3z"
							/><path
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								d="M5 11a7 7 0 0014 0M12 18v3"
							/></svg
						>
					</button>
				{/if}

				<button type="submit" class="send" class:ready={(input.trim() || attachment) && !busy} disabled={(!input.trim() && !attachment) || busy} aria-label="Send">
					<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
						><path fill="currentColor" d="M3.4 20.4l17.45-8.3a1 1 0 000-1.8L3.4 2A.98.98 0 002 2.9L2 9.12c0 .5.37.93.87 1L15 12 2.87 13.88c-.5.08-.87.5-.87 1V21c0 .68.7 1.15 1.4.4z" /></svg
					>
				</button>
			</form>
			<p class="fineprint">
				{#if telLink}<a href={telLink}>Call</a> ·{/if}
				{#if client.email}<a href={'mailto:' + client.email}>Email</a> ·{/if}
				{#if mapLink}<a href={mapLink} target="_blank" rel="noopener">Visit</a> ·{/if}
				<span>Responses are AI-generated · confirm details before booking</span>
					{#if !client.hideBranding}<span> · <a href="https://makutano.digital" target="_blank" rel="noopener">Powered by Makutano</a></span>{/if}
			</p>
		</div>
	</footer>

	<!-- Persistent booking action (mobile-reachable) -------------------------->
	{#if waLink}
		<a class="fab" href={waLink} target="_blank" rel="noopener" aria-label="Book on WhatsApp">
			<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"
				><path
					fill="currentColor"
					d="M.06 24l1.68-6.13A11.86 11.86 0 010 12C0 5.37 5.37 0 12 0s12 5.37 12 12-5.37 12-12 12a11.9 11.9 0 01-5.7-1.45L.06 24zM6.6 20.14l.36.22A9.86 9.86 0 0012 21.82c5.42 0 9.82-4.4 9.82-9.82S17.42 2.18 12 2.18 2.18 6.58 2.18 12c0 1.86.52 3.66 1.5 5.22l.24.38-1 3.66 3.68-1.12z"
				/></svg
			>
		</a>
	{/if}
</div>

<style>
	/* ---- Tokens ---------------------------------------------------------- */
	.concierge {
		--bg: #faf9f7;
		--bg-2: #f4f2ee;
		--surface: #ffffff;
		--surface-2: #fbfaf8;
		--ink: #1a1815;
		--ink-2: #524d46;
		--muted: #8a847b;
		--hair: rgba(26, 24, 21, 0.09);
		--hair-2: rgba(26, 24, 21, 0.055);
		--shadow: 0 1px 2px rgba(26, 24, 21, 0.04), 0 8px 30px -12px rgba(26, 24, 21, 0.14);
		--shadow-lg: 0 24px 60px -20px rgba(26, 24, 21, 0.28);
		--radius: 20px;
		--brand-soft: color-mix(in srgb, var(--brand) 10%, transparent);
		--brand-line: color-mix(in srgb, var(--brand) 26%, transparent);
		--user-bg: color-mix(in srgb, var(--brand) 12%, var(--surface));

		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
		background: radial-gradient(140% 90% at 50% -10%, var(--bg-2) 0%, var(--bg) 55%);
		color: var(--ink);
		font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
		-webkit-font-smoothing: antialiased;
		letter-spacing: -0.011em;
	}
	@media (prefers-color-scheme: dark) {
		.concierge:not([data-theme='light']) {
			--bg: #131210;
			--bg-2: #1a1815;
			--surface: #1f1c19;
			--surface-2: #24211d;
			--ink: #f3efe9;
			--ink-2: #cbc4ba;
			--muted: #948d83;
			--hair: rgba(255, 252, 247, 0.1);
			--hair-2: rgba(255, 252, 247, 0.06);
			--shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 10px 34px -14px rgba(0, 0, 0, 0.6);
			--shadow-lg: 0 30px 70px -24px rgba(0, 0, 0, 0.7);
			--brand-soft: color-mix(in srgb, var(--brand) 20%, transparent);
			--user-bg: color-mix(in srgb, var(--brand) 22%, var(--surface));
		}
	}
	.concierge[data-theme='dark'] {
		--bg: #131210;
		--bg-2: #1a1815;
		--surface: #1f1c19;
		--surface-2: #24211d;
		--ink: #f3efe9;
		--ink-2: #cbc4ba;
		--muted: #948d83;
		--hair: rgba(255, 252, 247, 0.1);
		--hair-2: rgba(255, 252, 247, 0.06);
		--shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 10px 34px -14px rgba(0, 0, 0, 0.6);
		--shadow-lg: 0 30px 70px -24px rgba(0, 0, 0, 0.7);
		--brand-soft: color-mix(in srgb, var(--brand) 20%, transparent);
		--user-bg: color-mix(in srgb, var(--brand) 22%, var(--surface));
	}

	/* Neutralize the admin app.css element rules (strong{#fff}, a{mint}, h*{#fff},
	   inputs{dark}) that leak into this self-contained light page. Covers both
	   template elements and {@html} markdown output. */
	.concierge :global(strong),
	.concierge :global(b) {
		color: inherit;
		font-weight: 700;
	}
	.concierge :global(h1),
	.concierge :global(h2),
	.concierge :global(h3),
	.concierge :global(h4),
	.concierge :global(h5),
	.concierge :global(h6) {
		color: inherit;
	}
	.concierge :global(.prose a) {
		color: var(--brand);
	}
	.concierge :global(input),
	.concierge :global(textarea) {
		background: transparent;
		color: inherit;
	}

	*,
	*::before,
	*::after {
		box-sizing: border-box;
	}
	button {
		font: inherit;
		cursor: pointer;
	}

	/* ---- Shared column --------------------------------------------------- */
	.column {
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: 0 20px;
	}

	/* ---- Top bar --------------------------------------------------------- */
	.topbar {
		position: sticky;
		top: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 18px;
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		backdrop-filter: saturate(1.4) blur(14px);
		-webkit-backdrop-filter: saturate(1.4) blur(14px);
		border-bottom: 1px solid var(--hair-2);
	}
	.brandmark {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		background: none;
		border: 0;
		padding: 4px 6px;
		border-radius: 12px;
		color: var(--ink);
	}
	.brandmark img {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		object-fit: cover;
	}
	.brandmark .mono {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		display: grid;
		place-items: center;
		font-size: 12px;
		font-weight: 700;
		color: var(--brand-ink);
		background: linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 60%, #000));
	}
	.bname {
		font-weight: 640;
		font-size: 15px;
		letter-spacing: -0.02em;
	}
	.top-actions {
		display: flex;
		gap: 8px;
	}
	.chip-btn {
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border-radius: 10px;
		border: 1px solid var(--hair);
		background: var(--surface);
		color: var(--ink-2);
		box-shadow: var(--shadow);
		transition: transform 0.15s, color 0.15s, border-color 0.15s;
	}
	.chip-btn:hover {
		color: var(--brand);
		border-color: var(--brand-line);
		transform: translateY(-1px);
	}

	/* ---- Thread ---------------------------------------------------------- */
	.thread {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		scroll-behavior: smooth;
		overscroll-behavior: contain;
	}

	/* ---- Welcome (hero inside empty thread) ------------------------------ */
	.welcome {
		padding: clamp(12px, 2.4vh, 28px) 0 20px;
		animation: rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.orb {
		width: 54px;
		height: 54px;
		border-radius: 17px;
		display: grid;
		place-items: center;
		margin-bottom: 14px;
		color: var(--brand-ink);
		background: linear-gradient(140deg, var(--brand), color-mix(in srgb, var(--brand) 55%, #000));
		box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255, 255, 255, 0.25);
		position: relative;
	}
	.orb::after {
		content: '';
		position: absolute;
		inset: -20px;
		border-radius: 32px;
		background: radial-gradient(circle, var(--brand-soft), transparent 70%);
		z-index: -1;
	}
	.mono-lg {
		font-size: 24px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}
	.eyebrow {
		margin: 0 0 9px;
		font-size: 12.5px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--brand);
		text-transform: uppercase;
	}
	.hello {
		margin: 0 0 10px;
		font-size: clamp(1.25rem, 3.1vw, 1.85rem);
		line-height: 1.14;
		font-weight: 680;
		letter-spacing: -0.025em;
		max-width: 26ch;
		background: linear-gradient(180deg, var(--ink), color-mix(in srgb, var(--ink) 72%, var(--muted)));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.sub {
		margin: 0 0 18px;
		font-size: 0.98rem;
		line-height: 1.6;
		color: var(--ink-2);
		max-width: 48ch;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 9px;
		margin-bottom: 18px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 15px;
		border-radius: 999px;
		border: 1px solid var(--hair);
		background: var(--surface);
		color: var(--ink);
		font-size: 14px;
		font-weight: 500;
		box-shadow: var(--shadow);
		transition: transform 0.16s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.16s, color 0.16s;
	}
	.chip svg {
		color: var(--muted);
		transition: transform 0.2s, color 0.16s;
	}
	.chip:hover {
		transform: translateY(-2px);
		border-color: var(--brand-line);
		color: var(--brand);
	}
	.chip:hover svg {
		color: var(--brand);
		transform: translateX(2px);
	}

	/* ---- Featured ---------------------------------------------------------*/
	.feat-head {
		margin-bottom: 10px;
	}
	.label {
		font-size: 12px;
		font-weight: 640;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.feat-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}

	/* ---- Tour card ------------------------------------------------------- */
	.tour-card {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--hair);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
		overflow: hidden;
		transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s, border-color 0.2s;
	}
	.tour-card:hover {
		transform: translateY(-3px);
		box-shadow: var(--shadow-lg);
		border-color: var(--brand-line);
	}
	.tour-card.inline {
		margin: 14px 0 4px;
		max-width: 440px;
	}
	.tc-cover {
		position: relative;
		height: 116px;
		display: grid;
		place-items: center;
		color: var(--brand-ink);
		background: linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 45%, #1a1815));
		overflow: hidden;
	}
	.tc-cover::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(120% 120% at 85% -20%, rgba(255, 255, 255, 0.28), transparent 55%),
			repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0 12px, transparent 12px 24px);
	}
	.tc-mono {
		font-size: 30px;
		font-weight: 700;
		letter-spacing: 0.04em;
		opacity: 0.92;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
	}
	.tc-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: 0;
	}
	.tc-cover:has(.tc-img)::before {
		background: linear-gradient(180deg, rgba(0, 0, 0, 0) 38%, rgba(0, 0, 0, 0.5));
		z-index: 1;
	}
	.tc-badge {
		z-index: 2;
	}
	.tc-badge {
		position: absolute;
		top: 10px;
		right: 10px;
		font-size: 11px;
		font-weight: 600;
		padding: 4px 9px;
		border-radius: 999px;
		color: var(--brand-ink);
		background: rgba(0, 0, 0, 0.22);
		backdrop-filter: blur(4px);
	}
	.tc-body {
		padding: 14px 15px 6px;
		flex: 1;
	}
	.tc-title {
		margin: 0 0 5px;
		font-size: 15.5px;
		font-weight: 640;
		letter-spacing: -0.02em;
		line-height: 1.25;
	}
	.tc-sum {
		margin: 0 0 10px;
		font-size: 13px;
		line-height: 1.5;
		color: var(--ink-2);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.tc-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.tc-tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11.5px;
		font-weight: 550;
		padding: 4px 9px;
		border-radius: 999px;
		color: var(--ink-2);
		background: var(--brand-soft);
	}
	.tc-tag svg {
		color: var(--brand);
	}
	.tc-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 15px;
		margin-top: 8px;
		border-top: 1px solid var(--hair-2);
	}
	.tc-price {
		display: flex;
		align-items: baseline;
		gap: 4px;
		font-size: 15px;
	}
	.tc-price .from {
		font-size: 11px;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.tc-price strong {
		font-weight: 700;
		letter-spacing: -0.02em;
	}
	.tc-price .pp {
		font-size: 11px;
		color: var(--muted);
	}
	.tc-cta {
		border: 1px solid var(--brand-line);
		background: transparent;
		color: var(--brand);
		font-weight: 600;
		font-size: 13px;
		padding: 8px 14px;
		border-radius: 10px;
		transition: background 0.15s, transform 0.15s;
	}
	.tc-cta:hover {
		transform: translateY(-1px);
		background: var(--brand-soft);
	}
	.tc-cta.filled {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 0;
		text-decoration: none;
		color: var(--brand-ink);
		background: var(--brand);
		box-shadow: 0 6px 18px -8px color-mix(in srgb, var(--brand) 80%, transparent);
	}
	.tc-cta.filled:hover {
		filter: brightness(1.05);
	}
	.tc-avail {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 0 15px 13px;
		font-size: 12px;
		color: var(--ink-2);
	}
	.tc-avail .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #22a06b;
		box-shadow: 0 0 0 3px color-mix(in srgb, #22a06b 22%, transparent);
	}
	.tc-avail b {
		color: var(--brand);
		font-weight: 640;
	}

	/* ---- Turns ----------------------------------------------------------- */
	.turns {
		list-style: none;
		margin: 0;
		padding: 28px 0 20px;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.turn {
		display: flex;
		gap: 12px;
		animation: msg 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.turn.user {
		justify-content: flex-end;
	}
	.avatar {
		flex: none;
		width: 30px;
		height: 30px;
		border-radius: 9px;
		display: grid;
		place-items: center;
		margin-top: 2px;
		color: var(--brand-ink);
		background: linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 55%, #000));
		box-shadow: var(--shadow);
	}
	.mono-sm {
		font-size: 11px;
		font-weight: 700;
	}
	.bubble-wrap {
		min-width: 0;
		max-width: 88%;
	}
	.turn.user .bubble-wrap {
		max-width: 80%;
	}
	.bubble.user {
		background: var(--user-bg);
		border: 1px solid var(--brand-line);
		color: var(--ink);
		padding: 11px 15px;
		border-radius: 18px 18px 6px 18px;
		font-size: 15px;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
		box-shadow: var(--shadow);
	}
	.assistant-body {
		font-size: 15.5px;
		line-height: 1.62;
	}

	/* Prose (markdown) */
	.prose :global(p) {
		margin: 0 0 12px;
	}
	.prose :global(p:last-child) {
		margin-bottom: 0;
	}
	.prose :global(strong) {
		font-weight: 660;
	}
	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 12px;
		padding-left: 20px;
	}
	.prose :global(li) {
		margin: 4px 0;
	}
	.prose :global(a) {
		color: var(--brand);
		text-decoration: none;
		border-bottom: 1px solid var(--brand-line);
	}
	.prose :global(a:hover) {
		border-bottom-color: var(--brand);
	}
	.prose :global(code) {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.86em;
		padding: 1px 5px;
		border-radius: 5px;
		background: var(--bg-2);
		border: 1px solid var(--hair-2);
	}

	/* ---- Pricing card ---------------------------------------------------- */
	.pricing {
		margin: 14px 0 4px;
		max-width: 420px;
		border: 1px solid var(--hair);
		border-radius: 16px;
		background: var(--surface);
		box-shadow: var(--shadow);
		padding: 14px 16px;
	}
	.pr-title {
		font-weight: 640;
		margin-bottom: 10px;
		font-size: 14px;
	}
	.pr-row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 14px;
		padding: 7px 0;
		color: var(--ink-2);
		border-bottom: 1px dashed var(--hair-2);
	}
	.pr-row span:last-child {
		color: var(--ink);
		font-weight: 550;
	}
	.pr-total {
		display: flex;
		justify-content: space-between;
		margin-top: 10px;
		padding-top: 10px;
		font-size: 16px;
		font-weight: 700;
		letter-spacing: -0.02em;
		border-top: 1px solid var(--hair);
	}
	.pr-total span:last-child {
		color: var(--brand);
	}
	.pr-note {
		margin: 10px 0 0;
		font-size: 12px;
		color: var(--muted);
		line-height: 1.5;
	}

	/* ---- Itinerary timeline ---------------------------------------------- */
	.timeline {
		margin: 14px 0 4px;
		border: 1px solid var(--hair);
		border-radius: 16px;
		background: var(--surface);
		box-shadow: var(--shadow);
		padding: 16px 18px 8px;
	}
	.tl-title {
		font-weight: 640;
		font-size: 14px;
		margin-bottom: 12px;
	}
	.tl-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.tl-item {
		position: relative;
		display: flex;
		gap: 14px;
		padding-bottom: 18px;
	}
	.tl-item::before {
		content: '';
		position: absolute;
		left: 12px;
		top: 26px;
		bottom: -2px;
		width: 2px;
		background: linear-gradient(var(--brand-line), var(--hair-2));
	}
	.tl-item:last-child {
		padding-bottom: 4px;
	}
	.tl-item:last-child::before {
		display: none;
	}
	.tl-node {
		flex: none;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-size: 12px;
		font-weight: 700;
		color: var(--brand-ink);
		background: linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 60%, #000));
		box-shadow: 0 0 0 4px var(--surface), 0 0 0 5px var(--hair-2);
		z-index: 1;
	}
	.tl-day {
		font-weight: 620;
		font-size: 14.5px;
		margin-bottom: 2px;
		letter-spacing: -0.01em;
	}
	.tl-body {
		margin: 0;
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--ink-2);
	}
	.tl-raw {
		margin: 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--ink-2);
		white-space: pre-wrap;
	}

	/* ---- Destination ----------------------------------------------------- */
	.destination {
		position: relative;
		margin: 14px 0 4px;
		max-width: 440px;
		border-radius: 16px;
		border: 1px solid var(--hair);
		overflow: hidden;
		background: linear-gradient(135deg, color-mix(in srgb, var(--brand) 14%, var(--surface)), var(--surface));
		box-shadow: var(--shadow);
	}
	.ds-glow {
		position: absolute;
		width: 160px;
		height: 160px;
		right: -40px;
		top: -60px;
		border-radius: 50%;
		background: radial-gradient(circle, var(--brand-soft), transparent 70%);
	}
	.ds-body {
		position: relative;
		padding: 16px 18px;
	}
	.ds-kicker {
		font-size: 11px;
		font-weight: 640;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--brand);
	}
	.ds-name {
		margin: 4px 0 6px;
		font-size: 18px;
		font-weight: 680;
		letter-spacing: -0.02em;
	}
	.ds-note {
		margin: 0;
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--ink-2);
	}

	/* ---- Collapsible ----------------------------------------------------- */
	.collapsible {
		margin: 12px 0 4px;
		border: 1px solid var(--hair);
		border-radius: 14px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.cl-head {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 15px;
		background: none;
		border: 0;
		color: var(--ink);
		font-weight: 600;
		font-size: 14px;
		text-align: left;
	}
	.cl-caret {
		color: var(--muted);
		transition: transform 0.2s;
	}
	.collapsible.open .cl-caret {
		transform: rotate(180deg);
	}
	.cl-body {
		padding: 0 15px 14px;
		font-size: 14px;
		line-height: 1.6;
		color: var(--ink-2);
		animation: rise 0.28s ease both;
	}

	/* ---- Thinking -------------------------------------------------------- */
	.think {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-size: 13.5px;
		color: var(--muted);
		margin-bottom: 12px;
	}
	.think-dots {
		display: inline-flex;
		gap: 4px;
	}
	.think-dots i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--brand);
		animation: bounce 1.2s infinite ease-in-out;
	}
	.think-dots i:nth-child(2) {
		animation-delay: 0.16s;
	}
	.think-dots i:nth-child(3) {
		animation-delay: 0.32s;
	}
	.think-phrase {
		animation: fade 0.4s ease both;
		font-weight: 500;
	}
	.skel-bubble {
		display: flex;
		flex-direction: column;
		gap: 9px;
		max-width: 340px;
	}

	/* ---- Skeletons ------------------------------------------------------- */
	.skel-line {
		height: 11px;
		border-radius: 6px;
		background: var(--hair);
	}
	.skel-card {
		border: 1px solid var(--hair);
		border-radius: var(--radius);
		background: var(--surface);
		padding: 14px;
	}
	.skel-mono {
		height: 68px;
		border-radius: 12px;
		margin-bottom: 14px;
		background: var(--hair);
	}
	.skel-card .skel-line {
		margin-bottom: 9px;
	}
	.skel-foot {
		display: flex;
		justify-content: space-between;
		margin-top: 12px;
	}
	.skel-pill {
		width: 64px;
		height: 20px;
		border-radius: 999px;
		background: var(--hair);
	}
	.skel-btn {
		width: 74px;
		height: 30px;
		border-radius: 10px;
		background: var(--hair);
	}
	.shimmer {
		position: relative;
		overflow: hidden;
	}
	.shimmer::after {
		content: '';
		position: absolute;
		inset: 0;
		transform: translateX(-100%);
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--ink) 8%, transparent),
			transparent
		);
		animation: shimmer 1.5s infinite;
	}

	/* ---- Composer -------------------------------------------------------- */
	.composer {
		position: sticky;
		bottom: 0;
		z-index: 20;
		padding: 10px 0 max(14px, env(safe-area-inset-bottom));
		background: linear-gradient(180deg, transparent, var(--bg) 32%);
	}
	.bar {
		display: flex;
		align-items: flex-end;
		gap: 6px;
		padding: 8px 8px 8px 10px;
		border: 1px solid var(--hair);
		border-radius: 24px;
		background: var(--surface);
		box-shadow: var(--shadow-lg);
		transition: border-color 0.18s;
	}
	.bar:focus-within {
		border-color: var(--brand-line);
	}
	.bar textarea {
		flex: 1;
		border: 0;
		outline: none;
		resize: none;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 15.5px;
		line-height: 1.5;
		max-height: 180px;
		padding: 8px 4px;
	}
	.bar textarea::placeholder {
		color: var(--muted);
	}
	.ic-btn {
		flex: none;
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		border-radius: 12px;
		border: 0;
		background: transparent;
		color: var(--muted);
		transition: color 0.15s, background 0.15s;
	}
	.ic-btn:hover {
		color: var(--ink);
		background: var(--bg-2);
	}
	.ic-btn.mic.live {
		color: #e5484d;
		background: color-mix(in srgb, #e5484d 12%, transparent);
		animation: pulse 1.4s infinite;
	}
	.send {
		flex: none;
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border-radius: 13px;
		border: 0;
		color: var(--brand-ink);
		background: var(--brand);
		opacity: 0.4;
		transform: scale(0.94);
		transition: opacity 0.18s, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), filter 0.15s;
		box-shadow: 0 8px 20px -8px color-mix(in srgb, var(--brand) 70%, transparent);
	}
	.send.ready {
		opacity: 1;
		transform: scale(1);
	}
	.send.ready:hover {
		filter: brightness(1.06);
	}
	.send:disabled {
		cursor: default;
	}
	.fineprint {
		margin: 8px 4px 0;
		text-align: center;
		font-size: 11.5px;
		color: var(--muted);
	}
	.fineprint a {
		color: var(--ink-2);
		text-decoration: none;
		border-bottom: 1px solid var(--hair);
	}
	.fineprint a:hover {
		color: var(--brand);
	}

	/* ---- Attachment (gated, top tier) ------------------------------------- */
	.att-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		max-width: 100%;
		margin: 0 0 8px;
		padding: 6px 8px 6px 6px;
		border: 1px solid var(--hair);
		border-radius: 12px;
		background: var(--surface);
		box-shadow: var(--shadow);
	}
	.att-chip img {
		width: 34px;
		height: 34px;
		border-radius: 8px;
		object-fit: cover;
		flex: none;
	}
	.att-doc {
		width: 34px;
		height: 34px;
		border-radius: 8px;
		display: grid;
		place-items: center;
		font-size: 10px;
		font-weight: 700;
		color: var(--brand-ink);
		background: var(--brand);
		flex: none;
	}
	.att-name {
		font-size: 13px;
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 220px;
	}
	.att-x {
		flex: none;
		width: 22px;
		height: 22px;
		border-radius: 7px;
		border: 0;
		background: var(--bg-2);
		color: var(--muted);
		font-size: 12px;
		line-height: 1;
	}
	.att-x:hover {
		color: var(--ink);
	}
	.msg-att {
		display: block;
		max-width: 200px;
		max-height: 200px;
		border-radius: 12px;
		margin-bottom: 8px;
		border: 1px solid var(--hair);
	}

	/* ---- Floating booking action ----------------------------------------- */
	.fab {
		position: fixed;
		right: 16px;
		bottom: calc(96px + env(safe-area-inset-bottom));
		z-index: 15;
		width: 52px;
		height: 52px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		color: #fff;
		background: #25d366;
		box-shadow: 0 10px 30px -8px rgba(37, 211, 102, 0.6);
		transition: transform 0.18s;
	}
	.fab:hover {
		transform: scale(1.06);
	}
	@media (min-width: 900px) {
		.fab {
			bottom: 24px;
			right: 24px;
		}
	}

	/* ---- Motion ---------------------------------------------------------- */
	@keyframes rise {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: none; }
	}
	@keyframes msg {
		from { opacity: 0; transform: translateY(8px) scale(0.99); }
		to { opacity: 1; transform: none; }
	}
	@keyframes fade {
		from { opacity: 0; transform: translateY(3px); }
		to { opacity: 1; transform: none; }
	}
	@keyframes bounce {
		0%, 80%, 100% { transform: scale(0.5); opacity: 0.5; }
		40% { transform: scale(1); opacity: 1; }
	}
	@keyframes shimmer {
		100% { transform: translateX(100%); }
	}
	@keyframes pulse {
		0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, #e5484d 40%, transparent); }
		50% { box-shadow: 0 0 0 6px transparent; }
	}
	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after {
			animation-duration: 0.001ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.001ms !important;
			scroll-behavior: auto !important;
		}
	}

	/* Featured hero cards: image-forward + compact so the hero never scrolls */
	.tour-card.feat .tc-sum {
		display: none;
	}
	.tour-card.feat .tc-cover {
		height: 128px;
	}
	.tour-card.feat .tc-body {
		padding: 11px 14px 4px;
	}
	.tour-card.feat .tc-foot {
		padding: 10px 14px;
		margin-top: 6px;
	}

	@media (max-width: 480px) {
		.column { padding: 0 16px; }
		.bubble-wrap, .turn.user .bubble-wrap { max-width: 92%; }
		.feat-grid { grid-template-columns: 1fr; }
	}
</style>
