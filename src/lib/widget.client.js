/* Makutano Digital — embeddable site assistant.
 * One <script> tag, vanilla JS, no dependencies, renders in a shadow DOM so the
 * operator's CSS can't break it (and it can't break theirs). Keep it small and
 * framework-free — it must run on any site, however badly built.
 *
 *   <script src="https://ai.makutano.co.tz/widget.js" data-client="slug"></script>
 */
(function () {
	'use strict';

	// --- resolve config -----------------------------------------------------
	// Find our own <script> tag robustly. document.currentScript is null when the
	// tag is injected asynchronously (Wix Custom Code, Google Tag Manager, etc.),
	// and a naive "last script on the page" fallback then grabs an unrelated tag —
	// so also look it up by its data-client attribute and by src.
	function findSelf() {
		var cur = document.currentScript;
		if (cur && cur.getAttribute && cur.getAttribute('data-client')) return cur;
		var byAttr = document.querySelectorAll('script[data-client]');
		if (byAttr.length) return byAttr[byAttr.length - 1];
		var bySrc = document.querySelectorAll('script[src*="widget.js"]');
		if (bySrc.length) return bySrc[bySrc.length - 1];
		return cur || null;
	}
	var script = findSelf();
	var cfg = window.makutanoWidget || {}; // optional global fallback: {client, api}

	var CLIENT = (script && script.getAttribute && script.getAttribute('data-client')) || cfg.client;
	if (!CLIENT) {
		console.error('[makutano] missing data-client on the widget script tag');
		return;
	}
	// API base = the origin the widget was served from.
	var API = (script && script.src && new URL(script.src, location.href).origin) || cfg.api || location.origin;

	// --- state --------------------------------------------------------------
	var messages = []; // {role:'user'|'assistant', content}
	var brand = '#0f6e56';
	var whatsapp = null;
	var name = null;
	var open = false;
	var busy = false;
	// Claude-style "working" feedback: a cycling status line + shimmer skeleton,
	// so the customer sees the assistant taking action rather than a bare bouncing
	// dot. Industry-neutral phrases (the widget serves every vertical).
	var THINKING = ['Reading your message…', 'Searching the knowledge base…', 'Checking the details…', 'Putting together an answer…'];
	var thinkIx = 0;
	var thinkTimer = null;
	var leadCaptured = false;
	var leadOpen = false; // the optional contact form is open
	var capturePrompted = false;
	var conversationId = null; // stable id from the backend; ties every turn to one record
	// Loaded from /api/config (operator settings)
	var welcome = null;
	var suggestions = [];
	var autoLeadCapture = true;
	var hideBranding = false;
	var assistantName = null;
	var logo = null;
	var industry = 'tourism'; // from /api/config; drives the greeting

	// --- Greeting concierge state ------------------------------------------
	// A living, non-annoying introduction: after a short idle, the icon does one
	// gentle bounce and a speech bubble slides out; it auto-collapses, repeats a
	// couple of times, then rests. Fully client-side; respects reduced-motion,
	// stops on any interaction, and remembers a dismissal.
	var GREET_ENABLED = !(script && script.getAttribute && /^(off|false|0|no)$/i.test(script.getAttribute('data-greeting') || ''));
	var GK = 'mk_greet_' + CLIENT;
	var greetNode = null,
		greetShown = false,
		greetStopped = false;
	var greetTimers = { next: null, collapse: null };
	var lastActivity = Date.now();
	var returningVisitor = false;
	var customGreeting = null; // operator's own line (from /api/config) — wins when set
	var greetingEnabledCfg = true; // operator on/off toggle (from /api/config)
	// Industry base greetings — neutral, configurable; the widget serves every vertical.
	var INDUSTRY_GREET = {
		tourism: 'Planning your next adventure?',
		hotel: 'Looking for the perfect stay?',
		healthcare: 'How may I assist you today?',
		education: 'Need help finding the right programme?',
		government: 'Which service can I help you find?',
		retail: 'Looking for the perfect product?',
		realestate: 'Looking for the right property?',
		restaurant: 'Need help with the menu or a reservation?',
		services: 'How can we help you today?'
	};

	// Persist the conversation so a page reload doesn't lose it (2h TTL).
	var STORE_KEY = 'mk_chat_' + CLIENT;
	function saveState() {
		try {
			localStorage.setItem(STORE_KEY, JSON.stringify({ messages: messages, leadCaptured: leadCaptured, conversationId: conversationId, ts: Date.now() }));
		} catch (e) {}
	}
	(function restoreState() {
		try {
			var raw = localStorage.getItem(STORE_KEY);
			if (!raw) return;
			var saved = JSON.parse(raw);
			if (saved && saved.ts && Date.now() - saved.ts < 2 * 60 * 60 * 1000 && Array.isArray(saved.messages)) {
				messages = saved.messages;
				leadCaptured = !!saved.leadCaptured;
				conversationId = saved.conversationId || null;
				if (messages.length >= 2) capturePrompted = true;
			} else {
				localStorage.removeItem(STORE_KEY);
			}
		} catch (e) {}
	})();

	// --- shadow DOM host ----------------------------------------------------
	var host = document.createElement('div');
	host.setAttribute('data-makutano', '');
	(document.body || document.documentElement).appendChild(host);
	var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

	var style = document.createElement('style');
	style.textContent = css();
	root.appendChild(style);

	var container = document.createElement('div');
	container.className = 'mk';
	root.appendChild(container);
	render();
	loadConfig();

	// Fetch operator settings so we can greet with the right brand, welcome
	// message and suggested questions before the first message.
	function loadConfig() {
		fetch(API + '/api/config?client=' + encodeURIComponent(CLIENT))
			.then(function (r) { return r.json(); })
			.then(function (cfg) {
				// A definitive server response with an error (inactive client, or the
				// plan doesn't include the website widget) → remove the widget entirely.
				if (!cfg || cfg.error) { try { host.remove(); } catch (e) {} return; }
				brand = cfg.brand || brand;
				whatsapp = cfg.whatsapp || whatsapp;
				welcome = cfg.welcome || null;
				assistantName = cfg.assistantName || null;
				logo = cfg.logo || null;
				suggestions = Array.isArray(cfg.suggestions) ? cfg.suggestions : [];
				if (cfg.autoLeadCapture === false) autoLeadCapture = false;
				hideBranding = cfg.hideBranding === true;
				if (cfg.industry) industry = cfg.industry;
				if (cfg.greeting) customGreeting = String(cfg.greeting).slice(0, 160);
				if (cfg.greetingEnabled === false) greetingEnabledCfg = false;
				render();
				startGreeting();
			})
			.catch(function () {});
	}

	// --- greeting concierge -------------------------------------------------
	function lsGet(k) { try { return localStorage.getItem(GK + k); } catch (e) { return null; } }
	function lsSet(k, v) { try { localStorage.setItem(GK + k, v); } catch (e) {} }
	function ssGet(k) { try { return sessionStorage.getItem(GK + k); } catch (e) { return null; } }
	function ssSet(k, v) { try { sessionStorage.setItem(GK + k, v); } catch (e) {} }
	function reducedMotion() { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
	function sessCycles() { return parseInt(ssGet('_cyc') || '0', 10) || 0; }
	function onCheckout() { return /(checkout|payment|\/pay(\b|ment)|\/cart|billing|order-?confirm)/i.test(location.pathname + location.search); }
	function isTypingOrForm() {
		var a = document.activeElement;
		if (!a) return false;
		var tag = (a.tagName || '').toLowerCase();
		return tag === 'input' || tag === 'textarea' || tag === 'select' || a.isContentEditable === true;
	}
	function bumpActivity() { lastActivity = Date.now(); }

	// Page-context greeting (most specific wins). Returns null → fall through.
	function pageGreeting() {
		var s = ((location.pathname || '') + ' ' + (document.title || '')).toLowerCase();
		if (onCheckout()) return 'Have any questions before completing your purchase?';
		if (/pric|plan\b/.test(s)) return 'Need help choosing the right plan?';
		if (/demo|tour\b|trial/.test(s)) return 'Would you like a quick tour?';
		if (/feature|solution|product/.test(s)) return 'Want to see how we can help?';
		if (/contact|reach|get-in-touch/.test(s)) return 'Have questions before contacting us?';
		if (/faq|knowledge|help|support|docs|guide/.test(s)) return 'Need help finding information?';
		return null;
	}
	function timeHi() {
		var h = new Date().getHours();
		return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
	}
	function greetingText() {
		if (customGreeting) return customGreeting; // operator override — shown verbatim
		var page = pageGreeting();
		if (page) return page;
		if (returningVisitor) return 'Welcome back 👋 Need anything today?';
		return timeHi() + ' 👋 ' + (INDUSTRY_GREET[industry] || 'How can I help today?');
	}

	function startGreeting() {
		if (!GREET_ENABLED || !greetingEnabledCfg || greetStopped) return;
		if (lsGet('_dismissed') === '1') return; // respected across visits
		returningVisitor = lsGet('_seen') === '1';
		lsSet('_seen', '1');
		if (onCheckout()) return; // never interrupt a purchase
		if (sessCycles() >= 3) return; // at most a few teasers per session
		// Track host-page activity so we only greet when the visitor is idle.
		window.addEventListener('scroll', bumpActivity, { passive: true });
		window.addEventListener('keydown', bumpActivity, true);
		window.addEventListener('pointerdown', bumpActivity, true);
		armGreeting(3500 + Math.floor(Math.random() * 1500)); // first: 3.5–5s
	}
	function canGreetNow() {
		if (greetStopped || open || greetShown) return false;
		if (sessCycles() >= 3 || onCheckout()) return false;
		if (isTypingOrForm()) return false;
		if (Date.now() - lastActivity < 2500) return false; // recently scrolling/typing
		return true;
	}
	function armGreeting(delay) {
		clearTimeout(greetTimers.next);
		greetTimers.next = setTimeout(tryGreet, delay);
	}
	function tryGreet() {
		if (greetStopped) return;
		if (canGreetNow()) showGreeting();
		else armGreeting(1800); // wait for the visitor to settle
	}
	function showGreeting() {
		if (greetStopped || open) return;
		greetShown = true;
		ssSet('_cyc', String(sessCycles() + 1));
		buildGreetNode(greetingText());
		clearTimeout(greetTimers.collapse);
		greetTimers.collapse = setTimeout(collapseGreeting, 6000); // visible 6s
	}
	function collapseGreeting() {
		removeGreetNode();
		greetShown = false;
		if (greetStopped) return;
		if (sessCycles() >= 3) { greetStopped = true; return; }
		armGreeting(45000 + Math.floor(Math.random() * 45000)); // 45–90s until next
	}
	// Stop all greeting activity. dismissed=true persists across visits.
	function stopGreeting(dismissed) {
		greetStopped = true;
		clearTimeout(greetTimers.next);
		clearTimeout(greetTimers.collapse);
		removeGreetNode();
		greetShown = false;
		if (dismissed) lsSet('_dismissed', '1');
	}
	function buildGreetNode(text) {
		removeGreetNode();
		var g = document.createElement('div');
		g.className = 'mk-greet';
		g.innerHTML = '<span class="mk-greet-text"></span><button class="mk-greet-x" type="button" aria-label="Dismiss">' + svgXsmall() + '</button>';
		g.querySelector('.mk-greet-text').textContent = text;
		g.querySelector('.mk-greet-text').addEventListener('click', function () { stopGreeting(false); if (!open) toggle(); });
		g.querySelector('.mk-greet-x').addEventListener('click', function (e) { e.stopPropagation(); stopGreeting(true); });
		container.appendChild(g);
		greetNode = g;
		// One gentle bounce of the icon (skipped under reduced motion).
		var fab = container.querySelector('.mk-fab');
		if (fab && !reducedMotion()) { fab.classList.remove('mk-bounce'); void fab.offsetWidth; fab.classList.add('mk-bounce'); }
		// Trigger the width/opacity expand on the next frame.
		requestAnimationFrame(function () { requestAnimationFrame(function () { if (greetNode === g) g.classList.add('mk-greet-on'); }); });
	}
	function removeGreetNode() {
		if (!greetNode) return;
		var g = greetNode;
		greetNode = null;
		g.classList.remove('mk-greet-on');
		setTimeout(function () { try { g.remove(); } catch (e) {} }, 420);
	}

	// --- rendering ----------------------------------------------------------
	function render() {
		container.style.setProperty('--mk-brand', brand);
		container.innerHTML =
			(open
				? '<button class="mk-fab" aria-label="Close">' + svgClose() + '</button>'
				: '<button class="mk-fab" aria-label="Chat with the AI Assistant">' + svgChat() + '</button>') +
			(open ? panel() : '');
		container.querySelector('.mk-fab').addEventListener('click', toggle);

		if (open) {
			var closeBtn = container.querySelector('.mk-x');
			if (closeBtn) closeBtn.addEventListener('click', toggle);
			var form = container.querySelector('.mk-form');
			if (form) form.addEventListener('submit', onSend);
			var lead = container.querySelector('.mk-lead-form');
			if (lead) lead.addEventListener('submit', onLead);
			var leadOpenBtn = container.querySelector('.mk-lead-open');
			if (leadOpenBtn) leadOpenBtn.addEventListener('click', function () { leadOpen = true; render(); });
			var leadCancelBtn = container.querySelector('.mk-lead-cancel');
			if (leadCancelBtn) leadCancelBtn.addEventListener('click', function () { leadOpen = false; render(); });
			var chipEls = container.querySelectorAll('.mk-chip');
			for (var i = 0; i < chipEls.length; i++) {
				(function (el) {
					el.addEventListener('click', function () { sendText(el.getAttribute('data-q')); });
				})(chipEls[i]);
			}
			var log = container.querySelector('.mk-log');
			if (log) log.scrollTop = log.scrollHeight;

			// Chat textarea: auto-grow up to a few lines, Enter-to-send on desktop.
			// When empty we clear the inline height so CSS min-height gives exactly one
			// line — measuring scrollHeight before flexbox has set the width would let
			// the placeholder wrap and balloon the box.
			var ta = container.querySelector('.mk-form [name="q"]');
			if (ta) {
				var grow = function () {
					if (!ta.value) { ta.style.height = ''; return; }
					ta.style.height = 'auto';
					ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
				};
				ta.addEventListener('input', grow);
				ta.addEventListener('keydown', function (e) {
					if (e.key === 'Enter' && !e.shiftKey && !isMobileWidget()) { e.preventDefault(); sendText(ta.value); }
				});
				grow();
			}

			// Focus the input, but not on the mobile welcome screen — that would pop the
			// keyboard over the greeting and suggestion chips before they're read.
			var focusEl = container.querySelector('.mk-input');
			if (focusEl && !(isMobileWidget() && !messages.length && !leadOpen)) focusEl.focus();
		}
		saveState();
	}

	function chips() {
		if (messages.length || !suggestions.length) return '';
		var items = '';
		for (var i = 0; i < suggestions.length; i++) {
			items += '<button class="mk-chip" type="button" data-q="' + esc(suggestions[i]) + '">' + esc(suggestions[i]) + '</button>';
		}
		return '<div class="mk-chips">' + items + '</div>';
	}

	function panel() {
		var greeting = welcome || "Hi! Ask me anything and I'll answer from our real info.";
		var body = messages.length
			? messages
					.map(function (m) {
						return '<div class="mk-msg mk-' + m.role + '">' + (m.role === 'assistant' ? md(m.content) : esc(m.content)) + '</div>';
					})
					.join('')
			: '<div class="mk-msg mk-assistant">' + md(greeting) + '</div>' + chips();

		if (busy)
			body +=
				'<div class="mk-think"><span class="mk-think-dots"><i></i><i></i><i></i></span><span class="mk-think-phrase">' + esc(THINKING[thinkIx]) + '</span></div>' +
				'<div class="mk-msg mk-assistant mk-skel"><span class="mk-skel-line" style="width:92%"></span><span class="mk-skel-line" style="width:100%"></span><span class="mk-skel-line" style="width:58%"></span></div>';

		// Footer: the chat input is ALWAYS present so the customer can keep
		// replying. Lead capture is optional and non-blocking.
		var footer = '';

		// Optional contact form — only when the customer opens it.
		if (leadOpen && !leadCaptured) {
			footer +=
				'<form class="mk-lead-form">' +
				'<div class="mk-lead-title">Leave your details and we\'ll follow up:</div>' +
				'<input class="mk-input" name="name" placeholder="Your name" autocomplete="name" />' +
				'<input class="mk-input" name="whatsapp" placeholder="WhatsApp number" inputmode="tel" autocomplete="tel" />' +
				'<input class="mk-input" name="email" placeholder="Email (optional)" type="email" autocomplete="email" />' +
				'<div class="mk-lead-row">' +
				'<button class="mk-send" type="submit" style="flex:1">Send my details</button>' +
				'<button class="mk-lead-cancel" type="button">Cancel</button>' +
				'</div>' +
				'</form>';
		}

		// Slim, non-blocking action bar once the conversation is under way.
		if (!leadOpen && !leadCaptured && capturePrompted) {
			var actions = '';
			if (autoLeadCapture) actions += '<button class="mk-lead-open" type="button">Leave your details</button>';
			if (whatsapp) actions += '<a class="mk-wa-sm" href="' + waLink() + '" target="_blank" rel="noopener">Continue on WhatsApp</a>';
			if (actions) footer += '<div class="mk-actions">' + actions + '</div>';
		}

		// The chat input — always available. A growing textarea (like ChatGPT): Enter
		// sends on desktop, Shift+Enter (and the on-screen return key on mobile) makes
		// a new line.
		footer +=
			'<form class="mk-form">' +
			'<textarea class="mk-input mk-ta" name="q" rows="1" placeholder="Message…" autocomplete="off" ' +
			(busy ? 'disabled' : '') +
			'></textarea>' +
			'<button class="mk-send mk-send-round" type="submit" aria-label="Send" ' + (busy ? 'disabled' : '') + '>' + svgSend() + '</button>' +
			'</form>';

		if (leadCaptured && whatsapp) {
			footer += '<a class="mk-wa mk-wa-inline" href="' + waLink() + '" target="_blank" rel="noopener">Continue on WhatsApp</a>';
		}

		var avatar = logo
			? '<img class="mk-avatar" src="' + esc(logo) + '" alt="" />'
			: '<span class="mk-avatar mk-avatar-fb">' + esc((assistantName || name || '?').charAt(0).toUpperCase()) + '</span>';
		var pageUrl = API + '/c/' + encodeURIComponent(CLIENT);
		var head =
			'<div class="mk-head">' +
			'<div class="mk-head-id">' + avatar +
			'<div class="mk-head-text"><div class="mk-head-name">' + esc(assistantName || 'Assistant') + '</div>' +
			(name ? '<div class="mk-head-sub"><span class="mk-dot"></span>' + esc(name) + '</div>' : '') +
			'</div></div>' +
			'<div class="mk-head-actions">' +
			'<a class="mk-open" href="' + esc(pageUrl) + '" target="_blank" rel="noopener" aria-label="Open full page" title="Open the full assistant page">' + svgExpand() + '</a>' +
			'<button class="mk-x" aria-label="Close">' + svgClose() + '</button>' +
			'</div>' +
			'</div>';

		return (
			'<div class="mk-panel">' +
			head +
			'<div class="mk-log">' + body + '</div>' +
			footer +
			(hideBranding ? '' : '<div class="mk-powered">Powered by <a href="https://ai.makutano.co.tz" target="_blank" rel="noopener">Makutano</a></div>') +
			'</div>'
		);
	}

	// --- interaction --------------------------------------------------------
	// Lock the host page's scroll while the full-screen mobile chat is open, so
	// scrolling the chat doesn't drag the page behind it. position:fixed is the
	// iOS-safe method; we save/restore the page's own inline styles + scroll pos.
	var scrollLock = { active: false, y: 0, prev: null };
	function isMobileWidget() {
		try {
			return window.matchMedia('(max-width:480px)').matches;
		} catch (e) {
			return false;
		}
	}
	function lockScroll() {
		if (scrollLock.active || !isMobileWidget()) return;
		scrollLock.y = window.scrollY || document.documentElement.scrollTop || 0;
		var b = document.body;
		scrollLock.prev = { position: b.style.position, top: b.style.top, width: b.style.width, overflow: b.style.overflow };
		b.style.position = 'fixed';
		b.style.top = -scrollLock.y + 'px';
		b.style.width = '100%';
		b.style.overflow = 'hidden';
		scrollLock.active = true;
	}
	function unlockScroll() {
		if (!scrollLock.active) return;
		var b = document.body,
			p = scrollLock.prev || {};
		b.style.position = p.position || '';
		b.style.top = p.top || '';
		b.style.width = p.width || '';
		b.style.overflow = p.overflow || '';
		window.scrollTo(0, scrollLock.y);
		scrollLock.active = false;
	}

	function toggle() {
		open = !open;
		if (open) { lockScroll(); stopGreeting(false); }
		else unlockScroll();
		render();
	}

	function onSend(e) {
		e.preventDefault();
		var input = container.querySelector('.mk-form [name="q"]');
		sendText(input ? input.value : '');
	}

	// The page the customer is currently on, so the assistant can answer about it
	// even before it's been imported. innerText excludes our shadow-DOM widget.
	function pageContext() {
		var text = '';
		try { text = ((document.body && document.body.innerText) || '').replace(/\s+/g, ' ').trim().slice(0, 1000); } catch (e) {}
		return { url: location.href.slice(0, 500), title: (document.title || '').slice(0, 200), excerpt: text };
	}

	// Cycle the "working" status phrase in place (no full re-render, so the input
	// and scroll stay put). Re-triggers the fade each time via a reflow.
	function startThinking() {
		thinkIx = 0;
		clearInterval(thinkTimer);
		thinkTimer = setInterval(function () {
			thinkIx = (thinkIx + 1) % THINKING.length;
			var el = container.querySelector('.mk-think-phrase');
			if (el) {
				el.textContent = THINKING[thinkIx];
				el.style.animation = 'none';
				void el.offsetWidth;
				el.style.animation = 'mkfade .35s ease both';
			}
		}, 1700);
	}
	function stopThinking() {
		clearInterval(thinkTimer);
		thinkTimer = null;
	}

	function sendText(q) {
		q = (q || '').trim();
		if (busy || !q) return;
		stopGreeting(false);
		messages.push({ role: 'user', content: q });
		busy = true;
		startThinking();
		render();

		fetch(API + '/api/chat', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ clientSlug: CLIENT, messages: messages, conversationId: conversationId, page: pageContext() })
		})
			.then(function (r) { return r.json(); })
			.then(function (data) {
				busy = false;
				stopThinking();
				if (data && data.conversationId) conversationId = data.conversationId;
				if (data && data.answer) {
					messages.push({ role: 'assistant', content: data.answer });
					if (data.client) {
						brand = data.client.brand || brand;
						whatsapp = data.client.whatsapp || null;
						name = data.client.name || null;
					}
					// After two assistant replies, invite lead capture.
					if (messages.filter(function (m) { return m.role === 'assistant'; }).length >= 2) {
						capturePrompted = true;
					}
				} else {
					messages.push({ role: 'assistant', content: 'Sorry — I had trouble answering that. Please try again.' });
				}
				render();			})
			.catch(function () {
				busy = false;
				stopThinking();
				messages.push({ role: 'assistant', content: 'Connection problem. Please try again.' });
				render();			});
	}

	function onLead(e) {
		e.preventDefault();
		var f = e.target;
		var nameEl = f.elements['name'];
		var waEl = f.elements['whatsapp'];
		var emailEl = f.elements['email'];
		var lead = {
			clientSlug: CLIENT,
			name: ((nameEl && nameEl.value) || '').trim(),
			whatsapp: ((waEl && waEl.value) || '').trim(),
			email: ((emailEl && emailEl.value) || '').trim(),
			interest: lastUserMessage(),
			transcript: messages
		};
		// Need at least one way to reach them.
		if (!lead.whatsapp && !lead.email) {
			if (waEl) { waEl.setAttribute('placeholder', 'Add a WhatsApp number or email'); waEl.focus(); }
			return;
		}
		name = lead.name || name;
		leadCaptured = true;
		leadOpen = false;
		render();
		fetch(API + '/api/leads', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(lead)
		}).catch(function () {
			/* lead saved server-side is best-effort from the widget's view */
		});

		messages.push({
			role: 'assistant',
			content: 'Thanks' + (name ? ', ' + name : '') + '! The team will be in touch shortly.'
		});
		render();	}

	function lastUserMessage() {
		for (var i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === 'user') return messages[i].content;
		}
		return '';
	}

	// Carry the chat context into WhatsApp so the operator opens a message that
	// already contains the recent back-and-forth — the customer's questions AND the
	// assistant's answers — not just the questions.
	function waClean(s) {
		return String(s || '')
			.replace(/\*\*([^*]+)\*\*/g, '$1') // bold
			.replace(/`([^`]+)`/g, '$1') // code
			.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)') // [text](url)
			.replace(/[#*_>]/g, '') // stray markdown
			.replace(/\s+/g, ' ') // flatten each turn to one line
			.trim();
	}
	function conversationContext() {
		var head = 'Hi' + (name ? ', ' + name : '') + '! I was just chatting with ' + (assistantName || 'your assistant') + ' on your website.';
		var aiLabel = assistantName || 'Assistant';
		// A short transcript of the recent exchange (both sides), each turn trimmed.
		var recent = messages.slice(-6); // ~3 back-and-forths
		var lines = [];
		for (var i = 0; i < recent.length; i++) {
			var m = recent[i];
			var t = waClean(m.content);
			if (!t) continue;
			var cap = m.role === 'assistant' ? 220 : 160;
			if (t.length > cap) t = t.slice(0, cap).replace(/\s+\S*$/, '') + '…';
			lines.push((m.role === 'user' ? 'Me' : aiLabel) + ': ' + t);
		}
		if (!lines.length) return head + ' I have a question — can you help?';
		var tail = '\n\nCould you help me continue from here?';
		var MAX = 1200;
		var build = function () { return head + "\n\nHere's our conversation so far:\n\n" + lines.join('\n') + tail; };
		// Keep the most recent turns; drop from the front until it fits WhatsApp.
		while (lines.length > 1 && build().length > MAX) lines.shift();
		var msg = build();
		return msg.length > MAX ? msg.slice(0, MAX) : msg;
	}
	function waLink() {
		var num = (whatsapp || '').replace(/[^0-9]/g, '');
		return 'https://wa.me/' + num + '?text=' + encodeURIComponent(conversationContext());
	}

	// --- helpers ------------------------------------------------------------
	function esc(s) {
		return String(s).replace(/[&<>"]/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
		});
	}

	// Minimal, safe markdown → HTML for assistant messages. Escapes first, then
	// only inserts tags we control (bold, italic, code, links, lists, paragraphs).
	function md(raw) {
		var s = esc(raw);
		s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
		s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
		s = s.replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*/g, '$1<em>$2</em>');
		s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
		s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (m, pre, url) {
			return pre + '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>';
		});
		var lines = s.split('\n');
		var out = '', listType = null, para = [];
		function flushPara() { if (para.length) { out += '<p>' + para.join('<br>') + '</p>'; para = []; } }
		function flushList() { if (listType) { out += '</' + listType + '>'; listType = null; } }
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			var ul = line.match(/^\s*[-*]\s+(.*)$/);
			var ol = line.match(/^\s*\d+\.\s+(.*)$/);
			if (ul) { flushPara(); if (listType !== 'ul') { flushList(); out += '<ul>'; listType = 'ul'; } out += '<li>' + ul[1] + '</li>'; }
			else if (ol) { flushPara(); if (listType !== 'ol') { flushList(); out += '<ol>'; listType = 'ol'; } out += '<li>' + ol[1] + '</li>'; }
			else if (line.trim() === '') { flushList(); flushPara(); }
			else { flushList(); para.push(line.replace(/^#{1,6}\s+/, '')); }
		}
		flushList();
		flushPara();
		return out || esc(raw);
	}
	function svgChat() {
		return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
	}
	function svgClose() {
		return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
	}
	function svgXsmall() {
		return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
	}
	function svgSend() {
		return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>';
	}
	function svgExpand() {
		return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
	}

	function css() {
		return (
			// font-size:16px fixes the widget's own base so all em units resolve from
			// it — NOT from the host page's root font-size (which on some sites is
			// large and would blow the whole widget up like a high zoom level).
			'.mk{position:fixed;bottom:20px;right:20px;z-index:2147483000;color-scheme:light;font-size:16px;line-height:1.4;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}' +
			'.mk-fab{width:58px;height:58px;border-radius:50%;border:0;background:var(--mk-brand);color:#fff;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;margin-left:auto;transition:transform .15s ease}' +
			'.mk-fab:hover{transform:scale(1.06)}' +
			'.mk-fab-pill{width:auto;height:56px;border-radius:28px;padding:0 20px 0 15px;gap:9px}' +
			'.mk-fab-label{font-weight:700;font-size:.95em;white-space:nowrap;line-height:1}' +
			// Greeting concierge — a speech bubble that expands horizontally out of
			// the icon (width + opacity), auto-collapses, and rests. Elegant + minimal.
			'.mk-greet{position:absolute;bottom:8px;right:70px;box-sizing:border-box;width:max-content;max-width:0;opacity:0;transform:translateX(10px);overflow:hidden;display:flex;align-items:center;gap:6px;background:#fff;color:#1c2b26;border:1px solid #e6ece8;border-radius:22px;box-shadow:0 8px 26px rgba(0,0,0,.16);padding:0;pointer-events:none;transition:max-width .5s cubic-bezier(.22,.7,.2,1),opacity .35s ease,transform .5s cubic-bezier(.22,.7,.2,1),padding .5s cubic-bezier(.22,.7,.2,1)}' +
			'.mk-greet-on{max-width:270px;opacity:1;transform:none;padding:9px 8px 9px 15px;pointer-events:auto}' +
			'.mk-greet-text{font-size:.9em;font-weight:600;line-height:1.32;cursor:pointer;white-space:normal}' +
			'.mk-greet-x{flex:none;width:22px;height:22px;border-radius:50%;border:0;background:rgba(0,0,0,.05);color:#6b7c75;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}' +
			'.mk-greet-x:hover{background:rgba(0,0,0,.11);color:#1c2b26}' +
			'.mk-bounce{animation:mkbounce .75s cubic-bezier(.28,.84,.42,1)}' +
			'@keyframes mkbounce{0%,100%{transform:translateY(0)}25%{transform:translateY(-8px)}45%{transform:translateY(0)}62%{transform:translateY(-4px)}80%{transform:translateY(0)}}' +
			'@media (prefers-reduced-motion:reduce){.mk-greet{transition:opacity .2s ease}.mk-bounce{animation:none}}' +
			'.mk-panel{position:absolute;bottom:70px;right:0;width:392px;max-width:calc(100vw - 24px);height:620px;max-height:calc(100vh - 96px);background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden}' +
			'.mk-head{background:var(--mk-brand);color:#fff;padding:.7em .85em;display:flex;align-items:center;justify-content:space-between;gap:.5em}' +
			'.mk-head-id{display:flex;align-items:center;gap:.55em;min-width:0}' +
			'.mk-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;background:rgba(255,255,255,.2)}' +
			'.mk-avatar-fb{display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.95em;color:#fff}' +
			'.mk-head-text{min-width:0}' +
			'.mk-head-name{font-weight:700;font-size:.95em;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
			'.mk-head-sub{font-size:.72em;opacity:.9;display:flex;align-items:center;gap:.3em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
			'.mk-dot{width:7px;height:7px;border-radius:50%;background:#8ff0c0;box-shadow:0 0 6px #8ff0c0;flex-shrink:0}' +
			'.mk-x{background:transparent;border:0;color:#fff;cursor:pointer;padding:.3em;display:flex;border-radius:6px}' +
			'.mk-x:hover{background:rgba(255,255,255,.15)}' +
			'.mk-head-actions{display:flex;align-items:center;gap:.1em;flex-shrink:0}' +
			'.mk-open{background:transparent;border:0;color:#fff;cursor:pointer;padding:.3em;display:flex;border-radius:6px;text-decoration:none;opacity:.92}' +
			'.mk-open:hover{background:rgba(255,255,255,.15);opacity:1}' +
			'.mk-log{flex:1;overflow-y:auto;padding:.9em;display:flex;flex-direction:column;gap:.55em;background:#f6f8f7}' +
			'.mk-msg{max-width:84%;padding:.6em .8em;border-radius:14px;font-size:.9em;line-height:1.45;white-space:normal;word-wrap:break-word;box-shadow:0 1px 2px rgba(0,0,0,.05)}' +
			'.mk-msg p{margin:0 0 .5em}.mk-msg p:last-child{margin-bottom:0}' +
			'.mk-msg ul,.mk-msg ol{margin:.3em 0;padding-left:1.15em}.mk-msg li{margin:.12em 0}' +
			'.mk-msg strong{font-weight:700}.mk-msg code{background:rgba(0,0,0,.06);padding:.05em .3em;border-radius:4px;font-size:.85em;font-family:ui-monospace,Menlo,monospace}' +
			'.mk-msg a{text-decoration:underline}.mk-assistant a{color:var(--mk-brand)}.mk-user a{color:#fff}' +
			'.mk-user{white-space:pre-wrap}' +
			'.mk-powered{text-align:center;font-size:.68em;color:#9aa8a2;padding:.35em;background:#fff;border-top:1px solid #eef2f0}' +
			'.mk-powered a{color:#6b7c75;text-decoration:none;font-weight:600}' +
			'.mk-chips{display:flex;flex-wrap:wrap;gap:.4em;margin-top:.1em}' +
			'.mk-chip{border:1px solid rgba(0,0,0,.1);background:#fff;color:var(--mk-brand);border-radius:999px;padding:.4em .7em;font:inherit;font-size:.82em;font-weight:600;line-height:1.15;cursor:pointer;text-align:left}' +
			'.mk-chip:hover{background:#f4f8f6;border-color:var(--mk-brand)}' +
			'.mk-user{align-self:flex-end;background:var(--mk-brand);color:#fff;border-bottom-right-radius:4px}' +
			'.mk-assistant{align-self:flex-start;background:#fff;color:#1c2b26;border:1px solid #e2e8e4;border-bottom-left-radius:4px}' +
			'.mk-log>.mk-msg:last-child{animation:mkin .26s ease}' +
			'@keyframes mkin{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
			'@media (prefers-reduced-motion:reduce){.mk-log>.mk-msg:last-child{animation:none}}' +
			// "Working" feedback — a cycling status line + a shimmering answer
			// skeleton (Claude style), instead of a bare bouncing dot.
			'.mk-think{align-self:flex-start;display:flex;align-items:center;gap:7px;font-size:.8em;color:#6f7a74;padding:2px 2px 1px}' +
			'.mk-think-dots{display:inline-flex;gap:3px}' +
			'.mk-think-dots i{width:5px;height:5px;border-radius:50%;background:var(--mk-brand);animation:mkpulse 1.2s infinite ease-in-out}' +
			'.mk-think-dots i:nth-child(2){animation-delay:.16s}.mk-think-dots i:nth-child(3){animation-delay:.32s}' +
			'@keyframes mkpulse{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}' +
			'.mk-think-phrase{font-weight:500;animation:mkfade .35s ease both}' +
			'@keyframes mkfade{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}' +
			'.mk-skel{display:flex;flex-direction:column;gap:7px;min-width:150px}' +
			'.mk-skel-line{height:9px;border-radius:5px;background:linear-gradient(90deg,#eef1ef 25%,#dfe6e1 37%,#eef1ef 63%);background-size:400% 100%;animation:mkshim 1.3s ease infinite}' +
			'@keyframes mkshim{0%{background-position:100% 0}100%{background-position:-100% 0}}' +
			'@media (prefers-reduced-motion:reduce){.mk-skel-line{animation:none}.mk-think-dots i{animation:none;opacity:.6}}' +
			'.mk-form{display:flex;gap:.5em;padding:.6em;border-top:1px solid #e2e8e4;background:#fff;align-items:flex-end}' +
			'.mk-ta{box-sizing:border-box;min-height:40px;resize:none;max-height:120px;overflow-y:auto;line-height:1.4;border-radius:20px;padding:.6em .85em}' +
			'.mk-lead-form{display:flex;flex-direction:column;gap:.45em;padding:.7em;border-top:1px solid #e2e8e4;background:#fff}' +
			'.mk-lead-title{font-size:.82em;color:#6b7c75}' +
			'.mk-lead-row{display:flex;gap:.4em}' +
			'.mk-lead-cancel{background:transparent;border:1px solid #e2e8e4;color:#6b7c75;border-radius:8px;padding:0 .8em;cursor:pointer;font:inherit;font-size:.85em}' +
			'.mk-actions{display:flex;gap:.4em;padding:.55em .6em 0}' +
			'.mk-lead-open{flex:1;border:1px solid var(--mk-brand);background:#fff;color:var(--mk-brand);border-radius:8px;padding:.5em;font:inherit;font-size:.82em;font-weight:600;cursor:pointer}' +
			'.mk-lead-open:hover{background:#f4f8f6}' +
			'.mk-wa-sm{flex:1;text-align:center;background:#25d366;color:#fff;text-decoration:none;border-radius:8px;padding:.5em;font-size:.82em;font-weight:600}' +
			'.mk-input{flex:1;padding:.55em .65em;border:1px solid #e2e8e4;border-radius:8px;font:inherit;font-size:.9em;outline:none;background:#fff;color:#1c2b26}' +
			'.mk-input::placeholder{color:#9aa8a2}' +
			'.mk-input:focus{border-color:var(--mk-brand)}' +
			'.mk-send{border:0;background:var(--mk-brand);color:#fff;border-radius:8px;padding:0 .8em;cursor:pointer;display:flex;align-items:center;justify-content:center;font:inherit;font-weight:600}' +
			'.mk-send-round{border-radius:50%;width:40px;height:40px;padding:0;flex-shrink:0}' +
			'.mk-send:disabled{opacity:.5;cursor:default}' +
			'.mk-wa{display:block;text-align:center;background:#25d366;color:#fff;text-decoration:none;padding:.5em;border-radius:8px;font-size:.88em;font-weight:600}' +
			'.mk-wa-inline{margin:.6em;margin-top:0}' +
			// Mobile: a full-screen native sheet. dvh dodges the URL-bar resize,
			// safe-area insets clear the notch/home indicator, 16px input stops
			// iOS zoom-on-focus.
			'@media (max-width:480px){' +
			'.mk{bottom:16px;right:16px}' +
			// Mobile: compact greeting that never crowds the screen or hides page buttons.
			'.mk-greet{right:62px;bottom:6px}' +
			'.mk-greet-on{max-width:190px;padding:8px 7px 8px 13px}' +
			'.mk-greet-text{font-size:13px}' +
			'.mk-panel{position:fixed;inset:0;width:100%;height:100vh;height:100dvh;max-width:none;max-height:none;border-radius:0;padding-bottom:env(safe-area-inset-bottom)}' +
			// Slightly more compact on small screens so nothing feels oversized.
			'.mk-head{padding:calc(.8em + env(safe-area-inset-top)) 14px .8em}' +
			'.mk-avatar{width:34px;height:34px}' +
			'.mk-head-name{font-size:15px}' +
			'.mk-log{padding:13px;gap:8px}' +
			'.mk-msg{max-width:88%;font-size:14px;line-height:1.5}' +
			'.mk-form{padding:10px 11px}' +
			'.mk-actions{padding:9px 10px 0;gap:8px}' +
			'.mk-lead-open,.mk-wa-sm{padding:10px 8px;font-size:13px;line-height:1.25}' +
			'.mk-input{font-size:16px}' + // 16px stops iOS zoom-on-focus
			'.mk-ta{max-height:140px}' +
			'.mk-send-round{width:44px;height:44px}' +
			'.mk-fab{width:52px;height:52px}' +
			// Mobile: a compact icon-only circle (no label) that sits like a native
			// WhatsApp-style floating button.
			'.mk-fab-pill{width:52px;height:52px;border-radius:50%;padding:0;gap:0}' +
			'.mk-fab-label{display:none}' +
			// The full-screen panel has its own header ✕ — hide the redundant floating
			// close button (the open-state FAB) so it doesn't peek behind the header.
			'.mk-fab:not(.mk-fab-pill){display:none}' +
			'}'
		);
	}
})();
