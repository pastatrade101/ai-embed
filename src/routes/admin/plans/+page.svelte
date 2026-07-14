<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;
</script>

<div class="page-head">
	<div>
		<h1>Plans &amp; billing</h1>
		<div class="sub">Define subscription tiers. Assigning a plan to a client sets its monthly conversation cap. Billing is manual for now — no card processor wired up.</div>
	</div>
</div>

{#if data.loadError}<div class="notice err">{data.loadError}</div>{/if}
{#if form?.section !== 'new' && form?.ok}<div class="notice">{form.ok}</div>{/if}
{#if form?.section !== 'new' && form?.error}<div class="notice err">{form.error}</div>{/if}

<div class="cards" style="grid-template-columns:1fr">
	{#each data.plans as p (p.key)}
		<form class="card grid" method="POST" action="?/save" use:enhance>
			<input type="hidden" name="key" value={p.key} />
			<div class="rowflex" style="justify-content:space-between">
				<h2 class="section" style="margin:0">{p.name} <span class="badge neutral mono">{p.key}</span></h2>
				<span class="badge {(data.counts[p.key] ?? 0) > 0 ? '' : 'neutral'}">{data.counts[p.key] ?? 0} client{(data.counts[p.key] ?? 0) === 1 ? '' : 's'}</span>
			</div>
			<div class="row">
				<div><label>Name</label><input name="name" value={p.name} required /></div>
				<div><label>Price ({p.price_currency}/mo)</label><input name="price_amount" value={p.price_amount} inputmode="decimal" /></div>
			</div>
			<div class="row">
				<div><label>Monthly conversation cap</label><input name="monthly_conversation_cap" value={p.monthly_conversation_cap} inputmode="numeric" /></div>
				<div style="display:flex;align-items:flex-end;gap:.5rem;padding-bottom:.6rem"><input type="checkbox" name="is_active" checked={p.is_active} style="width:auto" /><label style="margin:0">Available for new clients</label></div>
			</div>
			<div><label>Features (one per line)</label><textarea name="features" style="min-height:90px">{(p.features ?? []).join('\n')}</textarea></div>
			<div><button type="submit">Save plan</button></div>
		</form>
	{/each}
</div>

<h2 class="section">Add a plan</h2>
{#if form?.section === 'new' && form?.ok}<div class="notice">{form.ok}</div>{/if}
{#if form?.section === 'new' && form?.error}<div class="notice err">{form.error}</div>{/if}
<form class="card grid" method="POST" action="?/create" use:enhance>
	<div class="row">
		<div><label>Name</label><input name="name" required placeholder="Enterprise" /></div>
		<div><label>Key</label><input name="key" placeholder="enterprise (auto from name)" /></div>
	</div>
	<div class="row">
		<div><label>Price /mo</label><input name="price_amount" inputmode="decimal" placeholder="199" /></div>
		<div><label>Monthly conversation cap</label><input name="monthly_conversation_cap" inputmode="numeric" placeholder="20000" /></div>
	</div>
	<div><label>Features (one per line)</label><textarea name="features" style="min-height:90px" placeholder="Everything in Pro&#10;Unlimited websites&#10;Dedicated support"></textarea></div>
	<div><button type="submit">Create plan</button></div>
</form>
