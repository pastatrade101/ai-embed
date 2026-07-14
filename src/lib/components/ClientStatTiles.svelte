<script>
	export let stats;
	export let cap = 0;
	export let whatsapp = null;

	$: usagePct = cap > 0 ? Math.min(100, Math.round((stats.conversationsMonth / cap) * 100)) : 0;
	$: usageClass = usagePct >= 100 ? 'over' : usagePct >= 80 ? 'warn' : '';
</script>

<div class="stat-grid">
	<div class="tile">
		<div class="k">Conversations · mo</div>
		<div class="v">{stats.conversationsMonth}<span class="faint" style="font-size:1rem;font-weight:600"> / {cap}</span></div>
		<div class="usage {usageClass}"><span style={`width:${usagePct}%`}></span></div>
		<div class="foot">{stats.conversations} all-time · cap {usagePct}% used</div>
	</div>
	<div class="tile">
		<div class="k">Leads</div>
		<div class="v">{stats.leads}</div>
		<div class="foot">captured to WhatsApp / email</div>
	</div>
	<div class="tile">
		<div class="k">Knowledge items</div>
		<div class="v">{stats.items}</div>
		<div class="foot">the verified catalogue</div>
	</div>
	<div class="tile">
		<div class="k">WhatsApp handoff</div>
		<div class="v" style="font-size:1.1rem;padding-top:.55rem">{whatsapp ?? '—'}</div>
		<div class="foot">{whatsapp ? 'lead destination set' : 'not set — leads have nowhere to go'}</div>
	</div>
</div>
