<script>
	import { enhance } from '$app/forms';
	import ClientStatTiles from '$lib/components/ClientStatTiles.svelte';
	import KnowledgeManager from '$lib/components/KnowledgeManager.svelte';
	import LeadsTable from '$lib/components/LeadsTable.svelte';
	import ConversationList from '$lib/components/ConversationList.svelte';
	import { readableInk } from '$lib/luminance.js';
	import { industryOf } from '$lib/industries.js';
	import { page } from '$app/stores';

	export let data;
	export let form;

	$: client = data.client;
	let tab = 'overview';

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
					{#each data.plans as p}<option value={p.key} selected={client.plan === p.key}>{p.name} — {p.price_amount > 0 ? `${p.price_currency} ${p.price_amount}/mo` : 'Free'} · {p.monthly_conversation_cap} conv{p.is_default ? ' · default' : ''}</option>{/each}
				</select>
			</div>
			<button type="submit">Apply plan</button>
		</form>
		<div class="hint">Currently <b>{data.plans.find((p) => p.key === client.plan)?.name ?? client.plan}</b> · {client.monthly_conversation_cap} conversations / mo · {client.subscription_status}.</div>
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
	{#if form?.section === 'client'}{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}{/if}
	<form class="card grid" method="POST" action="?/updateClient" use:enhance>
		<h2 class="section">Business profile</h2>
		<div class="row">
			<div><label for="s-name">Business name</label><input id="s-name" name="name" value={client.name} required /></div>
			<div><label for="s-type">Business type</label><input id="s-type" name="business_type" value={client.business_type ?? ''} /></div>
		</div>
		<div class="row">
			<div><label for="s-wa">WhatsApp number</label><input id="s-wa" name="whatsapp_number" value={client.whatsapp_number ?? ''} placeholder="+255…" /></div>
			<div><label for="s-email">Lead notification email</label><input id="s-email" name="lead_email" type="email" value={client.lead_email ?? ''} /></div>
		</div>
		<div class="row">
			<div><label for="s-color">Brand color</label><input id="s-color" name="brand_color" type="color" value={client.brand_color ?? '#0f6e56'} style="height:44px;padding:.25rem" /></div>
			<div style="display:flex;align-items:flex-end;gap:.5rem;padding-bottom:.6rem"><input id="s-active" name="is_active" type="checkbox" checked={client.is_active} style="width:auto" /><label for="s-active" style="margin:0">Active — answer visitor questions</label></div>
		</div>
		<div><label for="s-ctx">Business context (injected into the system prompt)</label><textarea id="s-ctx" name="business_context">{client.business_context ?? ''}</textarea></div>

		<h2 class="section">Subscription</h2>
		<div class="row">
			<div>
				<label for="s-plan">Plan</label>
				<select id="s-plan" name="plan">
					{#each data.plans as p}<option value={p.key} selected={client.plan === p.key}>{p.name} — {p.price_currency} {p.price_amount}/mo · {p.monthly_conversation_cap} conv</option>{/each}
				</select>
				<div class="hint">Changing the plan updates the monthly conversation cap.</div>
			</div>
			<div>
				<label for="s-status">Subscription status</label>
				<select id="s-status" name="subscription_status">
					{#each ['active', 'trialing', 'past_due', 'canceled'] as st}<option value={st} selected={client.subscription_status === st}>{st}</option>{/each}
				</select>
				<div class="hint">Past-due / canceled pauses answering at the cap.</div>
			</div>
		</div>
		<div><button type="submit">Save settings</button></div>
	</form>
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
