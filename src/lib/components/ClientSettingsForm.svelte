<script>
	// Full business-profile + assistant settings form, shared by the operator
	// portal (/portal/settings) and the super-admin client page so the two never
	// drift. The admin variant (admin=true) posts to ?/updateClient and adds a
	// status/subscription section; the portal variant posts to the page's default
	// action. All field NAMES match updateClientSettings() in tenant.js.
	import { enhance } from '$app/forms';
	import { GREETING_MAX } from '$lib/greeting.js';
	import { CARD_TYPES, CARD_ICONS, MAX_CARDS, normalizeFeatured } from '$lib/featured-cards.js';

	export let client;
	export let industry = null;
	export let form = null;
	export let knowledgeCount = null;
	/** Admin variant: adds the status + subscription section (is_active / plan /
	 *  subscription_status), which updateClientSettings only honours with allowAdmin. */
	export let admin = false;
	export let plans = [];
	/** Form action: '' = the page's default action (portal); '?/updateClient' for admin. */
	export let action = '';
	/** Logo upload posts to an operator-scoped endpoint; hide it where that isn't available (admin). */
	export let allowUpload = true;
	export let uploadEndpoint = '/portal/upload';
	/** Link to the knowledge manager; null hides the row (e.g. admin manages knowledge in its own tab). */
	export let manageKnowledgeHref = '/portal/knowledge';

	$: terms = industry?.terms ?? { item: 'tour', items: 'tours', conversion: 'booking' };
	const tcap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

	// ---- Featured cards editor -------------------------------------------------
	// Live gov card types are offered only to the government tenant; every tenant can
	// add static text cards. The chosen set rides the main settings form as JSON.
	$: govTenant = industry?.key === 'government';
	$: typeOptions = Object.entries(CARD_TYPES).filter(([, def]) => govTenant || !def.gov);
	let cards = normalizeFeatured(client?.featured_cards, { allowGov: industry?.key === 'government' });
	let cardsSrc = JSON.stringify(cards);
	// Re-seed from the server after a save (normalised/persisted value), like greeting.
	$: {
		const fresh = JSON.stringify(normalizeFeatured(client?.featured_cards, { allowGov: govTenant }));
		if (fresh !== cardsSrc) { cardsSrc = fresh; cards = normalizeFeatured(client?.featured_cards, { allowGov: govTenant }); }
	}
	$: cardsJson = JSON.stringify(cards);
	function addCard() {
		if (cards.length >= MAX_CARDS) return;
		const type = govTenant ? 'plots_available' : 'text';
		cards = [...cards, { type, title: '', subtitle: '', icon: 'info', ...(type === 'preview_countdown' ? { projectId: '' } : {}) }];
	}
	const removeCard = (i) => (cards = cards.filter((_, j) => j !== i));
	function setField(i, key, val) { cards[i][key] = val; cards = cards; }
	function setType(i, type) {
		cards[i].type = type;
		if (type === 'preview_countdown' && cards[i].projectId == null) cards[i].projectId = '';
		cards = cards;
	}

	const TONES = ['Friendly', 'Professional', 'Warm', 'Playful', 'Concise'];
	$: suggestedText = (Array.isArray(client.suggested_questions) ? client.suggested_questions : []).join('\n');

	// Greeting bubble — bound for a live counter, re-seeded from the server when the
	// saved value changes (after a save + invalidation) to reveal a dropped save.
	let greetingMsg = client?.greeting_message ?? '';
	let greetingSrc = client?.greeting_message ?? '';
	$: if ((client?.greeting_message ?? '') !== greetingSrc) {
		greetingSrc = client?.greeting_message ?? '';
		greetingMsg = greetingSrc;
	}
	$: greetingLen = greetingMsg.length;

	// Logo: pick a file (uploads to storage) or paste a URL.
	let logoUrl = client?.logo_url ?? '';
	let logoSrc = client?.logo_url ?? '';
	$: if ((client?.logo_url ?? '') !== logoSrc) { logoSrc = client?.logo_url ?? ''; logoUrl = logoSrc; }
	let uploadingLogo = false;
	async function uploadLogo(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		uploadingLogo = true;
		try {
			const fd = new FormData();
			fd.append('file', file);
			const r = await fetch(uploadEndpoint, { method: 'POST', body: fd });
			const d = await r.json();
			if (d.url) logoUrl = d.url;
			else alert(d.error || 'Upload failed.');
		} catch (_) {
			alert('Upload failed — check your connection.');
		}
		uploadingLogo = false;
		e.target.value = '';
	}
</script>

{#if form?.section === 'client'}{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}{/if}

<form method="POST" {action} use:enhance>
	<!-- General ------------------------------------------------------------->
	<h2 class="section">General</h2>
	<div class="card grid">
		<div class="row">
			<div><label for="cs-name">Business name</label><input id="cs-name" name="name" value={client.name} required /></div>
			<div><label for="cs-type">Business type</label><input id="cs-type" name="business_type" value={client.business_type ?? ''} placeholder={industry?.businessType ?? 'tour operator'} /></div>
		</div>
		<div class="row">
			<div>
				<label for="cs-logo">Logo</label>
				<div class="logo-field">
					<div class="logo-prev" class:empty={!logoUrl}>{#if logoUrl}<img src={logoUrl} alt="logo" />{:else}<span>No logo</span>{/if}</div>
					<div class="logo-ctrls">
						<input id="cs-logo" name="logo_url" bind:value={logoUrl} placeholder={allowUpload ? 'Upload → or paste an image URL' : 'Paste an image URL'} />
						{#if allowUpload}
							<label class="upl-btn">
								<input type="file" accept="image/*" hidden on:change={uploadLogo} />
								{uploadingLogo ? 'Uploading…' : '⬆ Upload from computer'}
							</label>
						{/if}
					</div>
				</div>
				<div class="hint">The assistant’s avatar, shown in the chat header &amp; on the hosted page.</div>
			</div>
			<div><label for="cs-color">Brand color</label><input id="cs-color" name="brand_color" type="color" value={client.brand_color ?? '#0f6e56'} style="height:44px;padding:.25rem" /></div>
		</div>
	</div>

	<!-- Contact ------------------------------------------------------------->
	<h2 class="section">Contact</h2>
	<div class="card grid">
		<div class="row">
			<div><label for="cs-phone">Phone</label><input id="cs-phone" name="phone" value={client.phone ?? ''} placeholder="+255…" /></div>
			<div><label for="cs-wa">WhatsApp</label><input id="cs-wa" name="whatsapp_number" value={client.whatsapp_number ?? ''} placeholder="+255…" /><div class="hint">Where qualified leads hand off.</div></div>
		</div>
		<div class="row">
			<div><label for="cs-cemail">Email</label><input id="cs-cemail" name="contact_email" type="email" value={client.contact_email ?? ''} placeholder="hello@business.com" /></div>
			<div><label for="cs-web">Website</label><input id="cs-web" name="website_url" value={client.website_url ?? ''} placeholder="https://business.com" /></div>
		</div>
		<div><label for="cs-addr">Address</label><input id="cs-addr" name="address" value={client.address ?? ''} placeholder="Arusha, Tanzania" /></div>
	</div>

	<!-- Assistant ----------------------------------------------------------->
	<h2 class="section">Assistant</h2>
	<div class="card grid">
		<div class="row">
			<div><label for="cs-aname">Assistant name</label><input id="cs-aname" name="assistant_name" value={client.assistant_name ?? ''} placeholder="e.g. Amani" /><div class="hint">How the assistant introduces itself.</div></div>
			<div>
				<label for="cs-tone">Tone</label>
				<select id="cs-tone" name="tone">
					<option value="" selected={!client.tone}>Default</option>
					{#each TONES as t}<option value={t} selected={client.tone === t}>{t}</option>{/each}
				</select>
			</div>
		</div>
		<div><label for="cs-welcome">Welcome message</label><textarea id="cs-welcome" name="welcome_message" style="min-height:70px" placeholder={`Habari! 👋 Ask me anything about our ${terms.items}.`}>{client.welcome_message ?? ''}</textarea><div class="hint">The first thing visitors see <em>inside</em> the chat.</div></div>
		<div>
			<label for="cs-greet">Greeting bubble</label>
			<input type="hidden" name="_greeting_enabled" value="1" />
			<label class="toggle-row"><input type="checkbox" name="greeting_enabled" checked={client.greeting_enabled !== false} /> Invite visitors to chat with a greeting bubble</label>
			<input id="cs-greet" name="greeting_message" maxlength={GREETING_MAX} bind:value={greetingMsg} placeholder={`Hi 👋 Looking for the perfect ${terms.item}?`} />
			<div class="hint">Pops up beside the chat button after a short pause. Leave blank for smart greetings that adapt to the page and time of day. <span class="counter" class:over={greetingLen > GREETING_MAX - 15}>{greetingLen}/{GREETING_MAX}</span></div>
		</div>
		<div>
			<label>Chat input options</label>
			<input type="hidden" name="_attachments_enabled" value="1" />
			<label class="toggle-row"><input type="checkbox" name="attachments_enabled" checked={client.attachments_enabled !== false} /> Allow file attachments (photos / PDFs) in the chat</label>
			<input type="hidden" name="_voice_enabled" value="1" />
			<label class="toggle-row"><input type="checkbox" name="voice_enabled" checked={client.voice_enabled !== false} /> Allow voice input (microphone) in the chat</label>
			<div class="hint">Turn these off to hide the attach and mic buttons in the hosted chat.</div>
		</div>
		<div><label for="cs-ctx">System instructions</label><textarea id="cs-ctx" name="business_context" placeholder={industry?.onboarding?.suggestions?.[0] ?? 'Describe your business and how the assistant should answer…'}>{client.business_context ?? ''}</textarea><div class="hint">Guides how the assistant answers — injected into its system prompt.</div></div>
		<div style="max-width:340px"><label for="cs-langs">Languages</label><input id="cs-langs" name="languages" value={client.languages ?? ''} placeholder="English, Swahili" /></div>
	</div>

	<!-- Conversion ---------------------------------------------------------->
	<h2 class="section">{tcap(terms.conversion)}</h2>
	<div class="card grid">
		<div class="row">
			<div><label for="cs-cur">Currency</label><input id="cs-cur" name="default_currency" value={client.default_currency ?? 'USD'} style="max-width:140px" /></div>
			<div>
				<label for="cs-dest">Lead destination</label>
				<select id="cs-dest" name="lead_destination">
					<option value="whatsapp" selected={(client.lead_destination ?? 'whatsapp') === 'whatsapp'}>WhatsApp</option>
					<option value="email" selected={client.lead_destination === 'email'}>Email</option>
					<option value="both" selected={client.lead_destination === 'both'}>WhatsApp + Email</option>
				</select>
			</div>
		</div>
		<div class="row">
			<div><label for="cs-lemail">Lead notification email</label><input id="cs-lemail" name="lead_email" type="email" value={client.lead_email ?? ''} placeholder="owner@business.com" /></div>
			<div><label for="cs-hours">Business hours</label><input id="cs-hours" name="business_hours" value={client.business_hours ?? ''} placeholder="Mon–Sat, 8am–6pm EAT" /></div>
		</div>
	</div>

	<!-- AI ------------------------------------------------------------------>
	<h2 class="section">AI</h2>
	<div class="card grid">
		{#if knowledgeCount != null || manageKnowledgeHref}
			<div class="rowflex" style="justify-content:space-between;align-items:center;display:flex;gap:.6rem">
				<div><strong>Knowledge base</strong>{#if knowledgeCount != null}<div class="muted" style="font-size:.84rem">{knowledgeCount} item{knowledgeCount === 1 ? '' : 's'} the assistant answers from.</div>{/if}</div>
				{#if manageKnowledgeHref}<a class="btn ghost sm" href={manageKnowledgeHref}>Manage knowledge →</a>{/if}
			</div>
		{/if}

		<div style="border-top:1px solid var(--line-2);padding-top:.85rem">
			<input type="hidden" name="_auto_lead_capture" value="1" />
			<label style="display:flex;align-items:center;gap:.5rem;margin:0">
				<input type="checkbox" name="auto_lead_capture" checked={client.auto_lead_capture !== false} style="width:auto" />
				Auto lead capture
			</label>
			<div class="hint">Automatically ask for a name + WhatsApp number when a visitor shows buying intent.</div>
		</div>

		<div><label for="cs-esc">Escalation</label><textarea id="cs-esc" name="escalation" style="min-height:70px" placeholder="If a visitor needs a human or asks something you can't answer, share the WhatsApp number and invite them to message the team directly.">{client.escalation ?? ''}</textarea><div class="hint">What the assistant should do when it can't help.</div></div>

		<div><label for="cs-sugg">Suggested questions (one per line, up to 6)</label><textarea id="cs-sugg" name="suggested_questions" style="min-height:90px" placeholder={`What ${terms.items} do you offer?\nWhat are your prices?\nHow do I get started?`}>{suggestedText}</textarea><div class="hint">Shown as clickable chips in the chat to get visitors started.</div></div>
	</div>

	<!-- Featured cards ------------------------------------------------------>
	<h2 class="section">Featured cards</h2>
	<div class="card grid">
		<div class="hint" style="margin:0">
			Small cards shown on the assistant page's welcome screen, below the suggested questions.
			{#if govTenant}Live cards (plots available, on-preview countdown, councils with land) pull real TAUSI numbers automatically — you only write the label.{/if}
		</div>
		{#each cards as card, i (i)}
			<div class="fcedit">
				<div class="fcedit-row">
					<select value={card.type} on:change={(e) => setType(i, e.target.value)} aria-label="Card type">
						{#each typeOptions as [key, def]}<option value={key}>{def.label}</option>{/each}
					</select>
					<select value={card.icon} on:change={(e) => setField(i, 'icon', e.target.value)} aria-label="Card icon">
						{#each CARD_ICONS as ic}<option value={ic}>{ic}</option>{/each}
					</select>
					<button type="button" class="btn ghost sm fcedit-x" on:click={() => removeCard(i)}>Remove</button>
				</div>
				<div class="fcedit-row">
					<input placeholder={card.type === 'text' ? 'Title (required)' : 'Title (optional — overrides the default label)'} maxlength="48" value={card.title ?? ''} on:input={(e) => setField(i, 'title', e.target.value)} />
					<input placeholder="Subtitle (optional)" maxlength="90" value={card.subtitle ?? ''} on:input={(e) => setField(i, 'subtitle', e.target.value)} />
				</div>
				{#if card.type === 'preview_countdown'}
					<input placeholder="Project id of the land project to feature" maxlength="40" value={card.projectId ?? ''} on:input={(e) => setField(i, 'projectId', e.target.value)} />
				{/if}
				<div class="hint" style="margin:0">{CARD_TYPES[card.type]?.hint ?? ''}</div>
			</div>
		{/each}
		{#if cards.length < MAX_CARDS}
			<button type="button" class="btn ghost sm" on:click={addCard} style="align-self:flex-start">+ Add card</button>
		{:else}
			<div class="hint" style="margin:0">Up to {MAX_CARDS} cards.</div>
		{/if}
		<input type="hidden" name="featured_cards" value={cardsJson} />
	</div>

	{#if admin}
		<!-- Status & subscription (admin only) ------------------------------->
		<h2 class="section">Status &amp; subscription</h2>
		<div class="card grid">
			<label class="toggle-row"><input type="checkbox" name="is_active" checked={client.is_active} /> Active — answer visitor questions</label>
			<div class="row">
				<div>
					<label for="cs-plan">Plan</label>
					<select id="cs-plan" name="plan">
						{#each plans as p}<option value={p.key} selected={client.plan === p.key}>{p.name}</option>{/each}
					</select>
					<div class="hint">Changing the plan updates the monthly conversation cap.</div>
				</div>
				<div>
					<label for="cs-status">Subscription status</label>
					<select id="cs-status" name="subscription_status">
						{#each ['active', 'trialing', 'past_due', 'canceled'] as st}<option value={st} selected={client.subscription_status === st}>{st}</option>{/each}
					</select>
					<div class="hint">Past-due / canceled pauses answering at the cap.</div>
				</div>
			</div>
		</div>
	{/if}

	<div style="margin-top:1.2rem"><button type="submit">Save all settings</button></div>
</form>

<style>
	.fcedit {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.85rem;
		border: 1px solid var(--line-2);
		border-radius: 12px;
		background: var(--well, rgba(0, 0, 0, 0.02));
	}
	.fcedit-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.fcedit-row > input,
	.fcedit-row > select {
		flex: 1;
		min-width: 140px;
	}
	.fcedit-x {
		flex: none;
	}
	.toggle-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.1rem 0 0.5rem;
		font-weight: 500;
	}
	.toggle-row input {
		width: auto;
	}
	.counter {
		float: right;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}
	.counter.over {
		color: #c2410c;
		font-weight: 600;
	}
	.logo-field {
		display: flex;
		gap: 0.7rem;
		align-items: stretch;
	}
	.logo-prev {
		flex: none;
		width: 84px;
		height: 60px;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--edge);
		background: var(--panel-2);
		display: grid;
		place-items: center;
	}
	.logo-prev img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 4px;
	}
	.logo-prev.empty span {
		font-size: 0.68rem;
		color: var(--muted);
	}
	.logo-ctrls {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
	}
	.logo-ctrls input {
		width: 100%;
	}
	.upl-btn {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.4rem 0.8rem;
		border-radius: 9px;
		border: 1px solid var(--edge);
		background: var(--panel-2);
		color: var(--soft);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}
	.upl-btn:hover {
		border-color: rgba(var(--gold-rgb), 0.4);
		color: var(--mint);
	}
</style>
