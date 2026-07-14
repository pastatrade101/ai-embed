<script>
	// Guided onboarding checklist. Progress is derived from the operator's real
	// account state (no extra table) so it stays honest and self-updating. Shows a
	// full checklist while there's work left, and collapses to a slim success
	// banner once everything's done so it never nags a set-up operator.
	export let client;
	export let stats;

	$: hostedUrl = `/c/${client.slug}`;
	$: steps = [
		{
			done: !!client.is_active,
			label: 'Your AI assistant is live',
			hint: 'Ready to answer customers'
		},
		{
			done: !!client.whatsapp_number,
			label: 'Add your WhatsApp number',
			hint: 'So the assistant can hand you leads',
			href: '/portal/settings',
			cta: 'Add number'
		},
		{
			done: (stats?.items ?? 0) > 0,
			label: 'Add your tours & info',
			hint: 'The knowledge your assistant answers from',
			href: '/portal/knowledge',
			cta: 'Add tours'
		},
		{
			done: !!(client.logo_url || client.welcome_message || client.assistant_name),
			label: 'Personalize your assistant',
			hint: 'Logo, name and welcome message',
			href: '/portal/settings',
			cta: 'Personalize'
		},
		{
			done: (stats?.conversations ?? 0) > 0,
			label: 'Test your assistant',
			hint: 'Open your page and ask it something',
			href: hostedUrl,
			external: true,
			cta: 'Open page'
		},
		{
			done: (stats?.leads ?? 0) > 0,
			label: 'Get your first lead',
			hint: 'Share your page below to start'
		}
	];
	$: doneCount = steps.filter((s) => s.done).length;
	$: total = steps.length;
	$: pct = Math.round((doneCount / total) * 100);
	$: nextStep = steps.find((s) => !s.done && s.href);
</script>

{#if pct === 100}
	<div class="card onb-done">
		<span class="onb-done-ico">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
		</span>
		<div>
			<b>You're all set — customers can reach you.</b>
			<div class="muted" style="font-size:.85rem">Share your page below on WhatsApp, Instagram or a QR code to bring in leads.</div>
		</div>
	</div>
{:else}
	<div class="card onb">
		<div class="onb-head">
			<div>
				<h2 class="section" style="margin:0">Get set up</h2>
				<div class="muted" style="font-size:.88rem;margin-top:.15rem">A few steps to your first AI-qualified lead.</div>
			</div>
			<div class="onb-pct">
				<span class="onb-pct-n">{pct}%</span>
				<span class="faint" style="font-size:.76rem">ready</span>
			</div>
		</div>

		<div class="onb-bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
			<span style={`width:${pct}%`}></span>
		</div>

		<a class="btn onb-start" href="/portal/setup">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/><path d="M9 10h6M9 14h4"/></svg>
			Set up your assistant
		</a>

		<ul class="onb-list">
			{#each steps as s}
				<li class="onb-step" class:done={s.done}>
					<span class="onb-check">
						{#if s.done}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
						{/if}
					</span>
					<span class="onb-text">
						<span class="onb-label">{s.label}</span>
						<span class="onb-hint faint">{s.hint}</span>
					</span>
					{#if !s.done && s.href}
						<a class="btn ghost sm onb-cta" href={s.href} target={s.external ? '_blank' : undefined} rel={s.external ? 'noopener' : undefined}>{s.cta}</a>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.onb-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}
	.onb-pct {
		text-align: right;
		flex-shrink: 0;
		line-height: 1.1;
	}
	.onb-pct-n {
		display: block;
		font-size: 1.35rem;
		font-weight: 800;
		color: var(--mint);
	}
	.onb-bar {
		height: 7px;
		border-radius: 99px;
		background: var(--panel-2);
		overflow: hidden;
		margin: 0.85rem 0 1.1rem;
		border: 1px solid var(--edge);
	}
	.onb-bar span {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: linear-gradient(90deg, var(--mint), var(--accent));
		transition: width 0.4s ease;
	}
	.onb-start {
		margin-bottom: 1rem;
	}
	.onb-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.onb-step {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.62rem 0;
		border-top: 1px solid var(--line-2);
	}
	.onb-step:first-child {
		border-top: 0;
	}
	.onb-check {
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		border: 1.5px solid var(--edge);
		color: var(--ink-text);
		background: transparent;
	}
	.onb-check svg {
		width: 13px;
		height: 13px;
	}
	.onb-step.done .onb-check {
		background: var(--mint);
		border-color: var(--mint);
	}
	.onb-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.onb-label {
		font-size: 0.92rem;
		font-weight: 600;
		color: var(--strong);
	}
	.onb-step.done .onb-label {
		color: var(--soft);
	}
	.onb-hint {
		font-size: 0.78rem;
	}
	.onb-cta {
		flex-shrink: 0;
	}

	.onb-done {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}
	.onb-done-ico {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: rgba(55, 224, 166, 0.16);
		border: 1px solid rgba(55, 224, 166, 0.35);
		color: var(--mint);
	}
	.onb-done-ico svg {
		width: 20px;
		height: 20px;
	}
</style>
