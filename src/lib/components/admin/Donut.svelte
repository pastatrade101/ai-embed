<script>
	// Plan-distribution donut. Segments = [{label, value, color}]. Pure SVG,
	// the r=15.915 trick makes the circumference exactly 100 so each segment's
	// dasharray is just its percentage.
	export let segments = [];
	export let centerValue = '';
	export let centerLabel = '';
	$: total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
	$: arcs = (() => {
		let acc = 0;
		return segments
			.filter((s) => s.value > 0)
			.map((s) => {
				const pct = (s.value / total) * 100;
				const seg = { ...s, pct, offset: 25 - acc };
				acc += pct;
				return seg;
			});
	})();
</script>

<div class="donut">
	<svg viewBox="0 0 42 42" role="img" aria-label="Plan distribution">
		<circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--edge)" stroke-width="4.5" />
		{#each arcs as a}
			<circle
				cx="21"
				cy="21"
				r="15.915"
				fill="none"
				stroke={a.color}
				stroke-width="4.5"
				stroke-dasharray="{a.pct} {100 - a.pct}"
				stroke-dashoffset={a.offset}
				stroke-linecap="butt"
			/>
		{/each}
		<text x="21" y="20" class="c-val">{centerValue}</text>
		<text x="21" y="26.5" class="c-lab">{centerLabel}</text>
	</svg>
</div>

<style>
	.donut {
		width: 130px;
		height: 130px;
		flex: none;
	}
	.donut svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	.c-val {
		fill: var(--strong);
		font-size: 8px;
		font-weight: 700;
		text-anchor: middle;
		transform: rotate(90deg);
		transform-origin: 21px 21px;
	}
	.c-lab {
		fill: var(--muted);
		font-size: 3px;
		text-anchor: middle;
		text-transform: uppercase;
		letter-spacing: 0.1px;
		transform: rotate(90deg);
		transform-origin: 21px 21px;
	}
</style>
