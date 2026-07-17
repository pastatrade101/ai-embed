<script>
	export let data;
	$: health = data.health;
	const statusWord = (s) => (s === 'operational' ? 'Operational' : 'Not set up');
</script>

<div class="page-head"><div><h1>Settings</h1><div class="sub">Platform status, integrations and what isn’t tracked yet.</div></div></div>

{#if data.loadError}
	<div class="notice err">Could not load platform data: {data.loadError}</div>
{:else if health}
	<!-- PLATFORM HEALTH -->
	<h2 class="section">Platform health</h2>
	<div class="card health">
		<div class="health-overall" class:ok={health.ok}>
			<span class="big-dot"></span>
			<div>
				<div class="ho-word">{health.ok ? 'All systems operational' : 'Some services need setup'}</div>
				<div class="ho-sub">Live status check · {health.paymentEventsToday} payment {health.paymentEventsToday === 1 ? 'event' : 'events'} today</div>
			</div>
		</div>
		<div class="health-grid">
			{#each health.checks as c}
				<div class="hcheck">
					<span class="hdot {c.status}"></span>
					<div><div class="hc-n">{c.name}</div><div class="hc-note">{c.note}</div></div>
					<span class="hc-status {c.status}">{statusWord(c.status)}</span>
				</div>
			{/each}
		</div>
		<p class="fineprint">Point-in-time check (reachability + configuration) — not a historical uptime %, which we don’t log.</p>
	</div>

	<!-- ROADMAP -->
	<h2 class="section">Not yet tracked</h2>
	<div class="roadmap">
		<div class="rm">Bookings &amp; conversion <span>needs a bookings table</span></div>
		<div class="rm">Geographic map <span>we don’t collect client location</span></div>
		<div class="rm">MRR / churn over time <span>metrics aren’t snapshotted</span></div>
		<div class="rm">Response time &amp; search volume <span>not measured</span></div>
	</div>
{/if}

<style>
	.fineprint {
		font-size: 0.72rem;
		color: var(--faint);
		margin: 0.7rem 0 0;
	}

	/* Health */
	.health-overall {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding-bottom: 0.9rem;
		margin-bottom: 0.9rem;
		border-bottom: 1px solid var(--edge);
	}
	.big-dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--warn);
		box-shadow: none;
	}
	.health-overall.ok .big-dot {
		background: var(--mint);
		box-shadow: none;
	}
	.ho-word {
		font-weight: 700;
		color: var(--strong);
	}
	.ho-sub {
		font-size: 0.78rem;
		color: var(--muted);
	}
	.health-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}
	@media (max-width: 640px) {
		.health-grid {
			grid-template-columns: 1fr;
		}
	}
	.hcheck {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.7rem;
		background: var(--panel-2);
		border-radius: 10px;
	}
	.hdot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: none;
	}
	.hdot.operational {
		background: var(--mint);
	}
	.hdot.unconfigured {
		background: var(--faint);
	}
	.hc-n {
		font-size: 0.85rem;
		color: var(--body);
		font-weight: 600;
	}
	.hc-note {
		font-size: 0.72rem;
		color: var(--muted);
	}
	.hc-status {
		margin-left: auto;
		font-size: 0.72rem;
		font-weight: 600;
	}
	.hc-status.operational {
		color: var(--mint);
	}
	.hc-status.unconfigured {
		color: var(--faint);
	}

	/* Roadmap */
	.roadmap {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.6rem;
	}
	.rm {
		border: 1px dashed var(--edge);
		border-radius: 12px;
		padding: 0.9rem 1rem;
		color: var(--muted);
		font-size: 0.86rem;
		font-weight: 600;
	}
	.rm span {
		display: block;
		font-weight: 400;
		font-size: 0.74rem;
		color: var(--faint);
		margin-top: 0.2rem;
	}
</style>
