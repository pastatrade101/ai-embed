<script>
	import ClientStatTiles from '$lib/components/ClientStatTiles.svelte';
	import ShareCard from '$lib/components/ShareCard.svelte';
	import OnboardingChecklist from '$lib/components/OnboardingChecklist.svelte';
	export let data; // client (from layout) + workspace (from page load)
	$: client = data.client;

	const fmtDate = (s) => (s ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(s)) : '—');
	const firstQuestion = (c) => (Array.isArray(c.messages) ? c.messages : []).find((x) => x.role === 'user')?.content ?? '(no message)';

	const embedSnippet = () => `<!-- paste this once into your website -->\n<script src="https://app.makutano.digital/widget.js"\n        data-client="${client.slug}"><\/script>`;
	let copied = false;
	let showEmbed = false;
	async function copyEmbed() {
		try { await navigator.clipboard.writeText(embedSnippet()); copied = true; setTimeout(() => (copied = false), 1500); } catch { copied = false; }
	}
</script>

<div class="page-head">
	<div>
		<h1>Welcome back</h1>
		<div class="sub">Your AI assistant answers customers from your verified info and hands you the leads.</div>
	</div>
	<div class="actions"><button class="ghost sm" on:click={copyEmbed}>{copied ? 'Copied!' : 'Copy embed code'}</button></div>
</div>

{#if !client.is_active}
	<div class="notice err">Your assistant is currently <b>paused</b> and won't answer visitors. Contact us to reactivate.</div>
{/if}

<OnboardingChecklist {client} stats={data.stats} />

<ClientStatTiles stats={data.stats} cap={client.monthly_conversation_cap} whatsapp={client.whatsapp_number} />

{#if data.stats.items === 0}
	<div class="notice">Your knowledge catalogue is empty, so the assistant can only greet visitors. <a href="/portal/knowledge">Add your tours / services →</a></div>
{/if}

<ShareCard slug={client.slug} name={client.name} />

<div class="card">
	<div class="rowflex" style="justify-content:space-between;gap:.5rem;flex-wrap:wrap">
		<h2 class="section" style="margin:0">Add to your website <span class="faint" style="font-weight:400">(optional)</span></h2>
		<div style="display:flex;gap:.5rem">
			<a class="btn sm" href="/portal/install">Setup guide</a>
			<button class="ghost sm" on:click={() => (showEmbed = !showEmbed)} aria-expanded={showEmbed}>
				{showEmbed ? 'Hide' : 'Show code'}
			</button>
		</div>
	</div>
	<p class="muted" style="margin-top:.5rem">Paste this once into your website. It adds the chat button — nothing else changes.</p>
	{#if showEmbed}
		<pre class="code-block">{embedSnippet()}</pre>
		<button class="ghost sm" on:click={copyEmbed}>{copied ? 'Copied!' : 'Copy code'}</button>
	{/if}
</div>

<div class="card">
	<div class="rowflex" style="justify-content:space-between"><h2 class="section" style="margin:0">Recent leads</h2><a class="btn ghost sm" href="/portal/leads">View all</a></div>
	{#if data.leads.length === 0}
		<p class="muted">No leads yet. When a visitor leaves their name and WhatsApp number, they'll show up here.</p>
	{:else}
		<div style="overflow-x:auto;margin-top:.6rem">
			<table class="table"><thead><tr><th>Name</th><th>WhatsApp</th><th>Interest</th><th>When</th></tr></thead><tbody>
				{#each data.leads.slice(0, 6) as l}<tr><td>{l.name ?? '—'}</td><td class="mono">{l.whatsapp ?? l.email ?? '—'}</td><td class="muted">{(l.interest ?? '').slice(0, 60) || '—'}</td><td class="mono">{fmtDate(l.created_at)}</td></tr>{/each}
			</tbody></table>
		</div>
	{/if}
</div>

<div class="card">
	<div class="rowflex" style="justify-content:space-between"><h2 class="section" style="margin:0">Recent conversations</h2><a class="btn ghost sm" href="/portal/conversations">View all</a></div>
	{#if data.conversations.length === 0}
		<p class="muted">No conversations yet.</p>
	{:else}
		<div style="margin-top:.4rem">
			{#each data.conversations.slice(0, 5) as conv}
				<div style="padding:.55rem .1rem;border-bottom:1px solid var(--line-2)">
					<div style="font-size:.9rem">{firstQuestion(conv).slice(0, 90)}</div>
					<div class="faint mono" style="font-size:.78rem">{fmtDate(conv.created_at)}</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
