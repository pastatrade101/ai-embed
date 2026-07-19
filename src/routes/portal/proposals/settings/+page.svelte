<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;

	// Working copy of the settings (deep clone so we can bind freely).
	let s = JSON.parse(JSON.stringify(data.settings));
	let dirty = false;
	let saving = false;
	const touch = () => (dirty = true);
	$: settingsJson = JSON.stringify(s);

	const a = data.analytics;
	const money = (n) => {
		try {
			return new Intl.NumberFormat('en-US', { style: 'currency', currency: (data.currency || 'USD').slice(0, 3).toUpperCase(), maximumFractionDigits: 0 }).format(Number(n) || 0);
		} catch {
			return `${data.currency || 'USD'} ${Math.round(Number(n) || 0)}`;
		}
	};

	const MODES = [['conversation', 'From a conversation'], ['crm', 'From a CRM record'], ['blank', 'Blank']];
	const EXPIRY = [[0, 'No expiry'], [7, '7 days'], [14, '14 days'], [30, '30 days']];
	const STYLES = [['', 'Brand default'], ['professional', 'Professional'], ['friendly', 'Friendly'], ['executive', 'Executive'], ['luxury', 'Luxury'], ['government', 'Government'], ['healthcare', 'Healthcare'], ['retail', 'Retail'], ['educational', 'Educational'], ['legal', 'Legal'], ['technical', 'Technical'], ['confident', 'Confident'], ['minimal', 'Minimal']];
	const DETAIL = [['brief', 'Brief'], ['standard', 'Standard'], ['detailed', 'Detailed']];
	const CREATIVITY = [['conservative', 'Conservative'], ['balanced', 'Balanced'], ['creative', 'Creative']];
	const PERSONALITY = [['', 'None'], ['professional', 'Professional'], ['luxury', 'Luxury'], ['corporate', 'Corporate'], ['friendly', 'Friendly'], ['government', 'Government'], ['technical', 'Technical'], ['confident', 'Confident'], ['minimal', 'Minimal']];
	const MISSING = [['ask', 'Ask the customer'], ['warn', 'Warn the team member'], ['block', 'Block generation']];
	const SOURCES = [['conversation', 'Conversation history'], ['crm', 'CRM record'], ['knowledge_base', 'Knowledge base'], ['catalogue', 'Product / service catalogue'], ['pricing', 'Pricing'], ['policies', 'Business policies'], ['previous_proposals', 'Previous proposals']];
	const REQ_FIELDS = ['Customer name', 'Service required', 'Budget', 'Timeline', 'Location', 'Project scope', 'Preferred package', 'Payment preference'];

	function toggleReq(label) {
		const set = new Set(s.requiredFields || []);
		set.has(label) ? set.delete(label) : set.add(label);
		s.requiredFields = [...set];
		touch();
	}
</script>

<div class="page-head">
	<div>
		<a href="/portal/proposals" class="back">← Proposals</a>
		<h1>Proposal AI settings</h1>
		<div class="sub">Configure how Proposal AI behaves — generation, knowledge, brand voice, recommendations and transparency. No code required.</div>
	</div>
</div>

{#if data.needsMigration}
	<div class="notice err">Proposal AI settings need a one-time database update. Ask your admin to run <code>db/019_proposal_ai.sql</code> in Supabase, then reload. You can still browse the options below.</div>
{/if}
{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}

<!-- Performance -->
<div class="card">
	<h2 class="section" style="margin-top:0">Performance</h2>
	<div class="stats">
		<div class="stat"><span class="v">{a.total}</span><span class="k">Proposals</span></div>
		<div class="stat"><span class="v">{a.aiPct}%</span><span class="k">AI-assisted</span></div>
		<div class="stat"><span class="v">{a.acceptanceRate}%</span><span class="k">Acceptance</span></div>
		<div class="stat"><span class="v">{money(a.avgValue)}</span><span class="k">Avg value</span></div>
		<div class="stat"><span class="v">{money(a.revenue)}</span><span class="k">Won revenue</span></div>
		<div class="stat"><span class="v">{a.avgViews}</span><span class="k">Avg views</span></div>
	</div>
	{#if a.total}
		<div class="funnel">
			{#each [['draft', 'Draft'], ['sent', 'Sent'], ['viewed', 'Viewed'], ['accepted', 'Accepted'], ['declined', 'Declined']] as [k, lbl]}
				<div class="fseg"><span class="fbar" style="height:{Math.max(4, Math.round(((a.byStatus[k] || 0) / a.total) * 60))}px"></span><span class="fnum">{a.byStatus[k] || 0}</span><span class="flbl">{lbl}</span></div>
			{/each}
		</div>
		{#if a.topMissing.length}
			<div class="miss"><span class="miss-h">Most common missing info:</span> {#each a.topMissing as m, i}<span class="miss-chip">{m.k} ({m.v}){i < a.topMissing.length - 1 ? '' : ''}</span>{/each}</div>
		{/if}
	{:else}
		<p class="muted" style="font-size:.85rem;margin:.4rem 0 0">No proposals yet — analytics will appear here as you create and send them.</p>
	{/if}
</div>

<form method="POST" action="?/save" use:enhance={() => { saving = true; return async ({ update }) => { await update({ reset: false }); saving = false; dirty = false; }; }}>
	<input type="hidden" name="settings" value={settingsJson} />

	<!-- General -->
	<div class="card">
		<h2 class="section" style="margin-top:0">General</h2>
		<div class="grid2">
			<label>Default creation mode<select bind:value={s.defaultMode} on:change={touch}>{#each MODES as [v, l]}<option value={v}>{l}</option>{/each}</select></label>
			<label>Default expiry<select bind:value={s.defaultExpiryDays} on:change={touch}>{#each EXPIRY as [v, l]}<option value={v}>{l}</option>{/each}</select></label>
		</div>
		<div class="switches">
			<label class="sw"><input type="checkbox" bind:checked={s.enableTimeline} on:change={touch} /><span></span>Show proposal timeline</label>
			<label class="sw"><input type="checkbox" bind:checked={s.enableLiveSync} on:change={touch} /><span></span>Enable live conversation sync</label>
			<label class="sw"><input type="checkbox" bind:checked={s.enableVersioning} on:change={touch} /><span></span>Enable versioning</label>
		</div>
	</div>

	<!-- AI generation -->
	<div class="card">
		<h2 class="section" style="margin-top:0">AI generation</h2>
		<div class="grid2">
			<label>Writing style<select bind:value={s.writingStyle} on:change={touch}>{#each STYLES as [v, l]}<option value={v}>{l}</option>{/each}</select></label>
			<label>Detail level<select bind:value={s.detailLevel} on:change={touch}>{#each DETAIL as [v, l]}<option value={v}>{l}</option>{/each}</select></label>
			<label>Creativity<select bind:value={s.creativity} on:change={touch}>{#each CREATIVITY as [v, l]}<option value={v}>{l}</option>{/each}</select></label>
		</div>
		<div class="switches">
			<label class="sw"><input type="checkbox" bind:checked={s.enableFollowup} on:change={touch} /><span></span>Enable AI follow-up messages</label>
			<label class="sw"><input type="checkbox" bind:checked={s.enableRegeneration} on:change={touch} /><span></span>Allow regeneration</label>
			<label class="sw"><input type="checkbox" bind:checked={s.autoDetectChanges} on:change={touch} /><span></span>Detect conversation changes</label>
			<label class="sw"><input type="checkbox" bind:checked={s.requireConfirmApply} on:change={touch} /><span></span>Confirm before applying AI changes</label>
		</div>
	</div>

	<!-- Knowledge sources -->
	<div class="card">
		<h2 class="section" style="margin-top:0">Knowledge sources</h2>
		<p class="muted" style="font-size:.82rem;margin:0 0 .5rem">Choose what Proposal AI may draw on. Turning a source off removes it from every proposal prompt.</p>
		<div class="switches">
			{#each SOURCES as [k, l]}
				<label class="sw"><input type="checkbox" bind:checked={s.sources[k]} on:change={touch} /><span></span>{l}</label>
			{/each}
		</div>
	</div>

	<!-- Required information -->
	<div class="card">
		<h2 class="section" style="margin-top:0">Required information</h2>
		<p class="muted" style="font-size:.82rem;margin:0 0 .5rem">What Proposal AI should know before it drafts.</p>
		<div class="chips-pick">
			{#each REQ_FIELDS as f}
				<button type="button" class="pick-chip" class:on={(s.requiredFields || []).includes(f)} on:click={() => toggleReq(f)}>{(s.requiredFields || []).includes(f) ? '✓ ' : ''}{f}</button>
			{/each}
		</div>
		<div class="grid2">
			<label>Minimum completeness ({s.minCompleteness}%)<input type="range" min="0" max="100" step="10" bind:value={s.minCompleteness} on:input={touch} /></label>
			<label>If information is missing<select bind:value={s.missingBehaviour} on:change={touch}>{#each MISSING as [v, l]}<option value={v}>{l}</option>{/each}</select></label>
		</div>
	</div>

	<!-- Brand voice -->
	<div class="card">
		<h2 class="section" style="margin-top:0">Brand voice</h2>
		<div class="grid2">
			<label>Brand personality<select bind:value={s.brandPersonality} on:change={touch}>{#each PERSONALITY as [v, l]}<option value={v}>{l}</option>{/each}</select></label>
		</div>
		<label>Custom instructions<textarea rows="3" bind:value={s.customInstructions} on:input={touch} placeholder="e.g. Always mention payment terms. Never promise unavailable services. Always recommend the premium option first."></textarea></label>
		<p class="muted" style="font-size:.78rem;margin:.2rem 0 0">These become part of every AI-generated proposal, rewrite and recommendation.</p>
	</div>

	<!-- Recommendations -->
	<div class="card">
		<h2 class="section" style="margin-top:0">Recommendations</h2>
		<div class="switches">
			<label class="sw"><input type="checkbox" bind:checked={s.enableUpsell} on:change={touch} /><span></span>Enable upselling</label>
			<label class="sw"><input type="checkbox" bind:checked={s.enableCrossSell} on:change={touch} /><span></span>Enable cross-selling</label>
			<label class="sw"><input type="checkbox" bind:checked={s.enablePremium} on:change={touch} /><span></span>Recommend premium options</label>
			<label class="sw"><input type="checkbox" bind:checked={s.enableBundles} on:change={touch} /><span></span>Recommend bundles</label>
			<label class="sw"><input type="checkbox" bind:checked={s.enableDiscounts} on:change={touch} /><span></span>Suggest discounts</label>
		</div>
		<div class="grid2">
			<label>Max recommendations<input type="number" min="1" max="10" bind:value={s.maxRecommendations} on:input={touch} /></label>
			<label>Minimum confidence ({s.minConfidence}%)<input type="range" min="0" max="95" step="5" bind:value={s.minConfidence} on:input={touch} /></label>
		</div>
	</div>

	<!-- Explainable AI -->
	<div class="card">
		<h2 class="section" style="margin-top:0">Explainable AI</h2>
		<p class="muted" style="font-size:.82rem;margin:0 0 .5rem">Choose how much of the AI's reasoning your team sees in the editor.</p>
		<div class="switches">
			<label class="sw"><input type="checkbox" bind:checked={s.showConfidence} on:change={touch} /><span></span>Show confidence scores</label>
			<label class="sw"><input type="checkbox" bind:checked={s.showSources} on:change={touch} /><span></span>Show source attribution</label>
			<label class="sw"><input type="checkbox" bind:checked={s.showReasoning} on:change={touch} /><span></span>Show AI reasoning &amp; trust</label>
			<label class="sw"><input type="checkbox" bind:checked={s.showQualityScore} on:change={touch} /><span></span>Show proposal quality score</label>
			<label class="sw"><input type="checkbox" bind:checked={s.showChangeSummary} on:change={touch} /><span></span>Show change summaries</label>
			<label class="sw"><input type="checkbox" bind:checked={s.showDecisionHistory} on:change={touch} /><span></span>Show AI decision history</label>
		</div>
	</div>

	<!-- Approval -->
	<div class="card">
		<h2 class="section" style="margin-top:0">Approval</h2>
		<div class="switches">
			<label class="sw"><input type="checkbox" bind:checked={s.requireApproval} on:change={touch} /><span></span>Require internal approval before sending</label>
			<label class="sw"><input type="checkbox" bind:checked={s.autoApproveAI} on:change={touch} /><span></span>Auto-approve AI drafts</label>
		</div>
		<label>Approval notes<textarea rows="2" bind:value={s.approvalNotes} on:input={touch} placeholder="Guidance shown to whoever approves proposals."></textarea></label>
		<p class="muted" style="font-size:.78rem;margin:.2rem 0 0">A light gate for now — multi-step approval workflows can extend this later.</p>
	</div>

	<div class="card muted deferred">
		<b>Coming later:</b> proposal templates and reorderable proposal blocks. These need a template engine and block system — they'll get their own settings here once built.
	</div>

	<div class="save-bar"><button class="btn" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>{#if dirty}<span class="unsaved">● Unsaved changes</span>{/if}</div>
</form>

<style>
	.back { font-size: 0.82rem; color: var(--muted); text-decoration: none; }
	form { display: flex; flex-direction: column; gap: 1rem; }
	.card { display: flex; flex-direction: column; gap: 0.7rem; }
	label { display: block; font-size: 0.82rem; color: var(--muted); }
	select, input[type='number'], textarea { width: 100%; box-sizing: border-box; margin-top: 0.25rem; }
	input[type='range'] { width: 100%; margin-top: 0.35rem; accent-color: var(--mint); }
	.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
	@media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }
	.switches { display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem 1rem; }
	@media (max-width: 640px) { .switches { grid-template-columns: 1fr; } }
	.sw { display: flex; align-items: center; gap: 0.5rem; font-size: 0.86rem; color: var(--soft); cursor: pointer; }
	.sw input { position: absolute; opacity: 0; width: 0; height: 0; }
	.sw span { flex: none; width: 34px; height: 20px; border-radius: 999px; background: var(--line-2); position: relative; transition: background 0.15s; }
	.sw span::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.15s; }
	.sw input:checked + span { background: var(--mint); }
	.sw input:checked + span::after { transform: translateX(14px); }
	.chips-pick { display: flex; flex-wrap: wrap; gap: 0.4rem; }
	.pick-chip { font: inherit; font-size: 0.8rem; padding: 0.28rem 0.65rem; border-radius: 999px; border: 1px solid var(--line-2); background: rgba(255, 255, 255, 0.03); color: var(--soft); cursor: pointer; }
	.pick-chip.on { border-color: var(--mint); background: rgba(var(--gold-rgb), 0.1); color: var(--strong); }
	.save-bar { position: sticky; bottom: 0; padding: 0.7rem 0; display: flex; align-items: center; background: linear-gradient(to top, var(--ink, #0a231b), transparent); }
	.unsaved { margin-left: 0.8rem; font-size: 0.82rem; color: var(--mint); }
	.deferred { font-size: 0.82rem; }
	.stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.6rem; }
	@media (max-width: 720px) { .stats { grid-template-columns: repeat(3, 1fr); } }
	.stat { display: flex; flex-direction: column; gap: 0.15rem; }
	.stat .v { font-size: 1.15rem; font-weight: 800; color: var(--strong); font-variant-numeric: tabular-nums; }
	.stat .k { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
	.funnel { display: flex; align-items: flex-end; gap: 0.8rem; margin-top: 0.9rem; padding-top: 0.6rem; border-top: 1px solid var(--line-2); }
	.fseg { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; }
	.fbar { width: 34px; border-radius: 6px 6px 0 0; background: var(--mint); display: block; }
	.fnum { font-size: 0.85rem; font-weight: 700; color: var(--strong); }
	.flbl { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
	.miss { margin-top: 0.8rem; font-size: 0.8rem; color: var(--soft); }
	.miss-h { color: var(--muted); }
	.miss-chip { display: inline-block; margin: 0.15rem 0.25rem 0 0; padding: 0.1rem 0.45rem; border-radius: 999px; background: rgba(255, 255, 255, 0.05); }
</style>
