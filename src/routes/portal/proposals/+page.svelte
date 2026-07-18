<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: proposals = data.proposals ?? [];
	$: docLabel = data.industry?.proposal?.docLabel ?? 'Proposal';

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
</script>

<div class="page-head">
	<div>
		<h1>Proposals</h1>
		<div class="sub">Create, send and track quotes and proposals — and turn leads into deals.</div>
	</div>
	{#if !data.tableMissing}
		<form method="POST" action="?/create" use:enhance>
			<button class="btn">+ New proposal</button>
		</form>
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
		<p class="muted">Send your first professional {docLabel.toLowerCase()}. Start one from a lead (there's a “Proposal” button on each lead) or create a blank one.</p>
		<form method="POST" action="?/create" use:enhance><button class="btn">+ New proposal</button></form>
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
</style>
