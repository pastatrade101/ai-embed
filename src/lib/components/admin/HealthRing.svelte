<script>
	// Client health ring — an SVG arc for a 0–100 heuristic score.
	export let score = 0;
	export let size = 44;
	export let cls = 'cool';
	const COLORS = { hot: 'var(--mint)', warm: 'var(--accent)', cool: 'var(--warn)', cold: 'var(--danger)' };
	$: color = COLORS[cls] ?? 'var(--muted)';
	$: dash = Math.max(0, Math.min(100, score));
</script>

<div class="ring" style="width:{size}px;height:{size}px">
	<svg viewBox="0 0 42 42" aria-label="Health {score}">
		<circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--edge)" stroke-width="4" />
		<circle
			cx="21"
			cy="21"
			r="15.915"
			fill="none"
			stroke={color}
			stroke-width="4"
			stroke-dasharray="{dash} {100 - dash}"
			stroke-dashoffset="25"
			stroke-linecap="round"
		/>
		<text x="21" y="24.5" class="rv">{score}</text>
	</svg>
</div>

<style>
	.ring svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	.rv {
		fill: var(--strong);
		font-size: 11px;
		font-weight: 700;
		text-anchor: middle;
		transform: rotate(90deg);
		transform-origin: 21px 21px;
	}
</style>
