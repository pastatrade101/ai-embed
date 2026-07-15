<script>
	// Cumulative tenant-growth area — the only honest growth timeseries (from
	// clients.created_at). Plain SVG polyline + gradient fill.
	export let series = [];
	export let height = 90;
	const W = 640;
	$: max = Math.max(1, ...series);
	$: min = Math.min(...series, 0);
	$: n = series.length || 1;
	$: sx = (i) => (n === 1 ? 0 : (i / (n - 1)) * W);
	$: sy = (v) => height - 4 - ((v - min) / (max - min || 1)) * (height - 12);
	$: linePts = series.map((v, i) => `${sx(i)},${sy(v)}`).join(' ');
	$: areaPts = series.length ? `0,${height} ${linePts} ${W},${height}` : '';
</script>

<svg class="area" viewBox="0 0 {W} {height}" preserveAspectRatio="none" role="img" aria-label="Client growth">
	<defs>
		<linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="var(--mint)" stop-opacity="0.32" />
			<stop offset="100%" stop-color="var(--mint)" stop-opacity="0" />
		</linearGradient>
	</defs>
	{#if series.length}
		<polygon points={areaPts} fill="url(#gv)" />
		<polyline points={linePts} fill="none" stroke="var(--mint)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
	{/if}
</svg>

<style>
	.area {
		width: 100%;
		display: block;
	}
</style>
