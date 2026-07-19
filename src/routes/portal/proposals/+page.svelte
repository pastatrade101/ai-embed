<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: proposals = data.proposals ?? [];
	$: leads = data.leads ?? [];
	$: docLabel = data.docLabel ?? 'Proposal';

	const money = (n, cur) => {
		try {
			return new Intl.NumberFormat('en-US', { style: 'currency', currency: (cur || 'USD').slice(0, 3).toUpperCase(), maximumFractionDigits: 0 }).format(Number(n) || 0);
		} catch {
			return `${cur || 'USD'} ${Math.round(Number(n) || 0)}`;
		}
	};
	const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');
	const STATUS = {
		draft: 'Draft', sent: 'Sent', viewed: 'Viewed', accepted: 'Accepted', declined: 'Declined', expired: 'Expired', converted: 'Won'
	};

	// ---- Creation modes (conversation / CRM / blank) ----
	let creating = false;
	let mode = 'conversation';
	let pickedLead = null;
	let submitting = false;
	$: canSubmit = mode === 'blank' || !!pickedLead;
	function openCreate() {
		creating = true;
		mode = leads.length ? 'conversation' : 'blank';
		pickedLead = null;
	}
	function pickMode(m) {
		mode = m;
		if (m === 'blank') pickedLead = null;
	}
</script>

<div class="page-head">
	<div>
		<h1>Proposals</h1>
		<div class="sub">Create, send and track quotes and proposals — and turn conversations into deals.</div>
	</div>
	{#if !data.tableMissing}
		<button class="btn" type="button" on:click={openCreate}>+ New proposal</button>
	{/if}
</div>

{#if form?.error}<div class="notice err">{form.error}</div>{/if}

{#if data.tableMissing}
	<div class="card">
		<h2 class="section" style="margin-top:0">Almost ready</h2>
		<p class="muted">The Proposal engine needs a one-time database update. Ask your admin to run <code>db/018_proposals.sql</code> in Supabase, then reload — everything else is already in place.</p>
	</div>
{:else if proposals.length === 0}
	<div class="card empty">
		<h2 class="section" style="margin-top:0">No proposals yet</h2>
		<p class="muted">Send your first professional {docLabel.toLowerCase()}. The AI can draft it straight from a customer conversation — or start a blank one.</p>
		<button class="btn" type="button" on:click={openCreate}>+ New proposal</button>
	</div>
{:else}
	<div class="card list">
		{#each proposals as p (p.id)}
			<a class="row" href={`/portal/proposals/${p.id}`}>
				<div class="r-main">
					<div class="r-title">{p.title || p.customer_name || 'Untitled proposal'}</div>
					<div class="r-sub">{p.number} · {p.customer_name || 'No customer'}{#if p.viewed_count} · viewed {p.viewed_count}×{/if}</div>
				</div>
				<div class="r-total">{money(p.total, p.currency)}</div>
				<div class="r-status"><span class="badge s-{p.status}">{STATUS[p.status] || p.status}</span></div>
				<div class="r-date">{fmt(p.created_at)}</div>
			</a>
		{/each}
	</div>
{/if}

<!-- Creation modal -->
{#if creating}
	<div class="modal-backdrop" role="presentation" on:click|self={() => (creating = false)}>
		<div class="modal">
			<div class="modal-head">
				<h2 class="section" style="margin:0">New {docLabel.toLowerCase()}</h2>
				<button class="x" type="button" on:click={() => (creating = false)} aria-label="Close">✕</button>
			</div>
			<p class="muted" style="font-size:.85rem;margin:.1rem 0 .8rem">Start from what the AI already knows about the customer — or a blank document.</p>

			<div class="modes">
				<button type="button" class="mode" class:on={mode === 'conversation'} on:click={() => pickMode('conversation')} disabled={!leads.length}>
					<div class="mode-t">💬 From a conversation <span class="rec">Recommended</span></div>
					<div class="mode-d">AI drafts from the customer chat — requirements, items and pricing.</div>
				</button>
				<button type="button" class="mode" class:on={mode === 'crm'} on:click={() => pickMode('crm')} disabled={!leads.length}>
					<div class="mode-t">👤 From a CRM record</div>
					<div class="mode-d">Use the customer profile, saved details and past proposals.</div>
				</button>
				<button type="button" class="mode" class:on={mode === 'blank'} on:click={() => pickMode('blank')}>
					<div class="mode-t">📄 Blank {docLabel.toLowerCase()}</div>
					<div class="mode-d">Start empty and write it yourself.</div>
				</button>
			</div>

			{#if mode !== 'blank'}
				{#if leads.length}
					<div class="pick-h">Choose a conversation</div>
					<div class="picker">
						{#each leads as l}
							<button type="button" class="pick" class:on={pickedLead === l.id} on:click={() => (pickedLead = l.id)}>
								<span class="pick-score s-{l.cls}">{l.score}</span>
								<span class="pick-main"><span class="pick-name">{l.name}</span><span class="pick-sub">{l.interest || 'No stated interest'}</span></span>
								<span class="pick-meta">{l.msgs} msg{l.msgs === 1 ? '' : 's'} · {fmt(l.createdAt)}</span>
							</button>
						{/each}
					</div>
				{:else}
					<div class="muted" style="font-size:.85rem">No conversations captured yet. Share your AI assistant to collect leads, or start a blank {docLabel.toLowerCase()}.</div>
				{/if}
			{/if}

			{#if form?.error}<div class="notice err" style="margin:0.8rem 0 0">{form.error}</div>{/if}

			<form method="POST" action="?/create" use:enhance={() => { submitting = true; return async ({ update }) => { await update(); submitting = false; }; }} class="modal-foot">
				<input type="hidden" name="mode" value={mode} />
				<input type="hidden" name="lead_id" value={pickedLead ?? ''} />
				<button class="btn ghost" type="button" on:click={() => (creating = false)} disabled={submitting}>Cancel</button>
				<button class="btn" disabled={!canSubmit || submitting}>{submitting ? (mode === 'blank' ? 'Creating…' : 'Drafting with AI…') : mode === 'blank' ? 'Create' : '✦ Generate proposal'}</button>
			</form>
		</div>
	</div>
{/if}

<style>
	.list { padding: 0; }
	.row { display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 1rem; padding: 0.9rem 1.1rem; border-top: 1px solid var(--line-2); text-decoration: none; color: inherit; transition: background 0.12s; }
	.row:first-child { border-top: 0; }
	.row:hover { background: var(--panel-2); }
	.r-title { font-weight: 600; color: var(--strong); }
	.r-sub { font-size: 0.8rem; color: var(--muted); margin-top: 0.1rem; }
	.r-total { font-weight: 700; font-variant-numeric: tabular-nums; }
	.r-date { font-size: 0.8rem; color: var(--muted); min-width: 3rem; text-align: right; }
	.badge { font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; background: rgba(255, 255, 255, 0.08); color: var(--soft); }
	.badge.s-accepted, .badge.s-converted { background: rgba(22, 163, 74, 0.18); color: #6ee7a8; }
	.badge.s-viewed { background: rgba(139, 92, 246, 0.18); color: #c4b5fd; }
	.badge.s-sent { background: rgba(59, 130, 246, 0.18); color: #93c5fd; }
	.badge.s-declined { background: rgba(220, 38, 38, 0.18); color: #fca5a5; }
	.empty { text-align: center; }
	.empty .btn { margin-top: 0.4rem; }
	@media (max-width: 640px) {
		.row { grid-template-columns: 1fr auto; }
		.r-status, .r-date { display: none; }
	}

	/* ---- Creation modal ---- */
	.modal-backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(4, 14, 10, 0.6); backdrop-filter: blur(3px); display: flex; align-items: flex-start; justify-content: center; padding: 6vh 1rem 2rem; overflow-y: auto; }
	.modal { width: 100%; max-width: 560px; background: var(--panel); border: 1px solid var(--edge); border-radius: 18px; padding: 1.2rem 1.3rem; box-shadow: 0 30px 70px -30px rgba(0, 0, 0, 0.7); }
	.modal-head { display: flex; align-items: center; justify-content: space-between; }
	.modal-head .x { background: transparent; border: 0; color: var(--muted); font-size: 1rem; cursor: pointer; }
	.modes { display: grid; gap: 0.55rem; }
	.mode { text-align: left; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line-2); border-radius: 12px; padding: 0.7rem 0.85rem; cursor: pointer; transition: border-color 0.15s, background 0.15s; color: inherit; font: inherit; }
	.mode:hover:not(:disabled) { border-color: rgba(var(--gold-rgb), 0.4); }
	.mode.on { border-color: var(--mint); background: rgba(var(--gold-rgb), 0.1); }
	.mode:disabled { opacity: 0.45; cursor: not-allowed; }
	.mode-t { font-weight: 700; color: var(--strong); font-size: 0.92rem; display: flex; align-items: center; gap: 0.5rem; }
	.mode-d { font-size: 0.8rem; color: var(--muted); margin-top: 0.15rem; }
	.rec { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; color: var(--ink); background: var(--mint); padding: 0.08rem 0.4rem; border-radius: 999px; }
	.pick-h { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0.9rem 0 0.4rem; }
	.picker { display: grid; gap: 0.4rem; max-height: 260px; overflow-y: auto; }
	.pick { display: flex; align-items: center; gap: 0.7rem; text-align: left; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line-2); border-radius: 12px; padding: 0.55rem 0.7rem; cursor: pointer; color: inherit; font: inherit; transition: border-color 0.15s; }
	.pick:hover { border-color: rgba(var(--gold-rgb), 0.4); }
	.pick.on { border-color: var(--mint); background: rgba(var(--gold-rgb), 0.1); }
	.pick-score { width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; font-weight: 800; font-size: 0.82rem; flex: none; background: rgba(255, 255, 255, 0.08); color: var(--soft); font-variant-numeric: tabular-nums; }
	.pick-score.s-hot { background: rgba(22, 163, 74, 0.18); color: #6ee7a8; }
	.pick-score.s-warm { background: rgba(245, 158, 11, 0.18); color: #fcd34d; }
	.pick-score.s-cool { background: rgba(59, 130, 246, 0.18); color: #93c5fd; }
	.pick-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
	.pick-name { font-weight: 600; color: var(--strong); font-size: 0.88rem; }
	.pick-sub { font-size: 0.78rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.pick-meta { font-size: 0.72rem; color: var(--muted); white-space: nowrap; flex: none; }
	.modal-foot { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
</style>
