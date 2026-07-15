/* Makutano Digital — embeddable site assistant.
 * One <script> tag, vanilla JS, no dependencies, renders in a shadow DOM so the
 * operator's CSS can't break it (and it can't break theirs). Keep it small and
 * framework-free — it must run on any site, however badly built.
 *
 *   <script src="https://app.makutano.digital/widget.js" data-client="slug"></script>
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
				render();
			})
			.catch(function () {});
	}

	// --- rendering ----------------------------------------------------------
	function render() {
		container.style.setProperty('--mk-brand', brand);
		container.innerHTML =
			'<button class="mk-fab" aria-label="Chat">' + (open ? svgClose() : svgChat()) + '</button>' +
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
			var input = container.querySelector('.mk-input');
			if (input) input.focus();
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

		if (busy) body += '<div class="mk-msg mk-assistant mk-typing"><span></span><span></span><span></span></div>';

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

		// The chat input — always available.
		footer +=
			'<form class="mk-form">' +
			'<input class="mk-input" name="q" placeholder="Type your reply…" autocomplete="off" ' +
			(busy ? 'disabled' : '') +
			' />' +
			'<button class="mk-send" type="submit" ' + (busy ? 'disabled' : '') + '>' + svgSend() + '</button>' +
			'</form>';

		if (leadCaptured && whatsapp) {
			footer += '<a class="mk-wa mk-wa-inline" href="' + waLink() + '" target="_blank" rel="noopener">Continue on WhatsApp</a>';
		}

		var avatar = logo
			? '<img class="mk-avatar" src="' + esc(logo) + '" alt="" />'
			: '<span class="mk-avatar mk-avatar-fb">' + esc((assistantName || name || '?').charAt(0).toUpperCase()) + '</span>';
		var head =
			'<div class="mk-head">' +
			'<div class="mk-head-id">' + avatar +
			'<div class="mk-head-text"><div class="mk-head-name">' + esc(assistantName || 'Assistant') + '</div>' +
			(name ? '<div class="mk-head-sub"><span class="mk-dot"></span>' + esc(name) + '</div>' : '') +
			'</div></div>' +
			'<button class="mk-x" aria-label="Close">' + svgClose() + '</button>' +
			'</div>';

		return (
			'<div class="mk-panel">' +
			head +
			'<div class="mk-log">' + body + '</div>' +
			footer +
			(hideBranding ? '' : '<div class="mk-powered">Powered by <a href="https://makutano.digital" target="_blank" rel="noopener">Makutano</a></div>') +
			'</div>'
		);
	}

	// --- interaction --------------------------------------------------------
	function toggle() {
		open = !open;
		render();
	}

	function onSend(e) {
		e.preventDefault();
		var input = container.querySelector('.mk-input');
		sendText(input ? input.value : '');
	}

	function sendText(q) {
		q = (q || '').trim();
		if (busy || !q) return;
		messages.push({ role: 'user', content: q });
		busy = true;
		render();

		fetch(API + '/api/chat', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ clientSlug: CLIENT, messages: messages, conversationId: conversationId })
		})
			.then(function (r) { return r.json(); })
			.then(function (data) {
				busy = false;
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

	function waLink() {
		var num = (whatsapp || '').replace(/[^0-9]/g, '');
		var ctx = 'Hi' + (name ? ' from ' + name : '') + ', I was chatting with your site assistant';
		var last = lastUserMessage();
		if (last) ctx += ' about: ' + last;
		return 'https://wa.me/' + num + '?text=' + encodeURIComponent(ctx);
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
	function svgSend() {
		return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>';
	}

	function css() {
		return (
			'.mk{position:fixed;bottom:20px;right:20px;z-index:2147483000;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}' +
			'.mk-fab{width:58px;height:58px;border-radius:50%;border:0;background:var(--mk-brand);color:#fff;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;margin-left:auto;transition:transform .15s ease}' +
			'.mk-fab:hover{transform:scale(1.06)}' +
			'.mk-panel{position:absolute;bottom:70px;right:0;width:392px;max-width:calc(100vw - 24px);height:620px;max-height:calc(100vh - 96px);background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden}' +
			'.mk-head{background:var(--mk-brand);color:#fff;padding:.7rem .85rem;display:flex;align-items:center;justify-content:space-between;gap:.5rem}' +
			'.mk-head-id{display:flex;align-items:center;gap:.55rem;min-width:0}' +
			'.mk-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;background:rgba(255,255,255,.2)}' +
			'.mk-avatar-fb{display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.95rem;color:#fff}' +
			'.mk-head-text{min-width:0}' +
			'.mk-head-name{font-weight:700;font-size:.95rem;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
			'.mk-head-sub{font-size:.72rem;opacity:.9;display:flex;align-items:center;gap:.3rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
			'.mk-dot{width:7px;height:7px;border-radius:50%;background:#8ff0c0;box-shadow:0 0 6px #8ff0c0;flex-shrink:0}' +
			'.mk-x{background:transparent;border:0;color:#fff;cursor:pointer;padding:.2rem;display:flex;border-radius:6px}' +
			'.mk-x:hover{background:rgba(255,255,255,.15)}' +
			'.mk-log{flex:1;overflow-y:auto;padding:.9rem;display:flex;flex-direction:column;gap:.55rem;background:#f6f8f7}' +
			'.mk-msg{max-width:84%;padding:.6rem .8rem;border-radius:14px;font-size:.9rem;line-height:1.45;white-space:normal;word-wrap:break-word;box-shadow:0 1px 2px rgba(0,0,0,.05)}' +
			'.mk-msg p{margin:0 0 .5rem}.mk-msg p:last-child{margin-bottom:0}' +
			'.mk-msg ul,.mk-msg ol{margin:.3rem 0;padding-left:1.15rem}.mk-msg li{margin:.12rem 0}' +
			'.mk-msg strong{font-weight:700}.mk-msg code{background:rgba(0,0,0,.06);padding:.05rem .3rem;border-radius:4px;font-size:.85em;font-family:ui-monospace,Menlo,monospace}' +
			'.mk-msg a{text-decoration:underline}.mk-assistant a{color:var(--mk-brand)}.mk-user a{color:#fff}' +
			'.mk-user{white-space:pre-wrap}' +
			'.mk-powered{text-align:center;font-size:.68rem;color:#9aa8a2;padding:.35rem;background:#fff;border-top:1px solid #eef2f0}' +
			'.mk-powered a{color:#6b7c75;text-decoration:none;font-weight:600}' +
			'.mk-chips{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.1rem}' +
			'.mk-chip{border:1px solid rgba(0,0,0,.1);background:#fff;color:var(--mk-brand);border-radius:999px;padding:.4rem .7rem;font:inherit;font-size:.82rem;font-weight:600;line-height:1.15;cursor:pointer;text-align:left}' +
			'.mk-chip:hover{background:#f4f8f6;border-color:var(--mk-brand)}' +
			'.mk-user{align-self:flex-end;background:var(--mk-brand);color:#fff;border-bottom-right-radius:4px}' +
			'.mk-assistant{align-self:flex-start;background:#fff;color:#1c2b26;border:1px solid #e2e8e4;border-bottom-left-radius:4px}' +
			'.mk-typing{display:flex;gap:4px;align-items:center}' +
			'.mk-typing span{width:6px;height:6px;border-radius:50%;background:#9aa;animation:mkb 1s infinite}' +
			'.mk-typing span:nth-child(2){animation-delay:.15s}.mk-typing span:nth-child(3){animation-delay:.3s}' +
			'@keyframes mkb{0%,60%,100%{opacity:.3}30%{opacity:1}}' +
			'.mk-form{display:flex;gap:.4rem;padding:.6rem;border-top:1px solid #e2e8e4;background:#fff}' +
			'.mk-lead-form{display:flex;flex-direction:column;gap:.45rem;padding:.7rem;border-top:1px solid #e2e8e4;background:#fff}' +
			'.mk-lead-title{font-size:.82rem;color:#6b7c75}' +
			'.mk-lead-row{display:flex;gap:.4rem}' +
			'.mk-lead-cancel{background:transparent;border:1px solid #e2e8e4;color:#6b7c75;border-radius:8px;padding:0 .8rem;cursor:pointer;font:inherit;font-size:.85rem}' +
			'.mk-actions{display:flex;gap:.4rem;padding:.55rem .6rem 0}' +
			'.mk-lead-open{flex:1;border:1px solid var(--mk-brand);background:#fff;color:var(--mk-brand);border-radius:8px;padding:.5rem;font:inherit;font-size:.82rem;font-weight:600;cursor:pointer}' +
			'.mk-lead-open:hover{background:#f4f8f6}' +
			'.mk-wa-sm{flex:1;text-align:center;background:#25d366;color:#fff;text-decoration:none;border-radius:8px;padding:.5rem;font-size:.82rem;font-weight:600}' +
			'.mk-input{flex:1;padding:.55rem .65rem;border:1px solid #e2e8e4;border-radius:8px;font:inherit;font-size:.9rem;outline:none}' +
			'.mk-input:focus{border-color:var(--mk-brand)}' +
			'.mk-send{border:0;background:var(--mk-brand);color:#fff;border-radius:8px;padding:0 .8rem;cursor:pointer;display:flex;align-items:center;justify-content:center;font:inherit;font-weight:600}' +
			'.mk-send:disabled{opacity:.5;cursor:default}' +
			'.mk-wa{display:block;text-align:center;background:#25d366;color:#fff;text-decoration:none;padding:.5rem;border-radius:8px;font-size:.88rem;font-weight:600}' +
			'.mk-wa-inline{margin:.6rem;margin-top:0}'
		);
	}
})();
