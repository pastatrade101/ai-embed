<script>
	export let leads = [];
	export let leadEmail = null;
	const fmt = (s) =>
		s ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(s)) : '';
</script>

{#if leads.length === 0}
	<div class="card empty">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
		<h3>No leads yet</h3>
		<p>Captured leads — with the visitor's WhatsApp number and interest — appear here{#if leadEmail} and get emailed to {leadEmail}{/if}.</p>
	</div>
{:else}
	<div class="card" style="padding:0;overflow:auto">
		<table class="table">
			<thead><tr><th>Name</th><th>WhatsApp</th><th>Email</th><th>Interest</th><th>When</th></tr></thead>
			<tbody>
				{#each leads as l}
					<tr>
						<td>{l.name ?? '—'}</td>
						<td class="mono">{l.whatsapp ?? '—'}</td>
						<td class="mono muted">{l.email ?? '—'}</td>
						<td class="muted">{(l.interest ?? '') || '—'}</td>
						<td class="mono">{fmt(l.created_at)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
