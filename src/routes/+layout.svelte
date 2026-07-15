<script>
	import '../app.css';
	import GlobalProgress from '$lib/components/GlobalProgress.svelte';
</script>

<svelte:head>
	<!-- Default title; each page overrides it via its own <svelte:head>. -->
	<title>Makutano Digital</title>
</svelte:head>

<GlobalProgress />
<slot />
