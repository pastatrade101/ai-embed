<script>
	import { enhance } from '$app/forms';
	import { PLAN_FEATURES } from '$lib/plans.js';
	export let data;
	export let form;
	// Snippe settles in TZS; USD is fine for display/manual billing.
	const CURRENCIES = ['TZS', 'USD', 'KES', 'UGX', 'RWF', 'EUR', 'GBP'];

	let open = {}; // which plan keys are expanded for editing
	let showCreate = false;
	const toggle = (key) => (open = { ...open, [key]: !open[key] });

	const priceLabel = (p) =>
		Number(p.price_amount) > 0 ? `${p.price_currency} ${Number(p.price_amount).toLocaleString()}/mo` : 'Free';

	// After a successful save, collapse the row back to its summary.
	const saveEnhance = (key) => () => async ({ result, update }) => {
		await update();
		if (result.type === 'success') open = { ...open, [key]: false };
	};
	const createEnhance = () => async ({ result, update }) => {
		await update({ reset: true });
		if (result.type === 'success') showCreate = false;
	};
</script>

<div class="page-head">
	<div>
		<h1>Plans &amp; billing</h1>
		<div class="sub">Define subscription tiers. Assigning a plan sets a client's monthly conversation cap. To sell online via Snippe, price in <b>TZS</b> (minimum 500 TZS).</div>
	</div>
	<div class="actions">
		<button class="sm" on:click={() => (showCreate = !showCreate)}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
			New plan
		</button>
	</div>
</div>

{#if data.loadError}<div class="notice err">{data.loadError}</div>{/if}
{#if form?.section !== 'new' && form?.ok}<div class="notice">{form.ok}</div>{/if}
{#if form?.section !== 'new' && form?.error}<div class="notice err">{form.error}</div>{/if}

{#if showCreate}
	<div class="card create-card">
		<div class="rowflex" style="justify-content:space-between">
			<h2 class="section" style="margin:0">New plan</h2>
			<button class="ghost sm" on:click={() => (showCreate = false)} type="button">Cancel</button>
		</div>
		{#if form?.section === 'new' && form?.error}<div class="notice err">{form.error}</div>{/if}
		<form class="grid plan-edit" method="POST" action="?/create" use:enhance={createEnhance} style="border-top:0;padding:0;margin-top:.9rem">
			<div class="row">
				<div><label>Name</label><input name="name" required placeholder="Enterprise" /></div>
				<div><label>Key</label><input name="key" placeholder="enterprise (auto from name)" /></div>
			</div>
			<div class="row">
				<div><label>Price / month</label><input name="price_amount" inputmode="decimal" placeholder="250000" /></div>
				<div><label>Currency</label><select name="price_currency" value="TZS">{#each CURRENCIES as c}<option value={c}>{c}</option>{/each}</select></div>
			</div>
			<div><label>Monthly conversation cap</label><input name="monthly_conversation_cap" inputmode="numeric" placeholder="20000" /></div>
			<div>
				<label>Features included</label>
				<div class="feat-grid">
					{#each PLAN_FEATURES as f}
						<label class="feat"><input type="checkbox" name="features" value={f} /> <span>{f}</span></label>
					{/each}
				</div>
			</div>
			<div><button type="submit">Create plan</button></div>
		</form>
	</div>
{/if}

<div class="plan-list">
	{#each data.plans as p (p.key)}
		<div class="card plan">
			<div class="plan-head" on:click={() => toggle(p.key)} role="button" tabindex="0" on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle(p.key))}>
				<div class="plan-id">
					<span class="plan-name">{p.name}</span>
					<span class="badge neutral mono">{p.key}</span>
					{#if p.is_default}<span class="badge">default</span>{/if}
					{#if Number(p.price_amount) === 0}<span class="badge neutral">free</span>{/if}
					{#if !p.is_active}<span class="badge off">hidden</span>{/if}
				</div>
				<div class="plan-meta">
					<span class="plan-price">{priceLabel(p)}</span>
					<span>{Number(p.monthly_conversation_cap).toLocaleString()} conv/mo</span>
					<span>{(p.features ?? []).length} features</span>
					<span class="badge {(data.counts[p.key] ?? 0) > 0 ? '' : 'neutral'}">{data.counts[p.key] ?? 0} client{(data.counts[p.key] ?? 0) === 1 ? '' : 's'}</span>
					<button class="ghost sm" type="button" on:click|stopPropagation={() => toggle(p.key)}>{open[p.key] ? 'Close' : 'Edit'}</button>
				</div>
			</div>

			{#if open[p.key]}
				<form class="plan-edit" method="POST" action="?/save" use:enhance={saveEnhance(p.key)}>
					<input type="hidden" name="key" value={p.key} />
					<div class="row">
						<div><label>Name</label><input name="name" value={p.name} required /></div>
						<div><label>Monthly conversation cap</label><input name="monthly_conversation_cap" value={p.monthly_conversation_cap} inputmode="numeric" /></div>
					</div>
					<div class="row">
						<div><label>Price / month</label><input name="price_amount" value={p.price_amount} inputmode="decimal" /></div>
						<div><label>Currency</label><select name="price_currency" value={p.price_currency ?? 'USD'}>{#each CURRENCIES as c}<option value={c}>{c}</option>{/each}</select></div>
					</div>
					<div>
						<label>Features included</label>
						<div class="feat-grid">
							{#each PLAN_FEATURES as f}
								<label class="feat"><input type="checkbox" name="features" value={f} checked={(p.features ?? []).includes(f)} /> <span>{f}</span></label>
							{/each}
						</div>
					</div>
					<div class="plan-toggles">
						<label class="chk"><input type="checkbox" name="is_active" checked={p.is_active} /> Available for new clients</label>
						<label class="chk"><input type="checkbox" name="is_default" checked={p.is_default} /> Default plan for new clients</label>
					</div>
					<div class="plan-actions">
						<button type="submit">Save changes</button>
						<button type="button" class="ghost" on:click={() => toggle(p.key)}>Cancel</button>
					</div>
				</form>
			{/if}
		</div>
	{/each}
</div>

<style>
	.plan-list {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.plan {
		padding: 0;
		overflow: hidden;
	}
	.plan-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 1.25rem;
		flex-wrap: wrap;
		cursor: pointer;
		transition: background 0.12s;
	}
	.plan-head:hover {
		background: rgba(255, 255, 255, 0.02);
	}
	.plan-id {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
		min-width: 0;
	}
	.plan-name {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--strong);
		letter-spacing: -0.01em;
	}
	.plan-meta {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.plan-price {
		font-weight: 700;
		color: var(--strong);
		font-size: 0.95rem;
	}
	.plan-edit {
		display: flex;
		flex-direction: column;
		gap: 0.95rem;
		padding: 1.1rem 1.25rem 1.25rem;
		border-top: 1px solid var(--edge);
	}
	.feat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 0.55rem 1rem;
		margin-top: 0.35rem;
	}
	.feat {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin: 0;
		font-weight: 500;
		font-size: 0.88rem;
		color: var(--body);
		cursor: pointer;
	}
	.feat input,
	.chk input {
		width: auto;
		margin: 0;
		flex-shrink: 0;
	}
	.plan-toggles {
		display: flex;
		flex-wrap: wrap;
		gap: 1.4rem;
		padding-top: 0.2rem;
	}
	.chk {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-weight: 500;
		color: var(--body);
		cursor: pointer;
	}
	.plan-actions {
		display: flex;
		gap: 0.5rem;
	}
</style>
