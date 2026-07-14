<script>
	import ConversationList from '$lib/components/ConversationList.svelte';
	export let data;
</script>

<div class="page-head">
	<div>
		<h1>Conversations</h1>
		<div class="sub">Every chat your assistant has had. Skim them to spot questions you should add to your knowledge.</div>
	</div>
</div>

<ConversationList conversations={data.conversations} />
