<script>
	import ClientSettingsForm from '$lib/components/ClientSettingsForm.svelte';
	export let data;
	export let form;
</script>

<div class="page-head">
	<div>
		<h1>Settings</h1>
		<div class="sub">Everything about your business and how your assistant behaves. Changes save together.</div>
	</div>
</div>

<ClientSettingsForm client={data.client} industry={data.industry} knowledgeCount={data.knowledgeCount} {form} />
