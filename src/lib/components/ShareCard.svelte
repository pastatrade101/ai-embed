<script>
	// "Share your assistant" — the no-website go-live surface. Shows the hosted
	// page link, one-click share targets, and a downloadable QR code. The URL is
	// derived from the live origin so it works in dev and prod without config.
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';

	export let slug;
	export let name = '';

	let url = '';
	let pngData = '';
	let svgData = '';
	let copied = false;
	let canNativeShare = false;

	onMount(async () => {
		url = `${window.location.origin}/c/${slug}`;
		canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
		const opts = { margin: 1, color: { dark: '#0b0e14', light: '#ffffff' } };
		try {
			pngData = await QRCode.toDataURL(url, { ...opts, width: 512 });
			svgData = await QRCode.toString(url, { ...opts, type: 'svg' });
		} catch (e) {
			/* QR is best-effort */
		}
	});

	$: waShare = `https://wa.me/?text=${encodeURIComponent(`Chat with ${name} — ask anything & book instantly: ${url}`)}`;
	$: fbShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
	$: xShare = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Chat with ${name}`)}&url=${encodeURIComponent(url)}`;
	$: mailShare = `mailto:?subject=${encodeURIComponent(`Chat with ${name}`)}&body=${encodeURIComponent(`Ask us anything and book instantly:\n${url}`)}`;

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch (e) {}
	}
	function triggerDownload(href, filename) {
		const a = document.createElement('a');
		a.href = href;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}
	function downloadPng() {
		if (pngData) triggerDownload(pngData, `${slug}-qr.png`);
	}
	function downloadSvg() {
		if (!svgData) return;
		const blob = new Blob([svgData], { type: 'image/svg+xml' });
		const u = URL.createObjectURL(blob);
		triggerDownload(u, `${slug}-qr.svg`);
		setTimeout(() => URL.revokeObjectURL(u), 1000);
	}
	async function nativeShare() {
		if (navigator.share) {
			try {
				await navigator.share({ title: name, text: `Chat with ${name}`, url });
			} catch (e) {}
		}
	}
</script>

<div class="card share-card">
	<div class="share-main">
		<div class="share-copy">
			<h2 class="section" style="margin:0">Share your assistant</h2>
			<p class="muted" style="margin:.3rem 0 0">
				No website needed. Put this link in your Instagram bio, WhatsApp, Google profile — anywhere. Anyone who opens it can chat and book.
			</p>

			<div class="share-link">
				<input readonly value={url} aria-label="Your assistant link" on:focus={(e) => e.target.select()} />
				<button class="ghost sm" on:click={copyLink}>{copied ? 'Copied!' : 'Copy'}</button>
				{#if url}<a class="btn ghost sm" href={url} target="_blank" rel="noopener">Open</a>{/if}
			</div>

			<div class="share-btns">
				<a class="share-b wa" href={waShare} target="_blank" rel="noopener">
					<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.06c-.24.68-1.42 1.3-1.95 1.34-.5.05-.5.4-3.16-.66-2.66-1.06-4.32-3.8-4.45-3.98-.13-.18-1.06-1.42-1.06-2.7s.66-1.9.9-2.16c.24-.26.52-.32.7-.32l.5.01c.16.01.38-.06.6.46.24.55.8 1.9.87 2.04.07.13.12.29.02.47-.36.73-.74.7-.43.48-.14.13-.29.28-.13.55.16.27.72 1.18 1.54 1.91 1.06.95 1.96 1.24 2.24 1.38.28.13.44.11.6-.07.16-.18.7-.81.88-1.09.18-.28.37-.23.62-.14.25.09 1.6.75 1.87.89.28.13.46.2.53.31.07.11.07.66-.17 1.34z"/></svg>
					WhatsApp
				</a>
				<a class="share-b" href={fbShare} target="_blank" rel="noopener">Facebook</a>
				<a class="share-b" href={xShare} target="_blank" rel="noopener">X</a>
				<a class="share-b" href={mailShare}>Email</a>
				{#if canNativeShare}
					<button class="share-b" on:click={nativeShare} type="button">Share…</button>
				{/if}
			</div>
		</div>

		<div class="qr-box">
			<div class="qr-frame">
				{#if pngData}
					<img class="qr-img" src={pngData} alt="QR code for your assistant link" width="140" height="140" />
				{:else}
					<div class="qr-loading"></div>
				{/if}
			</div>
			<div class="qr-dl">
				<button class="ghost sm" on:click={downloadPng} disabled={!pngData}>PNG</button>
				<button class="ghost sm" on:click={downloadSvg} disabled={!svgData}>SVG</button>
			</div>
			<span class="qr-hint faint">Print for desks, vehicles, flyers</span>
		</div>
	</div>
</div>

<style>
	.share-main {
		display: flex;
		gap: 1.5rem;
		align-items: flex-start;
		flex-wrap: wrap;
	}
	.share-copy {
		flex: 1;
		min-width: 240px;
	}
	.share-link {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.9rem;
		flex-wrap: wrap;
	}
	.share-link input {
		flex: 1;
		min-width: 180px;
		font-size: 0.86rem;
		font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
	}
	.share-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.75rem;
	}
	.share-b {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.7rem;
		border-radius: 99px;
		border: 1px solid var(--edge);
		background: rgba(255, 255, 255, 0.02);
		color: var(--soft);
		font-size: 0.82rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}
	.share-b:hover {
		border-color: rgba(55, 224, 166, 0.35);
		color: var(--strong);
		background: var(--panel-2);
	}
	.share-b.wa:hover {
		border-color: rgba(37, 211, 102, 0.5);
		color: #2ee06a;
	}
	.qr-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}
	.qr-frame {
		width: 156px;
		height: 156px;
		display: grid;
		place-items: center;
		background: #fff;
		border-radius: 14px;
		padding: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
	}
	.qr-img {
		width: 140px;
		height: 140px;
		display: block;
	}
	.qr-loading {
		width: 140px;
		height: 140px;
		border-radius: 6px;
		background: repeating-linear-gradient(45deg, #eef2f0, #eef2f0 8px, #e2e8e5 8px, #e2e8e5 16px);
	}
	.qr-dl {
		display: flex;
		gap: 0.4rem;
	}
	.qr-hint {
		font-size: 0.72rem;
		text-align: center;
	}
</style>
