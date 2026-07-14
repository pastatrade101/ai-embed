<script>
	// Master–detail conversations inbox. A fixed-height frame: a searchable,
	// filterable list on the left and a reading pane on the right that leads with
	// the AI summary. Both panes scroll independently, so the outer page never
	// grows as conversations accumulate. Reused as-is on the portal page and in
	// the admin client-detail tab (all context differences are pure CSS).
	import { onMount } from 'svelte';
	import { renderMarkdown, stripMarkdown } from '$lib/markdown.js';

	export let conversations = [];

	const LONG_MIN = 10; // "long chat" threshold (messages)

	let query = '';
	let sortKey = 'newest'; // 'newest' | 'oldest' | 'messages'
	let summarizedOnly = false;
	let longOnly = false;
	let selectedId = null;
	let rowEls = {}; // id -> row button element, for arrow-key focus
	let copied = false;

	/* ---- helpers ---- */
	const asMsgs = (c) => (Array.isArray(c?.messages) ? c.messages : []);
	const messageCount = (c) => asMsgs(c).length;
	const firstUserQuestion = (c) => {
		const m = asMsgs(c).find((x) => x.role === 'user');
		return (m?.content ?? '').trim() || '(no message)';
	};
	const firstAssistant = (c) => {
		const m = asMsgs(c).find((x) => x.role === 'assistant');
		return (m?.content ?? '').trim();
	};
	const summaryOf = (c) => (typeof c?.summary === 'string' ? c.summary.trim() : '');
	const hasSummary = (c) => summaryOf(c).length > 0;
	// Row sub-line: prefer the AI summary, fall back to the first assistant reply.
	const snippet = (c) => summaryOf(c) || firstAssistant(c);

	const timeFmt = new Intl.DateTimeFormat('en', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
	const formatTime = (s) => (s ? timeFmt.format(new Date(s)) : '');
	const relativeTime = (s) => {
		if (!s) return '';
		const then = new Date(s).getTime();
		if (Number.isNaN(then)) return '';
		const sec = Math.round((Date.now() - then) / 1000);
		if (sec < 45) return 'just now';
		const min = Math.round(sec / 60);
		if (min < 60) return `${min}m ago`;
		const hr = Math.round(min / 60);
		if (hr < 24) return `${hr}h ago`;
		const day = Math.round(hr / 24);
		if (day < 7) return `${day}d ago`;
		const wk = Math.round(day / 7);
		if (wk < 5) return `${wk}w ago`;
		return timeFmt.format(new Date(s));
	};

	/* ---- filtering + sorting (live) ---- */
	$: q = query.trim().toLowerCase();
	$: summarizedCount = conversations.filter(hasSummary).length;
	$: longCount = conversations.filter((c) => messageCount(c) >= LONG_MIN).length;
	$: isFiltering = Boolean(q) || summarizedOnly || longOnly;
	$: filtered = conversations
		.filter((c) => !summarizedOnly || hasSummary(c))
		.filter((c) => !longOnly || messageCount(c) >= LONG_MIN)
		.filter(
			(c) =>
				!q ||
				firstUserQuestion(c).toLowerCase().includes(q) ||
				summaryOf(c).toLowerCase().includes(q)
		)
		.slice()
		.sort((a, b) => {
			if (sortKey === 'messages') return messageCount(b) - messageCount(a);
			const ta = new Date(a.created_at).getTime() || 0;
			const tb = new Date(b.created_at).getTime() || 0;
			return sortKey === 'oldest' ? ta - tb : tb - ta;
		});

	// Keep the detail pane populated even if the selected row is filtered out.
	$: selected =
		filtered.find((c) => c.id === selectedId) ||
		conversations.find((c) => c.id === selectedId) ||
		null;

	function selectConversation(c) {
		selectedId = c.id;
		copied = false;
	}
	function clearSelection() {
		selectedId = null;
	}
	function resetFilters() {
		query = '';
		summarizedOnly = false;
		longOnly = false;
		sortKey = 'newest';
	}

	function moveSelection(dir) {
		if (!filtered.length) return;
		const idx = filtered.findIndex((c) => c.id === selectedId);
		let next = idx === -1 ? (dir > 0 ? 0 : filtered.length - 1) : idx + dir;
		next = Math.max(0, Math.min(filtered.length - 1, next));
		const c = filtered[next];
		if (!c) return;
		selectedId = c.id;
		copied = false;
		const el = rowEls[c.id];
		if (el) el.focus();
	}
	function onListKeydown(e) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			moveSelection(1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			moveSelection(-1);
		}
	}

	async function copySummary() {
		const text = summaryOf(selected);
		if (!text || !navigator?.clipboard?.writeText) return;
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch (_) {
			/* clipboard blocked — ignore */
		}
	}

	// On desktop, open the newest conversation so the detail pane isn't empty.
	// Mobile starts on the list (drawer pattern); SSR never touches window.
	onMount(() => {
		if (typeof window !== 'undefined' && window.matchMedia('(min-width: 721px)').matches) {
			const first = filtered[0];
			if (first) selectedId = first.id;
		}
	});
</script>

{#if conversations.length === 0}
	<div class="card empty">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
		<h3>No conversations yet</h3>
		<p>Every visitor chat is logged here for usage metering and quality review.</p>
	</div>
{:else}
	<div class="inbox" class:show-detail={selectedId}>
		<!-- ===== Master: list column ===== -->
		<aside class="inbox-list" aria-label="Conversations">
			<div class="inbox-toolbar">
				<div class="inbox-search">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
					<input
						type="text"
						placeholder="Search questions & summaries…"
						bind:value={query}
						aria-label="Search conversations"
					/>
					{#if query}
						<button type="button" class="inbox-clear" on:click={() => (query = '')} aria-label="Clear search" title="Clear search">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
						</button>
					{/if}
				</div>
				<div class="inbox-controls">
					<button
						type="button"
						class="chip"
						class:on={summarizedOnly}
						aria-pressed={summarizedOnly}
						on:click={() => (summarizedOnly = !summarizedOnly)}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3"/></svg>
						Summarized <span class="chip-n">{summarizedCount}</span>
					</button>
					<button
						type="button"
						class="chip"
						class:on={longOnly}
						aria-pressed={longOnly}
						on:click={() => (longOnly = !longOnly)}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
						Long chats <span class="chip-n">{longCount}</span>
					</button>
					<select bind:value={sortKey} class="inbox-sort" aria-label="Sort conversations">
						<option value="newest">Newest</option>
						<option value="oldest">Oldest</option>
						<option value="messages">Most messages</option>
					</select>
					<span class="inbox-count faint mono" aria-live="polite">
						{#if isFiltering}{filtered.length} of {conversations.length}{:else}{conversations.length} conversations{/if}
					</span>
				</div>
			</div>

			<div class="inbox-rows">
				{#if filtered.length === 0}
					<div class="empty inbox-empty-list">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
						<h3>No matches</h3>
						<p>Nothing matches your search or filter.</p>
						<button class="ghost sm" on:click={resetFilters}>Clear filters</button>
					</div>
				{:else}
					{#each filtered as c (c.id)}
						<button
							type="button"
							class="conv-row"
							class:active={c.id === selectedId}
							aria-current={c.id === selectedId ? 'true' : undefined}
							bind:this={rowEls[c.id]}
							on:click={() => selectConversation(c)}
							on:keydown={onListKeydown}
						>
							<span class="cr-top">
								<span class="cr-q">{firstUserQuestion(c)}</span>
								<span class="cr-time faint mono">{relativeTime(c.created_at)}</span>
							</span>
							<span class="cr-sub">{stripMarkdown(snippet(c)) || 'No summary — short chat'}</span>
							<span class="cr-foot">
								<span class="cr-count mono">{messageCount(c)} msgs</span>
								{#if hasSummary(c)}<span class="cr-tag">Summary</span>{/if}
							</span>
						</button>
					{/each}
				{/if}
			</div>
		</aside>

		<!-- ===== Detail: reading pane ===== -->
		<section class="inbox-detail" aria-label="Conversation detail">
			{#if selected}
				<header class="detail-head">
					<button class="inbox-back btn ghost sm" on:click={clearSelection} aria-label="Back to list">
						<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
						Back
					</button>
					<div class="dh-main">
						<div class="dh-q">{firstUserQuestion(selected)}</div>
						<div class="dh-meta faint mono">{messageCount(selected)} messages · {formatTime(selected.created_at)}</div>
					</div>
				</header>

				<div class="detail-scroll">
					{#if hasSummary(selected)}
						<div class="summary-card">
							<div class="sc-head">
								<span class="sc-title">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z"/></svg>
									AI Summary
								</span>
								<button class="ghost sm" on:click={copySummary}>{copied ? 'Copied ✓' : 'Copy'}</button>
							</div>
							<p class="sc-body">{summaryOf(selected)}</p>
						</div>
					{:else}
						<div class="summary-card muted-summary">
							<span class="sc-title faint">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
								No AI summary
							</span>
							<p class="sc-body faint">This chat was too short to summarize — read the full transcript below.</p>
						</div>
					{/if}

					<div class="transcript">
						<div class="tr-label">Full transcript</div>
						<div class="chat-log">
							{#each asMsgs(selected) as m}
								<div class="chat-msg {m.role}">
									{#if m.role === 'assistant'}{@html renderMarkdown(m.content)}{:else}{m.content}{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{:else}
				<div class="empty inbox-empty-detail">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
					<h3>Select a conversation</h3>
					<p>Pick a chat on the left to read its AI summary and full transcript.</p>
				</div>
			{/if}
		</section>
	</div>
{/if}
