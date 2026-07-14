<script>
	import LeadsTable from '$lib/components/LeadsTable.svelte';
	export let data;
	$: client = data.client;
</script>

<div class="page-head">
	<div>
		<h1>Leads</h1>
		<div class="sub">Everyone who left their details with your assistant. Reach out on WhatsApp to close.</div>
	</div>
</div>

<LeadsTable leads={data.leads} leadEmail={client.lead_email} />
