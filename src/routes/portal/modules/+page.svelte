<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	export let data;
	export let form;

	// Use the fresh catalog the toggle action returns, falling back to the load data.
	$: modules = form?.modules || data.modules || [];
	$: groups = [...new Set(modules.map((m) => m.group))];
	$: enabledCount = modules.filter((m) => m.enabled && !m.core).length;

	function afterToggle() {
		return async ({ update }) => { await update({ reset: false }); await invalidateAll(); };
	}
</script>

<div class="page-head">
	<div>
		<h1>Modules</h1>
		<div class="sub">Turn on the parts of the business OS you need. WhatsApp stays connected — no re-onboarding.</div>
	</div>
	<div class="actions"><span class="badge neutral">{enabledCount} add-on{enabledCount === 1 ? '' : 's'} active</span></div>
</div>

{#if form?.error}<div class="notice err">{form.error}</div>{/if}

{#each groups as g}
	<div class="group-h">{g}</div>
	<div class="grid">
		{#each modules.filter((m) => m.group === g) as m (m.key)}
			<div class="mod" class:on={m.enabled} class:soon={m.comingSoon}>
				<div class="mod-top">
					<span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d={m.icon} /></svg></span>
					{#if m.core}
						<span class="state core">Core</span>
					{:else if m.comingSoon}
						<span class="state soon">Coming soon</span>
					{:else}
						<form method="POST" action="?/toggle" use:enhance={afterToggle}>
							<input type="hidden" name="key" value={m.key} />
							<input type="hidden" name="enabled" value={(!m.enabled).toString()} />
							<button class="sw" class:active={m.enabled} type="submit" aria-label={`${m.enabled ? 'Disable' : 'Enable'} ${m.name}`}><span class="knob"></span></button>
						</form>
					{/if}
				</div>
				<div class="mod-name">{m.name}</div>
				<div class="mod-desc">{m.desc}</div>
				{#if m.enabled && !m.core}<a class="mod-open" href={`/portal/${m.key === 'orders' ? 'orders' : ''}`}>Open →</a>{/if}
			</div>
		{/each}
	</div>
{/each}

<style>
	.group-h { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 700; margin: 1.4rem 0 0.7rem; }
	.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.9rem; }
	.mod { background: var(--panel); border: 1px solid var(--edge); border-radius: 15px; padding: 1.1rem; display: flex; flex-direction: column; transition: border-color 0.15s, transform 0.1s; }
	.mod.on { border-color: color-mix(in srgb, var(--mint) 45%, var(--edge)); }
	.mod.soon { opacity: 0.62; }
	.mod-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.7rem; }
	.ico { width: 40px; height: 40px; border-radius: 11px; background: rgba(var(--panel-rgb, 255, 255, 255), 0.05); display: grid; place-items: center; color: var(--mint); }
	.ico svg { width: 20px; height: 20px; }
	.mod-name { font-weight: 700; color: var(--strong); font-size: 1rem; }
	.mod-desc { color: var(--muted); font-size: 0.86rem; line-height: 1.5; margin-top: 0.25rem; flex: 1; }
	.mod-open { color: var(--mint); font-weight: 600; font-size: 0.85rem; text-decoration: none; margin-top: 0.7rem; }
	.state { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 999px; }
	.state.core { color: var(--mint); background: rgba(46, 204, 113, 0.14); }
	.state.soon { color: var(--muted); background: rgba(var(--panel-rgb, 255, 255, 255), 0.06); }
	.sw { width: 42px; height: 24px; border-radius: 999px; border: 1px solid var(--edge); background: rgba(var(--panel-rgb, 255, 255, 255), 0.08); position: relative; cursor: pointer; padding: 0; transition: background 0.15s; }
	.sw.active { background: var(--mint); border-color: var(--mint); }
	.knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.16s; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); }
	.sw.active .knob { transform: translateX(18px); }
</style>
