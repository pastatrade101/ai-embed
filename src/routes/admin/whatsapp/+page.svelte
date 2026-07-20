<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: s = data.status;

	let sending = null; // 'text' | 'template'
	$: result = form?.result ?? null;
	$: ok = result?.ok === true;

	const CHECKS = [
		{ k: 'accessToken', label: 'Access token', hint: 'WHATSAPP_ACCESS_TOKEN' },
		{ k: 'phoneNumberId', label: 'Phone number ID', hint: 'WHATSAPP_PHONE_NUMBER_ID' },
		{ k: 'businessAccountId', label: 'Business account ID', hint: 'WHATSAPP_BUSINESS_ACCOUNT_ID' },
		{ k: 'verifyToken', label: 'Verify token', hint: 'WHATSAPP_VERIFY_TOKEN' },
		{ k: 'appSecret', label: 'App secret', hint: 'WHATSAPP_APP_SECRET' }
	];
	const isSet = (k) => (k === 'phoneNumberId' ? !!s[k] : s[k] === true);
</script>

<div class="page-head">
	<div>
		<h1>WhatsApp test bench</h1>
		<div class="sub">Fire a real WhatsApp message through the NotificationService and see Meta’s exact response.</div>
	</div>
	<span class="status-pill" class:on={s.configured}>{s.configured ? 'Configured' : 'Not configured'}</span>
</div>

<!-- CONFIG STATUS -->
<h2 class="section">Configuration</h2>
<div class="card">
	<div class="checks">
		{#each CHECKS as c}
			<div class="chk">
				<span class="dot {isSet(c.k) ? 'ok' : 'off'}"></span>
				<div class="chk-main"><div class="chk-l">{c.label}</div><div class="chk-h">{c.hint}</div></div>
				<span class="chk-v">{c.k === 'phoneNumberId' && s.phoneNumberId ? s.phoneNumberId : isSet(c.k) ? 'Set' : 'Missing'}</span>
			</div>
		{/each}
		<div class="chk">
			<span class="dot ok"></span>
			<div class="chk-main"><div class="chk-l">API version</div><div class="chk-h">WHATSAPP_API_VERSION</div></div>
			<span class="chk-v">{s.apiVersion}</span>
		</div>
	</div>
	{#if !s.configured}
		<p class="fineprint">Add <code>WHATSAPP_ACCESS_TOKEN</code> and <code>WHATSAPP_PHONE_NUMBER_ID</code> to <code>.env</code> and restart. Until then, sends are skipped (503) rather than attempted.</p>
	{/if}
</div>

<!-- RESULT -->
{#if result}
	<div class="notice {ok ? 'good' : 'err'}">
		{#if ok}
			✓ Sent to {form.to}. Message ID: <code>{result.messageId}</code>
		{:else if result.skipped}
			WhatsApp is not configured — the send was skipped ({result.reason}).
		{:else}
			✕ Send failed{result.status ? ` (HTTP ${result.status})` : ''}{result.code ? ` · code ${result.code}` : ''}: {result.error || 'unknown error'}
		{/if}
	</div>
	<details class="raw"><summary>Raw result</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
{/if}
{#if form?.error}<div class="notice err">{form.error}</div>{/if}

<!-- TESTS -->
<div class="grid">
	<div class="card">
		<h2 class="section" style="margin-top:0">Send a template</h2>
		<p class="fineprint" style="margin:0 0 .9rem">Most reliable first test. <code>hello_world</code> is pre-approved on every WABA and works even outside the 24-hour window. The recipient must be in your test number’s allowed list.</p>
		<form method="POST" action="?/sendTemplate" use:enhance={() => { sending = 'template'; return async ({ update }) => { await update({ reset: false }); sending = null; }; }}>
			<label>Recipient (international, digits only)<input name="to" inputmode="numeric" placeholder="255700000000" required /></label>
			<div class="row">
				<label>Template name<input name="name" value="hello_world" /></label>
				<label>Language<input name="language" value="en_US" /></label>
			</div>
			<button class="btn" disabled={!!sending}>{sending === 'template' ? 'Sending…' : 'Send template'}</button>
		</form>
	</div>

	<div class="card">
		<h2 class="section" style="margin-top:0">Send free text</h2>
		<p class="fineprint" style="margin:0 0 .9rem">Only delivers inside the 24-hour customer-service window (i.e. the recipient messaged your number recently). Otherwise Meta returns a re-engagement error — that’s expected; use a template instead.</p>
		<form method="POST" action="?/sendText" use:enhance={() => { sending = 'text'; return async ({ update }) => { await update({ reset: false }); sending = null; }; }}>
			<label>Recipient (international, digits only)<input name="to" inputmode="numeric" placeholder="255700000000" required /></label>
			<label>Message<textarea name="text" rows="3" placeholder="Hello from Makutano AI 👋">Hello from Makutano AI 👋 — this is a test message.</textarea></label>
			<button class="btn ghost" disabled={!!sending}>{sending === 'text' ? 'Sending…' : 'Send text'}</button>
		</form>
	</div>
</div>

<style>
	.status-pill {
		font-size: 0.76rem;
		font-weight: 700;
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		background: rgba(220, 38, 38, 0.16);
		color: #fca5a5;
		white-space: nowrap;
	}
	.status-pill.on {
		background: rgba(22, 163, 74, 0.18);
		color: #6ee7a8;
	}
	.checks {
		display: grid;
		gap: 0.1rem;
	}
	.chk {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.6rem 0;
		border-top: 1px solid var(--line-2);
	}
	.chk:first-child {
		border-top: 0;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: none;
	}
	.dot.ok {
		background: #6ee7a8;
	}
	.dot.off {
		background: #fca5a5;
	}
	.chk-main {
		flex: 1;
		min-width: 0;
	}
	.chk-l {
		font-size: 0.9rem;
		color: var(--strong);
		font-weight: 600;
	}
	.chk-h {
		font-size: 0.72rem;
		color: var(--muted);
		font-family: ui-monospace, monospace;
	}
	.chk-v {
		font-size: 0.82rem;
		color: var(--soft);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.fineprint {
		font-size: 0.78rem;
		color: var(--muted);
		line-height: 1.5;
	}
	.fineprint code,
	.notice code {
		font-size: 0.85em;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.05rem 0.3rem;
		border-radius: 5px;
	}
	.notice.good {
		border-color: rgba(22, 163, 74, 0.4);
		background: rgba(22, 163, 74, 0.1);
		color: #6ee7a8;
	}
	.raw {
		margin: 0.6rem 0 0;
	}
	.raw summary {
		cursor: pointer;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.raw pre {
		margin: 0.5rem 0 0;
		padding: 0.8rem;
		background: var(--well, rgba(0, 0, 0, 0.25));
		border-radius: 10px;
		font-size: 0.76rem;
		overflow-x: auto;
		color: var(--soft);
	}
	.grid {
		display: grid;
		gap: 1rem;
		margin-top: 1.5rem;
	}
	@media (min-width: 900px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.card label {
		display: block;
		font-size: 0.82rem;
		color: var(--muted);
		margin-bottom: 0.7rem;
	}
	.card input,
	.card textarea {
		width: 100%;
		box-sizing: border-box;
		margin-top: 0.25rem;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.7rem;
	}
</style>
