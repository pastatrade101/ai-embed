<script>
	import { enhance } from '$app/forms';
	import { GREETING_MAX } from '$lib/greeting.js';
	export let data;
	export let form;
	$: client = data.client;
	$: terms = data.industry?.terms ?? { item: 'tour', items: 'tours', conversion: 'booking' };
	const tcap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

	const TONES = ['Friendly', 'Professional', 'Warm', 'Playful', 'Concise'];
	$: suggestedText = (Array.isArray(client.suggested_questions) ? client.suggested_questions : []).join('\n');

	// Greeting bubble — bound so we can show a live character counter, but
	// re-seeded from the server whenever the saved value changes (after a save +
	// invalidation) so the field/counter reflect the normalized, persisted text
	// like the one-way-bound fields do — and reveal a dropped save.
	let greetingMsg = data.client?.greeting_message ?? '';
	let greetingSrc = data.client?.greeting_message ?? '';
	$: if ((data.client?.greeting_message ?? '') !== greetingSrc) {
		greetingSrc = data.client?.greeting_message ?? '';
		greetingMsg = greetingSrc;
	}
	$: greetingLen = greetingMsg.length;

	// Logo: pick a file from the computer (uploads to storage) or paste a URL.
	let logoUrl = data.client?.logo_url ?? '';
	let uploadingLogo = false;
	async function uploadLogo(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		uploadingLogo = true;
		try {
			const fd = new FormData();
			fd.append('file', file);
			const r = await fetch('/portal/upload', { method: 'POST', body: fd });
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

<div class="page-head">
	<div>
		<h1>Settings</h1>
		<div class="sub">Everything about your business and how your assistant behaves. Changes save together.</div>
	</div>
</div>

{#if form?.section === 'client'}{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}{/if}

<form method="POST" use:enhance>
	<!-- General ------------------------------------------------------------->
	<h2 class="section">General</h2>
	<div class="card grid">
		<div class="row">
			<div><label for="name">Business name</label><input id="name" name="name" value={client.name} required /></div>
			<div><label for="business_type">Business type</label><input id="business_type" name="business_type" value={client.business_type ?? ''} placeholder={data.industry?.businessType ?? 'tour operator'} /></div>
		</div>
		<div class="row">
			<div>
				<label for="logo_url">Logo</label>
				<div class="logo-field">
					<div class="logo-prev" class:empty={!logoUrl}>{#if logoUrl}<img src={logoUrl} alt="logo" />{:else}<span>No logo</span>{/if}</div>
					<div class="logo-ctrls">
						<input id="logo_url" name="logo_url" bind:value={logoUrl} placeholder="Upload → or paste an image URL" />
						<label class="upl-btn">
							<input type="file" accept="image/*" hidden on:change={uploadLogo} />
							{uploadingLogo ? 'Uploading…' : '⬆ Upload from computer'}
						</label>
					</div>
				</div>
				<div class="hint">Choose a file from your computer or paste a URL — your assistant’s avatar, shown in the chat header &amp; on your hosted page.</div>
			</div>
			<div><label for="brand_color">Brand color</label><input id="brand_color" name="brand_color" type="color" value={client.brand_color ?? '#0f6e56'} style="height:44px;padding:.25rem" /></div>
		</div>
	</div>

	<!-- Contact ------------------------------------------------------------->
	<h2 class="section">Contact</h2>
	<div class="card grid">
		<div class="row">
			<div><label for="phone">Phone</label><input id="phone" name="phone" value={client.phone ?? ''} placeholder="+255…" /></div>
			<div><label for="whatsapp_number">WhatsApp</label><input id="whatsapp_number" name="whatsapp_number" value={client.whatsapp_number ?? ''} placeholder="+255…" /><div class="hint">Where qualified leads hand off.</div></div>
		</div>
		<div class="row">
			<div><label for="contact_email">Email</label><input id="contact_email" name="contact_email" type="email" value={client.contact_email ?? ''} placeholder="hello@business.com" /></div>
			<div><label for="website_url">Website</label><input id="website_url" name="website_url" value={client.website_url ?? ''} placeholder="https://business.com" /></div>
		</div>
		<div><label for="address">Address</label><input id="address" name="address" value={client.address ?? ''} placeholder="Arusha, Tanzania" /></div>
	</div>

	<!-- Assistant ----------------------------------------------------------->
	<h2 class="section">Assistant</h2>
	<div class="card grid">
		<div class="row">
			<div><label for="assistant_name">Assistant name</label><input id="assistant_name" name="assistant_name" value={client.assistant_name ?? ''} placeholder="e.g. Amani" /><div class="hint">How the assistant introduces itself.</div></div>
			<div>
				<label for="tone">Tone</label>
				<select id="tone" name="tone">
					<option value="" selected={!client.tone}>Default</option>
					{#each TONES as t}<option value={t} selected={client.tone === t}>{t}</option>{/each}
				</select>
			</div>
		</div>
		<div><label for="welcome_message">Welcome message</label><textarea id="welcome_message" name="welcome_message" style="min-height:70px" placeholder={`Habari! 👋 Ask me anything about our ${terms.items}.`}>{client.welcome_message ?? ''}</textarea><div class="hint">The first thing visitors see <em>inside</em> the chat.</div></div>
		<div>
			<label for="greeting_message">Greeting bubble</label>
			<input type="hidden" name="_greeting_enabled" value="1" />
			<label class="toggle-row"><input type="checkbox" name="greeting_enabled" checked={client.greeting_enabled !== false} /> Invite visitors to chat with a greeting bubble</label>
			<input id="greeting_message" name="greeting_message" maxlength={GREETING_MAX} bind:value={greetingMsg} placeholder={`Hi 👋 Looking for the perfect ${terms.item}?`} />
			<div class="hint">Pops up beside the chat button after a short pause. Leave blank for smart greetings that adapt to the page and time of day. <span class="counter" class:over={greetingLen > GREETING_MAX - 15}>{greetingLen}/{GREETING_MAX}</span></div>
		</div>
		<div><label for="business_context">System instructions</label><textarea id="business_context" name="business_context" placeholder="A family-run safari operator based in Arusha. Always be encouraging about first-time safaris…">{client.business_context ?? ''}</textarea><div class="hint">Guides how the assistant answers — injected into its system prompt.</div></div>
		<div style="max-width:340px"><label for="languages">Languages</label><input id="languages" name="languages" value={client.languages ?? ''} placeholder="English, Swahili" /></div>
	</div>

	<!-- Booking / conversion ------------------------------------------------>
	<h2 class="section">{tcap(terms.conversion)}</h2>
	<div class="card grid">
		<div class="row">
			<div><label for="default_currency">Currency</label><input id="default_currency" name="default_currency" value={client.default_currency ?? 'USD'} style="max-width:140px" /></div>
			<div>
				<label for="lead_destination">Lead destination</label>
				<select id="lead_destination" name="lead_destination">
					<option value="whatsapp" selected={(client.lead_destination ?? 'whatsapp') === 'whatsapp'}>WhatsApp</option>
					<option value="email" selected={client.lead_destination === 'email'}>Email</option>
					<option value="both" selected={client.lead_destination === 'both'}>WhatsApp + Email</option>
				</select>
			</div>
		</div>
		<div class="row">
			<div><label for="lead_email">Lead notification email</label><input id="lead_email" name="lead_email" type="email" value={client.lead_email ?? ''} placeholder="owner@business.com" /></div>
			<div><label for="business_hours">Business hours</label><input id="business_hours" name="business_hours" value={client.business_hours ?? ''} placeholder="Mon–Sat, 8am–6pm EAT" /></div>
		</div>
	</div>

	<!-- AI ------------------------------------------------------------------>
	<h2 class="section">AI</h2>
	<div class="card grid">
		<div class="rowflex" style="justify-content:space-between">
			<div><strong>Knowledge base</strong><div class="muted" style="font-size:.84rem">{data.knowledgeCount} item{data.knowledgeCount === 1 ? '' : 's'} the assistant answers from.</div></div>
			<a class="btn ghost sm" href="/portal/knowledge">Manage knowledge →</a>
		</div>

		<div style="border-top:1px solid var(--line-2);padding-top:.85rem">
			<input type="hidden" name="_auto_lead_capture" value="1" />
			<label style="display:flex;align-items:center;gap:.5rem;margin:0">
				<input type="checkbox" name="auto_lead_capture" checked={client.auto_lead_capture !== false} style="width:auto" />
				Auto lead capture
			</label>
			<div class="hint">Automatically ask for a name + WhatsApp number when a visitor shows buying intent.</div>
		</div>

		<div><label for="escalation">Escalation</label><textarea id="escalation" name="escalation" style="min-height:70px" placeholder="If a visitor needs a human or asks something you can't answer, share the WhatsApp number and invite them to message the team directly.">{client.escalation ?? ''}</textarea><div class="hint">What the assistant should do when it can't help.</div></div>

		<div><label for="suggested_questions">Suggested questions (one per line, up to 6)</label><textarea id="suggested_questions" name="suggested_questions" style="min-height:90px" placeholder={"What safaris do you offer?\nHow much is a 3-day trip?\nDo you do Kilimanjaro climbs?"}>{suggestedText}</textarea><div class="hint">Shown as clickable chips in the chat to get visitors started.</div></div>
	</div>

	<div style="margin-top:1.2rem"><button type="submit">Save all settings</button></div>
</form>

<style>
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
