<script>
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	export let data;
	export let form;
	$: conn = data.connection;

	let sdkReady = false;
	let connecting = false;
	let error = '';
	let captured = { phoneNumberId: null, wabaId: null };

	const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
	const STATUS_LABEL = {
		connected: 'Connected', disconnected: 'Disconnected', pending_verification: 'Pending verification',
		permission_revoked: 'Permission revoked', expired_token: 'Token expired', phone_number_removed: 'Number removed', webhook_error: 'Webhook error'
	};

	onMount(() => {
		if (!data.ready) return;
		// Meta posts the chosen WABA + phone number id here during the popup flow.
		const onMsg = (event) => {
			if (!String(event.origin || '').includes('facebook.com')) return;
			try {
				const d = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
				if (d?.type === 'WA_EMBEDDED_SIGNUP') {
					if (d.event === 'FINISH') captured = { phoneNumberId: d.data?.phone_number_id, wabaId: d.data?.waba_id };
					else if (d.event === 'CANCEL') { error = 'Signup was cancelled before finishing.'; connecting = false; }
					else if (d.event === 'ERROR') { error = d.data?.error_message || 'Meta reported an error during signup.'; connecting = false; }
				}
			} catch (_) {}
		};
		window.addEventListener('message', onMsg);

		window.fbAsyncInit = function () {
			window.FB.init({ appId: data.meta.appId, cookie: true, xfbml: false, version: data.meta.graphVersion });
			sdkReady = true;
		};
		if (!document.getElementById('fb-sdk')) {
			const s = document.createElement('script');
			s.id = 'fb-sdk';
			s.async = true;
			s.defer = true;
			s.crossOrigin = 'anonymous';
			s.src = 'https://connect.facebook.net/en_US/sdk.js';
			document.body.appendChild(s);
		} else {
			sdkReady = !!window.FB;
		}
		return () => window.removeEventListener('message', onMsg);
	});

	function connect() {
		error = '';
		captured = { phoneNumberId: null, wabaId: null };
		if (!window.FB) {
			error = 'Facebook SDK is still loading — try again in a second.';
			return;
		}
		connecting = true;
		window.FB.login(
			(response) => {
				const code = response?.authResponse?.code;
				if (!code) {
					connecting = false;
					if (!error) error = 'The popup was closed or permission was not granted.';
					return;
				}
				// Give the WA_EMBEDDED_SIGNUP message a beat to land with the ids.
				setTimeout(() => finish(code), 500);
			},
			{ config_id: data.meta.configId, response_type: 'code', override_default_response_type: true, extras: { setup: {}, featureType: '', sessionInfoVersion: '3' } }
		);
	}

	async function finish(code) {
		try {
			const res = await fetch('/api/whatsapp/connect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code, phoneNumberId: captured.phoneNumberId, wabaId: captured.wabaId })
			});
			const json = await res.json();
			if (json.ok) await invalidateAll();
			else error = json.error || 'Could not complete the connection.';
		} catch (_) {
			error = 'Could not reach the server to finish connecting.';
		}
		connecting = false;
	}
</script>

<div class="page-head">
	<div>
		<h1>WhatsApp Integration</h1>
		<div class="sub">Connect your own WhatsApp Business number so the AI answers your customers from your number.</div>
	</div>
</div>

{#if data.needsMigration}
	<div class="notice err">WhatsApp connections need a one-time database update — run <code>db/021_whatsapp_connections.sql</code> in Supabase.</div>
{/if}
{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}
{#if error}<div class="notice err">{error}</div>{/if}

<div class="card">
	{#if conn}
		<div class="conn-head">
			<div class="dot on"></div>
			<div>
				<div class="conn-title">Connected</div>
				<div class="muted" style="font-size:.85rem">{conn.verified_name || 'Your WhatsApp Business'} · {conn.display_phone_number || '—'}</div>
			</div>
			<span class="pill s-{conn.status}">{STATUS_LABEL[conn.status] || conn.status}</span>
		</div>
		<dl class="details">
			<div><dt>Verified business name</dt><dd>{conn.verified_name || '—'}</dd></div>
			<div><dt>Display phone number</dt><dd>{conn.display_phone_number || '—'}</dd></div>
			<div><dt>Phone number ID</dt><dd class="mono">{conn.phone_number_id}</dd></div>
			<div><dt>WhatsApp Business Account</dt><dd class="mono">{conn.whatsapp_business_account_id || '—'}</dd></div>
			<div><dt>Connection status</dt><dd>{STATUS_LABEL[conn.status] || conn.status}</dd></div>
			<div><dt>Connected</dt><dd>{fmt(conn.connected_at)}</dd></div>
			<div><dt>Last sync</dt><dd>{fmt(conn.updated_at)}</dd></div>
		</dl>
		<div class="actions">
			<button class="btn" type="button" on:click={connect} disabled={!sdkReady || connecting}>{connecting ? 'Reconnecting…' : 'Reconnect'}</button>
			<form method="POST" action="?/refresh" use:enhance style="display:inline"><button class="btn ghost">Refresh information</button></form>
			<form method="POST" action="?/disconnect" use:enhance style="display:inline"><button class="btn ghost danger">Disconnect</button></form>
		</div>
	{:else if !data.ready}
		<div class="conn-head"><div class="dot"></div><div><div class="conn-title">Not available yet</div><div class="muted" style="font-size:.85rem">WhatsApp Embedded Signup isn’t configured on the server.</div></div></div>
		<p class="muted" style="font-size:.9rem">Ask your administrator to set <code>META_APP_ID</code>, <code>META_APP_SECRET</code>, <code>META_CONFIG_ID</code> and <code>WHATSAPP_ENC_KEY</code>. Until then, messages use the shared platform number.</p>
	{:else}
		<div class="conn-head"><div class="dot"></div><div><div class="conn-title">Not connected</div><div class="muted" style="font-size:.85rem">Connect in under two minutes — no tokens or IDs to copy.</div></div></div>
		<p class="muted" style="font-size:.9rem">You’ll log into Facebook, pick (or create) your WhatsApp Business Account and number, and grant Makutano AI permission. Then your AI answers customers from your own number.</p>
		<div class="actions"><button class="btn wa" type="button" on:click={connect} disabled={!sdkReady || connecting}>{connecting ? 'Connecting…' : sdkReady ? '💬 Connect WhatsApp' : 'Loading…'}</button></div>
	{/if}
</div>

<style>
	.conn-head { display: flex; align-items: center; gap: 0.8rem; }
	.conn-head .pill { margin-left: auto; }
	.conn-title { font-weight: 700; font-size: 1.05rem; color: var(--strong); }
	.dot { width: 12px; height: 12px; border-radius: 50%; background: var(--muted); flex: none; }
	.dot.on { background: #16a34a; box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.18); }
	.pill { font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 999px; background: rgba(22, 163, 74, 0.18); color: #6ee7a8; }
	.pill.s-permission_revoked, .pill.s-expired_token, .pill.s-webhook_error, .pill.s-phone_number_removed { background: rgba(220, 38, 38, 0.18); color: #fca5a5; }
	.pill.s-pending_verification { background: rgba(245, 158, 11, 0.18); color: #fcd34d; }
	.details { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem 1.4rem; margin: 1.3rem 0; }
	@media (max-width: 620px) { .details { grid-template-columns: 1fr; } }
	.details dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
	.details dd { margin: 0.2rem 0 0; font-size: 0.95rem; color: var(--soft); font-weight: 600; }
	.details .mono { font-family: ui-monospace, monospace; font-size: 0.85rem; word-break: break-all; }
	.actions { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.5rem; }
	.btn.wa { background: #25d366; color: #06331c; font-weight: 700; }
	.btn.wa:hover:not(:disabled) { background: #2ee97a; }
	.btn.danger { color: #fca5a5; }
	code { font-size: 0.85em; background: rgba(255, 255, 255, 0.06); padding: 0.05rem 0.3rem; border-radius: 5px; }
</style>
