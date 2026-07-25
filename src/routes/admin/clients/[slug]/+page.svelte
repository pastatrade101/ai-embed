<script>
	import { enhance } from '$app/forms';
	import ClientStatTiles from '$lib/components/ClientStatTiles.svelte';
	import KnowledgeManager from '$lib/components/KnowledgeManager.svelte';
	import ClientSettingsForm from '$lib/components/ClientSettingsForm.svelte';
	import LeadsTable from '$lib/components/LeadsTable.svelte';
	import ConversationList from '$lib/components/ConversationList.svelte';
	import { readableInk } from '$lib/luminance.js';
	import { industryOf } from '$lib/industries.js';
	import { page } from '$app/stores';

	export let data;
	export let form;

	$: client = data.client;
	let tab = 'overview';
	let deleteConfirm = ''; // super admin must type the slug to enable the delete button

	// Tool-pack assignment (super admin). Seed from the server's per-client state, but
	// ONLY re-seed when that state actually CHANGES — otherwise a sibling form's save
	// (which triggers invalidateAll) would clobber an unsaved toggle here. Each toggle
	// is stored as an explicit on/off in tool_packs.
	let packState = {};
	let packSrc = '';
	$: {
		const fresh = JSON.stringify((data.toolPacks || []).map((p) => [p.key, p.active]));
		if (fresh !== packSrc) {
			packSrc = fresh;
			packState = Object.fromEntries((data.toolPacks || []).map((p) => [p.key, p.active]));
		}
	}
	$: packJson = JSON.stringify(packState);

	// Plan capacity ≈ conversations from the AI budget — the same basis the
	// operator billing and pricing pages use, so every screen shows one number.
	const nf = (n) => Number(n ?? 0).toLocaleString();
	const planConversations = (p) => {
		const cpc = data.costPerConversation || 0.004;
		const budget = Number(p?.included_ai_budget) || 0;
		return budget > 0 ? Math.round(budget / cpc) : Number(p?.monthly_conversation_cap) || 0;
	};
	const planPrice = (p) => (Number(p.price_amount) > 0 ? `${p.price_currency} ${nf(p.price_amount)}/mo` : 'Free');
	$: currentPlanObj = data.plans.find((p) => p.key === client.plan) ?? null;

	const fmtDate = (s) => (s ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(s)) : '—');
	const initials = (n) => (n ?? '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

	const embedSnippet = () => `<!-- operator pastes this once -->\n<script src="${$page.url.origin}/widget.js"\n        data-client="${client.slug}"><\/script>`;
	let copied = false;
	async function copyEmbed() {
		try { await navigator.clipboard.writeText(embedSnippet()); copied = true; setTimeout(() => (copied = false), 1500); } catch { copied = false; }
	}
</script>

<div class="page-head">
	<div class="rowflex" style="gap:.75rem">
		<div class="avatar" style={`width:44px;height:44px;border-radius:11px;display:flex;align-items:center;justify-content:center;color:${readableInk(client.brand_color ?? '#e0b24c')};font-weight:700;background:${client.brand_color ?? '#e0b24c'}`}>{initials(client.name)}</div>
		<div>
			<h1 style="display:flex;align-items:center;gap:.55rem">{client.name}
				<span class="badge dot {client.is_active ? '' : 'off'}">{client.is_active ? 'active' : 'paused'}</span>
				<span class="badge {client.subscription_status === 'active' ? '' : 'off'}">{client.plan} · {client.subscription_status}</span>
			</h1>
			<div class="sub mono">{client.slug}</div>
		</div>
	</div>
	<div class="actions">
		<a class="btn ghost sm" href="/admin">← All clients</a>
		<button class="ghost sm" on:click={copyEmbed}>{copied ? 'Copied!' : 'Copy embed'}</button>
		<form method="POST" action="?/toggleActive" use:enhance style="display:inline">
			<button class="{client.is_active ? 'danger' : ''} sm" type="submit">{client.is_active ? 'Disable' : 'Enable'}</button>
		</form>
	</div>
</div>

<ClientStatTiles stats={data.stats} cap={client.monthly_conversation_cap} whatsapp={client.whatsapp_number} />

<div class="tabs">
	<button class:active={tab === 'overview'} on:click={() => (tab = 'overview')}>Overview</button>
	<button class:active={tab === 'knowledge'} on:click={() => (tab = 'knowledge')}>Knowledge<span class="count">{data.items.length}</span></button>
	<button class:active={tab === 'leads'} on:click={() => (tab = 'leads')}>Leads<span class="count">{data.stats.leads}</span></button>
	<button class:active={tab === 'conversations'} on:click={() => (tab = 'conversations')}>Conversations<span class="count">{data.stats.conversations}</span></button>
	<button class:active={tab === 'settings'} on:click={() => (tab = 'settings')}>Settings</button>
	<button class:active={tab === 'access'} on:click={() => (tab = 'access')}>Access<span class="count">{data.operators.length}</span></button>
</div>

{#if tab === 'overview'}
	{#if !client.is_active}<div class="notice err">This client is <b>paused</b> — the widget will not answer. Re-activate under Settings.</div>{/if}

	<div class="card">
		<h2 class="section" style="margin:0">Plan</h2>
		<p class="muted" style="margin:.3rem 0 .8rem">Upgrade or downgrade this client to any plan. The conversation cap follows the plan, and the subscription is set to <b>active</b>.</p>
		{#if form?.section === 'plan' && form?.ok}<div class="notice">{form.ok}</div>{/if}
		{#if form?.section === 'plan' && form?.error}<div class="notice err">{form.error}</div>{/if}
		<form method="POST" action="?/changePlan" use:enhance class="rowflex" style="gap:.6rem;flex-wrap:wrap;align-items:flex-end">
			<div style="flex:1;min-width:240px">
				<label for="cp-plan">Assign plan</label>
				<select id="cp-plan" name="plan">
					{#each data.plans as p}<option value={p.key} selected={client.plan === p.key}>{p.name} — {planPrice(p)} · ≈ {nf(planConversations(p))} conv{p.is_default ? ' · default' : ''}</option>{/each}
				</select>
			</div>
			<button type="submit">Apply plan</button>
		</form>
		<div class="hint">Currently <b>{currentPlanObj?.name ?? client.plan}</b> · ≈ {nf(planConversations(currentPlanObj))} conversations / mo · {client.subscription_status}.</div>
	</div>

	<div class="card">
		<h2 class="section">Embed snippet</h2>
		<p class="muted" style="margin-top:-.4rem">The one tag the operator pastes into their site. Renders in a shadow DOM.</p>
		<pre class="code-block">{embedSnippet()}</pre>
		<button class="ghost sm" on:click={copyEmbed}>{copied ? 'Copied!' : 'Copy snippet'}</button>
	</div>
	<div class="card">
		<div class="rowflex" style="justify-content:space-between"><h2 class="section" style="margin:0">Recent leads</h2><button class="ghost sm" on:click={() => (tab = 'leads')}>View all</button></div>
		{#if data.leads.length === 0}<p class="muted">No leads yet.</p>{:else}
			<div style="overflow-x:auto;margin-top:.6rem">
				<table class="table"><thead><tr><th>Name</th><th>WhatsApp</th><th>Interest</th><th>When</th></tr></thead><tbody>
					{#each data.leads.slice(0, 5) as l}<tr><td>{l.name ?? '—'}</td><td class="mono">{l.whatsapp ?? l.email ?? '—'}</td><td class="muted">{(l.interest ?? '').slice(0, 60) || '—'}</td><td class="mono">{fmtDate(l.created_at)}</td></tr>{/each}
				</tbody></table>
			</div>
		{/if}
	</div>
{/if}

{#if tab === 'knowledge'}
	<KnowledgeManager items={data.items} departures={data.departures} industry={industryOf(data.client)} {form} />
{/if}

{#if tab === 'leads'}
	<LeadsTable leads={data.leads} leadEmail={client.lead_email} />
{/if}

{#if tab === 'conversations'}
	<div class="inbox-host-admin"><ConversationList conversations={data.conversations} /></div>
{/if}

{#if tab === 'settings'}
	<ClientSettingsForm
		client={data.client}
		industry={industryOf(data.client)}
		knowledgeCount={data.items?.length ?? null}
		{form}
		admin
		plans={data.plans}
		action="?/updateClient"
		allowUpload={false}
		manageKnowledgeHref={null}
	/>

	{#if form?.section === 'tools'}{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}{/if}
	<form class="card grid" method="POST" action="?/updateToolPacks" use:enhance>
		<h2 class="section" style="margin:0">Tools & data connectors</h2>
		<p class="hint" style="margin:0">Assign an institution's live-data toolset to this client, or shut it down. The default for the <b>{industryOf(client).label}</b> industry applies unless you change it here.</p>
		{#if !data.toolPacks?.length}
			<p class="muted" style="margin:0">No tool packs are defined yet.</p>
		{:else}
			<div class="packs">
				{#each data.toolPacks as p}
					<label class="pack-row">
						<input type="checkbox" checked={packState[p.key]} on:change={(e) => { packState[p.key] = e.currentTarget.checked; packState = packState; }} />
						<span class="pack-body">
							<span class="pack-title">{p.label}{#if p.isDefault}<span class="pack-tag">default</span>{/if}</span>
							<span class="pack-sub">{p.institution} · {p.toolCount} tool{p.toolCount === 1 ? '' : 's'}</span>
						</span>
						<span class="pack-state {packState[p.key] ? 'on' : 'off'}">{packState[p.key] ? 'Active' : 'Off'}</span>
					</label>
				{/each}
			</div>
		{/if}
		<input type="hidden" name="tool_packs" value={packJson} />
		<div><button type="submit">Save tool access</button></div>
	</form>

	<!-- Danger zone: permanently delete the client (super admin). Disable/enable
	     lives in the head-bar toggle and the "Active" checkbox above. -->
	{#if form?.section === 'danger'}{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}{/if}
	<div class="card danger-zone">
		<h2 class="section" style="margin:0">Danger zone</h2>

		<div class="dz-row dz-delete">
			<div style="flex:1;min-width:220px">
				<strong>Delete this client permanently</strong>
				<div class="hint" style="margin:.2rem 0 0">Removes <b>{client.name}</b> and ALL of its data — knowledge, conversations, leads and operator logins. This cannot be undone. To pause without deleting, use <b>Disable</b> at the top instead. Type the slug <code>{client.slug}</code> to confirm.</div>
			</div>
			<form method="POST" action="?/deleteClient" use:enhance class="dz-delete-form">
				<input name="confirm" bind:value={deleteConfirm} placeholder="type the slug to confirm" autocomplete="off" spellcheck="false" />
				<button class="danger" type="submit" disabled={deleteConfirm.trim() !== client.slug}>Delete client</button>
			</form>
		</div>
	</div>
{/if}

{#if tab === 'access'}
	{#if form?.section === 'access'}{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}{/if}
	<p class="muted" style="margin-top:-.5rem">Operator logins for <b>{client.name}</b>. They can sign in at <code>/login</code> and manage this client's knowledge, settings, and leads.</p>

	{#if data.operators.length === 0}
		<div class="card"><p class="muted" style="margin:0">No operator logins yet. Add one below so the business can self-serve.</p></div>
	{:else}
		{#each data.operators as u}
			<div class="card">
				<div class="rowflex" style="justify-content:space-between">
					<div><strong>{u.name ?? u.email}</strong><div class="muted mono" style="font-size:.84rem">{u.email} · last login {fmtDate(u.last_login_at)}</div></div>
					<div class="rowflex">
						<form method="POST" action="?/resetPassword" use:enhance class="rowflex" style="gap:.35rem">
							<input type="hidden" name="id" value={u.id} />
							<input name="password" type="text" placeholder="new password" style="width:170px" autocomplete="off" />
							<button class="ghost sm" type="submit">Reset</button>
						</form>
						<form method="POST" action="?/deleteOperator" use:enhance><input type="hidden" name="id" value={u.id} /><button class="danger sm" type="submit">Remove</button></form>
					</div>
				</div>
			</div>
		{/each}
	{/if}

	<form class="card grid" method="POST" action="?/addOperator" use:enhance>
		<h2 class="section">Add operator login</h2>
		<div class="row">
			<div><label for="op-name">Contact name</label><input id="op-name" name="name" placeholder="Jane Owner" /></div>
			<div><label for="op-email">Login email</label><input id="op-email" name="email" type="email" placeholder="jane@business.com" autocomplete="off" /></div>
		</div>
		<div style="max-width:340px"><label for="op-pw">Temporary password</label><input id="op-pw" name="password" type="text" placeholder="min 8 characters" autocomplete="off" /></div>
		<div><button type="submit">Create login</button></div>
	</form>
{/if}

<style>
	.packs { display: flex; flex-direction: column; gap: 0.5rem; }
	.pack-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: rgba(var(--panel-rgb), 0.5);
		cursor: pointer;
	}
	.pack-row input { width: auto; flex: none; }
	.pack-body { flex: 1; display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
	.pack-title { font-size: 0.92rem; font-weight: 600; color: var(--strong); display: flex; align-items: center; gap: 0.45rem; }
	.pack-sub { font-size: 0.78rem; color: var(--muted); }
	.pack-tag { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: var(--muted); border: 1px solid var(--edge); border-radius: 999px; padding: 0.05rem 0.4rem; }
	.pack-state { font-size: 0.78rem; font-weight: 700; flex: none; }
	.pack-state.on { color: var(--accent); }
	.pack-state.off { color: var(--faint); }

	.danger-zone { margin-top: 1rem; border-color: rgba(255, 93, 108, 0.4); }
	.dz-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: 0.8rem 0; border-top: 1px solid var(--line-2, rgba(var(--fg-rgb), 0.08)); }
	.dz-row:first-of-type { border-top: none; }
	.dz-delete-form { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
	.dz-delete-form input { min-width: 200px; }
</style>
