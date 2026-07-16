<script>
	import KnowledgeManager from '$lib/components/KnowledgeManager.svelte';
	import WebsiteSync from '$lib/components/WebsiteSync.svelte';
	export let data;
	export let form;
</script>

<div class="page-head">
	<div>
		<h1>AI Knowledge</h1>
		<div class="sub">This is the information your AI assistant uses when answering customers. Keep it accurate and up to date — your AI stays ready automatically.</div>
	</div>
</div>

<KnowledgeManager items={data.items} departures={data.departures} questions={data.questions} slug={data.client.slug} {form} />

<div style="margin-top:1.5rem">
	<WebsiteSync websiteUrl={data.websiteUrl} items={data.items} {form} />
</div>
