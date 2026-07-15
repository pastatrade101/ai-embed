<script>
	// 14-day (or N-point) trend: bars for the primary series, optional overlaid
	// line for a secondary series. Both are plain arrays of counts from real
	// created_at buckets.
	export let bars = [];
	export let line = null;
	export let height = 64;
	export let barColor = 'var(--accent)';
	export let lineColor = 'var(--mint)';
	const W = 320;
	$: max = Math.max(1, ...bars, ...(line ?? []));
	$: n = bars.length || 1;
	$: bw = W / n;
	$: pts = (line ?? [])
		.map((v, i) => `${(i + 0.5) * bw},${height - (v / max) * (height - 6) - 3}`)
		.join(' ');
</script>

<svg class="trend" viewBox="0 0 {W} {height}" preserveAspectRatio="none" role="img" aria-label="Trend">
	{#each bars as v, i}
		<rect
			x={i * bw + bw * 0.16}
			y={height - (v / max) * (height - 6) - 3}
			width={bw * 0.68}
			height={Math.max(1, (v / max) * (height - 6))}
			rx="1.5"
			fill={barColor}
			opacity={v ? 0.85 : 0.25}
		/>
	{/each}
	{#if line}
		<polyline points={pts} fill="none" stroke={lineColor} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
	{/if}
</svg>

<style>
	.trend {
		width: 100%;
		display: block;
	}
</style>
