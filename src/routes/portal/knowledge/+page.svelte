<script>
	import KnowledgeManager from '$lib/components/KnowledgeManager.svelte';
	export let data;
	export let form;
</script>

<div class="page-head">
	<div>
		<h1>Knowledge</h1>
		<div class="sub">This is what your assistant answers from. Keep prices and details current — a stale price is the #1 cause of wrong answers.</div>
	</div>
</div>

<KnowledgeManager items={data.items} departures={data.departures} {form} />
