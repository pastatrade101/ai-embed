<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;

	let name = form?.values?.name ?? '';
	let touchedSlug = Boolean(form?.values?.slug);
	let slug = form?.values?.slug ?? '';
	let password = '';
	const auto = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	$: derivedSlug = touchedSlug ? slug : auto(name);

	// Client-side strong-password generator (unambiguous alphabet).
	const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
	function generate() {
		const n = 14;
		const buf = new Uint8Array(n);
		(window.crypto ?? {}).getRandomValues?.(buf);
		password = Array.from(buf, (b) => ALPHA[b % ALPHA.length]).join('');
	}

	let copied = '';
	async function copy(text, which) {
		try {
			await navigator.clipboard.writeText(text);
			copied = which;
			setTimeout(() => (copied = ''), 1500);
		} catch {
			copied = '';
		}
	}

	$: created = form?.created ?? null;
</script>

{#if created}
	<!-- Success: show the login credentials ONCE ------------------------------>
	<div class="page-head">
		<div>
			<h1>Client created</h1>
			<div class="sub"><b>{created.name}</b> is live. Share these login details with them now.</div>
		</div>
	</div>

	<div class="card">
		<div class="rowflex" style="gap:.5rem;margin-bottom:.6rem">
			<span class="badge dot">login created</span>
			<span class="muted" style="font-size:.85rem">Shown once — the password is stored hashed and can't be retrieved later.</span>
		</div>

		<div class="grid" style="gap:.6rem">
			<div>
				<label>Username (login email)</label>
				<div class="rowflex" style="gap:.4rem;flex-wrap:nowrap">
					<input readonly value={created.email} />
					<button type="button" class="ghost sm" on:click={() => copy(created.email, 'email')}>{copied === 'email' ? 'Copied' : 'Copy'}</button>
				</div>
			</div>
			<div>
				<label>Password</label>
				<div class="rowflex" style="gap:.4rem;flex-wrap:nowrap">
					<input readonly value={created.password} style="font-variant-numeric:tabular-nums" />
					<button type="button" class="ghost sm" on:click={() => copy(created.password, 'pw')}>{copied === 'pw' ? 'Copied' : 'Copy'}</button>
				</div>
			</div>
		</div>

		<div class="rowflex" style="margin-top:1rem">
			<button type="button" on:click={() => copy(`Login: ${created.email}\nPassword: ${created.password}\nSign in at /login`, 'both')}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
				{copied === 'both' ? 'Copied both' : 'Copy both'}
			</button>
			<a class="btn ghost" href={`/admin/clients/${created.slug}`}>Open client workspace →</a>
			<a class="btn ghost" href="/admin/clients/new">Add another client</a>
		</div>
	</div>
{:else}
	<!-- Create form ---------------------------------------------------------->
	<div class="page-head">
		<div>
			<h1>Add a client</h1>
			<div class="sub">Onboard a business as a tenant, pick a plan, and create its login. You can seed knowledge next.</div>
		</div>
	</div>

	{#if form?.error}<div class="notice err">{form.error}</div>{/if}

	<form class="grid" method="POST" use:enhance>
		<div class="card grid">
			<h2 class="section">Business</h2>
			<div class="row">
				<div><label for="name">Business name</label><input id="name" name="name" required bind:value={name} placeholder="Kilimanjaro Treks" /></div>
				<div>
					<label for="slug">Slug (client_id)</label>
					<input id="slug" name="slug" bind:value={derivedSlug} on:input={() => (touchedSlug = true)} placeholder="kilimanjaro-treks" />
					<div class="hint">Used in the embed tag. Lowercase, hyphenated, unique.</div>
				</div>
			</div>
			<div class="row">
				<div><label for="business_type">Business type</label><input id="business_type" name="business_type" value={form?.values?.business_type ?? ''} placeholder="tour operator" /></div>
				<div><label for="whatsapp_number">WhatsApp number</label><input id="whatsapp_number" name="whatsapp_number" value={form?.values?.whatsapp_number ?? ''} placeholder="+255…" /></div>
			</div>
			<div><label for="lead_email">Lead notification email</label><input id="lead_email" name="lead_email" type="email" value={form?.values?.lead_email ?? ''} placeholder="owner@business.com" /></div>
			<div>
				<label for="business_context">Business context</label>
				<textarea id="business_context" name="business_context" placeholder="A family-run safari operator based in Arusha, running 3–7 day tours…">{form?.values?.business_context ?? ''}</textarea>
				<div class="hint">Injected into the assistant's system prompt.</div>
			</div>
			<div style="max-width:280px">
				<label for="plan">Plan</label>
				<select id="plan" name="plan">
					{#each data.plans as p}
						<option value={p.key} selected={(form?.values?.plan ?? data.defaultPlan) === p.key}>{p.name} — {p.price_amount > 0 ? `${p.price_currency} ${p.price_amount}/mo` : 'Free'} · {p.monthly_conversation_cap} conv{p.is_default ? ' · default' : ''}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="card grid">
			<h2 class="section">Operator login</h2>
			<p class="muted" style="margin-top:-.5rem">Created with the client so the business can sign in to its own portal. The email is the username.</p>
			<div class="row">
				<div><label for="operator_name">Contact name</label><input id="operator_name" name="operator_name" value={form?.values?.operator_name ?? ''} placeholder="Jane Owner" /></div>
				<div><label for="operator_email">Login email (username) <span style="color:var(--danger)">*</span></label><input id="operator_email" name="operator_email" type="email" required value={form?.values?.operator_email ?? ''} placeholder="jane@business.com" autocomplete="off" /></div>
			</div>
			<div>
				<label for="operator_password">Password</label>
				<div class="rowflex" style="gap:.4rem;flex-wrap:nowrap">
					<input id="operator_password" name="operator_password" type="text" bind:value={password} placeholder="leave blank to auto-generate" autocomplete="off" />
					<button type="button" class="ghost" on:click={generate}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
						Generate
					</button>
				</div>
				<div class="hint">Min 8 characters. Leave blank and one will be generated for you — you'll see it after creating.</div>
			</div>
		</div>

		<div class="rowflex">
			<button type="submit">Create client &amp; login</button>
			<a class="btn ghost" href="/admin">Cancel</a>
		</div>
	</form>
{/if}
