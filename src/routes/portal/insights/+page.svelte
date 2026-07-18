<script>
	import { enhance } from '$app/forms';
	import LockedFeature from '$lib/components/LockedFeature.svelte';
	export let data;
	export let form;
	$: ({ access, suggestions, researchTopics } = data);
	$: terms = data.industry?.terms ?? { item: 'tour', items: 'tours' };

	let question = '';
	let asking = false;
	let topic = '';
	let researching = false;
	let saving = false;

	// Editable draft, seeded from the research result.
	let draftTitle = '';
	let draftBody = '';
	let draftCategory = data.industry?.defaultResearchCategory ?? 'Travel guide';
	let seenDraft = null;
	$: if (form?.section === 'research' && form?.draft && form.draft !== seenDraft) {
		seenDraft = form.draft;
		draftTitle = form.draft.title ?? '';
		draftBody = form.draft.body ?? '';
	}

	const askSubmit = () => {
		asking = true;
		return async ({ update }) => {
			await update({ reset: false });
			asking = false;
		};
	};
	const researchSubmit = () => {
		researching = true;
		return async ({ update }) => {
			await update({ reset: false });
			researching = false;
		};
	};
	const saveSubmit = () => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	};

	const md = (s) =>
		(s ?? '')
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
			.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>')
			.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
			.replace(/\n{2,}/g, '</p><p>')
			.replace(/\n/g, '<br>');
	$: CATEGORIES = data.industry?.researchCategories ?? ['Travel guide', 'FAQ', 'Destination', 'Policy', 'Transport', 'Accommodation'];
</script>

<div class="page-head">
	<div>
		<h1>AI Insights</h1>
		<div class="sub">Your AI business analyst and research assistant — ask questions about your data and turn gaps into published knowledge.</div>
	</div>
</div>

<!-- DATA ANALYST -->
<section class="card ai">
	<div class="ai-head">
		<div>
			<h3>Ask your data <span class="pill">Premium</span></h3>
			<p class="muted">Questions about your leads, {terms.items}, pipeline and conversations — answered from your real numbers, never invented.</p>
		</div>
		{#if access.analyst.allowed}
			<div class="quota" class:low={access.analyst.quota.remaining === 0}>{access.analyst.quota.remaining}/{access.analyst.quota.limit} left</div>
		{/if}
	</div>

	{#if !access.analyst.allowed || access.analyst.quota.limit === 0}
		<LockedFeature feature="AI data analyst" planName={data.analystPlan} />
	{:else}
		<form method="POST" action="?/ask" use:enhance={askSubmit} class="ask">
			<input name="question" bind:value={question} placeholder={`e.g. Which ${terms.items} convert best? Where are leads dropping off?`} autocomplete="off" />
			<button class="btn" type="submit" disabled={asking || !question.trim() || access.analyst.quota.remaining === 0}>{asking ? 'Analysing…' : 'Ask'}</button>
		</form>
		<div class="chips">
			{#each suggestions as s}
				<button class="chip" type="button" on:click={() => (question = s)} data-no-busy>{s}</button>
			{/each}
		</div>

		{#if access.analyst.quota.remaining === 0}
			<div class="upsell">You’ve used all {access.analyst.quota.limit} analyst questions this month — this resets next month, or <a href="/portal/billing">upgrade</a> for more.</div>
		{/if}

		{#if form?.section === 'analyst' && form?.error}
			<div class="notice err">{form.error}</div>
		{/if}
		{#if form?.section === 'analyst' && form?.answer}
			<div class="answer">
				<div class="answer-q">{form.question}</div>
				<div class="answer-a">{@html '<p>' + md(form.answer) + '</p>'}</div>
			</div>
		{/if}
	{/if}
</section>

<!-- RESEARCH ASSISTANT -->
<section class="card ai" style="margin-top:1.25rem">
	<div class="ai-head">
		<div>
			<h3>Research a topic <span class="pill">Premium</span></h3>
			<p class="muted">Draft a knowledge entry from live web research — then review and publish it so your assistant can answer from it. You always approve before it goes live.</p>
		</div>
		{#if access.research.allowed}
			<div class="quota" class:low={access.research.quota.remaining === 0}>{access.research.quota.remaining}/{access.research.quota.limit} left</div>
		{/if}
	</div>

	{#if !access.research.allowed || access.research.quota.limit === 0}
		<LockedFeature feature="AI research assistant" planName={data.researchPlan} />
	{:else}
		<form method="POST" action="?/research" use:enhance={researchSubmit} class="ask">
			<input name="topic" bind:value={topic} placeholder={`e.g. a ${terms.item}, a common question, or a topic your ${terms.customer ?? 'customer'}s ask about`} autocomplete="off" />
			<button class="btn" type="submit" disabled={researching || !topic.trim() || access.research.quota.remaining === 0}>{researching ? 'Researching…' : 'Draft'}</button>
		</form>
		{#if researchTopics?.length}
			<div class="chips">
				<span class="chips-lead">Customers asked about:</span>
				{#each researchTopics as t}
					<button class="chip" type="button" on:click={() => (topic = t)} data-no-busy>{t}</button>
				{/each}
			</div>
		{/if}

		{#if access.research.quota.remaining === 0}
			<div class="upsell">You’ve used all {access.research.quota.limit} research drafts this month — this resets next month, or <a href="/portal/billing">upgrade</a> for more.</div>
		{/if}

		{#if form?.section === 'research' && form?.error}
			<div class="notice err">{form.error}</div>
		{/if}
		{#if form?.section === 'research' && form?.saved}
			<div class="notice ok">{form.saved}</div>
		{/if}

		{#if draftBody}
			<div class="draft">
				<div class="draft-note">Review and edit before publishing — the AI researched this from the web, so confirm anything time-sensitive.</div>
				<label class="fld"><span>Title</span><input bind:value={draftTitle} /></label>
				<label class="fld"><span>Content</span><textarea bind:value={draftBody} rows="10"></textarea></label>
				<form method="POST" action="?/saveDraft" use:enhance={saveSubmit} class="draft-actions">
					<input type="hidden" name="title" value={draftTitle} />
					<input type="hidden" name="body" value={draftBody} />
					<label class="cat">Category
						<select name="category" bind:value={draftCategory}>
							{#each CATEGORIES as cat}<option value={cat}>{cat}</option>{/each}
						</select>
					</label>
					<button class="btn" type="submit" disabled={saving || !draftTitle.trim() || !draftBody.trim()}>{saving ? 'Publishing…' : 'Publish to AI Knowledge'}</button>
				</form>
			</div>
		{/if}
	{/if}
</section>

<style>
	.ai {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.ai-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.ai-head h3 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.05rem;
	}
	.ai-head .muted {
		margin: 0.35rem 0 0;
		font-size: 0.88rem;
		max-width: 60ch;
	}
	.pill {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold-ink, #23180a);
		background: var(--mint);
		border-radius: 999px;
		padding: 0.15rem 0.5rem;
	}
	.quota {
		flex: none;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--muted);
		background: var(--panel-2);
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 0.25rem 0.6rem;
		white-space: nowrap;
	}
	.quota.low {
		color: var(--warn);
		border-color: rgba(200, 70, 70, 0.4);
	}
	.upsell {
		font-size: 0.9rem;
		color: var(--body);
		background: var(--panel-2);
		border: 1px solid var(--edge);
		border-radius: 12px;
		padding: 0.8rem 0.9rem;
	}
	.upsell a {
		color: var(--mint);
		font-weight: 600;
	}
	.ask {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.ask input {
		flex: 1;
		min-width: 240px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.chips-lead {
		font-size: 0.78rem;
		color: var(--faint);
	}
	.chip {
		border: 1px solid var(--edge);
		background: var(--panel-2);
		color: var(--body);
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}
	.chip:hover {
		border-color: var(--mint);
		color: var(--strong);
	}
	.answer {
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: var(--panel-2);
		padding: 0.9rem 1rem;
	}
	.answer-q {
		font-weight: 600;
		color: var(--strong);
		margin-bottom: 0.5rem;
	}
	.answer-a {
		font-size: 0.92rem;
		color: var(--body);
		line-height: 1.55;
	}
	.answer-a :global(p) {
		margin: 0 0 0.6rem;
	}
	.answer-a :global(ul) {
		margin: 0.3rem 0;
		padding-left: 1.15rem;
	}
	.answer-a :global(strong) {
		color: var(--strong);
	}
	.notice {
		font-size: 0.86rem;
		border-radius: 10px;
		padding: 0.6rem 0.8rem;
	}
	.notice.err {
		color: var(--warn);
		background: rgba(200, 70, 70, 0.08);
		border: 1px solid rgba(200, 70, 70, 0.3);
	}
	.notice.ok {
		color: #1f9d55;
		background: rgba(31, 157, 85, 0.08);
		border: 1px solid rgba(31, 157, 85, 0.3);
	}
	.draft {
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: var(--panel-2);
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.draft-note {
		font-size: 0.8rem;
		color: var(--faint);
	}
	.fld {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.fld input,
	.fld textarea {
		font: inherit;
		font-size: 0.9rem;
	}
	.fld textarea {
		resize: vertical;
		line-height: 1.5;
	}
	.draft-actions {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		flex-wrap: wrap;
	}
	.cat {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.82rem;
		color: var(--muted);
	}
</style>
