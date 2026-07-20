<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: convos = data.conversations ?? [];
	let openId = null;

	const fmtTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
	const money = (n, cur) => (n == null ? '—' : `${cur || ''} ${Math.round(Number(n) || 0).toLocaleString('en-US')}`.trim());
	// Live-ish window countdown (recomputes on render).
	const windowLabel = (iso) => {
		if (!iso) return { open: false, text: 'window closed' };
		const ms = new Date(iso).getTime() - Date.now();
		if (ms <= 0) return { open: false, text: 'window closed' };
		const h = Math.floor(ms / 3600000), m = Math.round((ms % 3600000) / 60000);
		return { open: true, text: `${h}h ${m}m left` };
	};
	const STATUS = { active: 'Active', paused: 'Human', escalated: 'Escalated', closed: 'Closed' };
</script>

<div class="page-head">
	<div>
		<h1>WhatsApp conversations</h1>
		<div class="sub">Live proposal negotiations across all tenants. Take over any thread, or let the AI run.</div>
	</div>
	<a class="btn sm ghost" href="/admin/whatsapp">← Test bench</a>
</div>

{#if data.needsMigration}
	<div class="notice err">WhatsApp conversations need a one-time database update — run <code>db/020_wa_conversations.sql</code> in Supabase.</div>
{/if}
{#if form?.error}<div class="notice err">{form.error}</div>{:else if form?.ok}<div class="notice">{form.ok}</div>{/if}

{#if !convos.length && !data.needsMigration}
	<div class="card empty">No WhatsApp conversations yet. Start one from a proposal (Share ▸ “Start AI WhatsApp chat”).</div>
{:else}
	<div class="list">
		{#each convos as c (c.id)}
			{@const win = windowLabel(c.windowExpiresAt)}
			<div class="conv card" class:open={openId === c.id}>
				<button class="conv-head" on:click={() => (openId = openId === c.id ? null : c.id)}>
					<div class="ch-main">
						<div class="ch-top">
							<span class="ch-client">{c.clientName}</span>
							<span class="ch-phone">+{c.customerPhone}</span>
							{#if c.proposalNumber}<span class="ch-prop">{c.proposalNumber} · v{c.proposalVersion} · {money(c.proposalTotal, c.proposalCurrency)}</span>{/if}
						</div>
						<div class="ch-sub">{c.messages.length ? c.messages[c.messages.length - 1].text.slice(0, 90) : 'No messages'} · {fmtTime(c.updatedAt)}</div>
					</div>
					<div class="ch-badges">
						<span class="pill s-{c.status}">{STATUS[c.status] || c.status}</span>
						<span class="pill {c.aiEnabled ? 'ai-on' : 'ai-off'}">{c.aiEnabled ? '🤖 AI' : '👤 Human'}</span>
						<span class="pill win {win.open ? 'w-on' : 'w-off'}">{win.text}</span>
					</div>
				</button>

				{#if openId === c.id}
					<div class="conv-body">
						{#if c.escalation}<div class="escal">⚠ Escalated: {c.escalation.reason} · {fmtTime(c.escalation.at)}</div>{/if}
						<div class="thread">
							{#each c.messages as m}
								<div class="msg {m.role}">
									{#if m.role === 'system'}<span class="sys">{m.text}</span>
									{:else}<span class="bubble"><span class="who">{m.role === 'customer' ? 'Customer' : m.role === 'agent' ? 'You' : 'AI'}</span>{m.text}<span class="mt">{fmtTime(m.at)}</span></span>{/if}
								</div>
							{/each}
							{#if !c.messages.length}<div class="muted">No messages yet.</div>{/if}
						</div>

						<div class="conv-actions">
							{#if c.status !== 'closed'}
								<form method="POST" action="?/toggleAi" use:enhance>
									<input type="hidden" name="id" value={c.id} />
									<input type="hidden" name="enabled" value={c.aiEnabled ? 'false' : 'true'} />
									<button class="btn sm {c.aiEnabled ? '' : 'gold'}">{c.aiEnabled ? 'Take over (pause AI)' : 'Resume AI'}</button>
								</form>
								<form method="POST" action="?/close" use:enhance>
									<input type="hidden" name="id" value={c.id} />
									<button class="btn sm ghost">Close</button>
								</form>
							{/if}
							{#if c.aiEnabled === false && c.status !== 'closed'}<span class="tip">You’ve taken over — reply to the customer from WhatsApp; the AI won’t respond until you resume.</span>{/if}
						</div>

						{#if c.timeline.length}
							<details class="tl"><summary>Timeline ({c.timeline.length})</summary>
								<ul>{#each [...c.timeline].reverse() as t}<li><b>{t.type.replace(/_/g, ' ')}</b><span>{fmtTime(t.at)}</span></li>{/each}</ul>
							</details>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.list { display: flex; flex-direction: column; gap: 0.7rem; }
	.conv { padding: 0; overflow: hidden; }
	.conv-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.1rem; background: none; border: 0; cursor: pointer; text-align: left; color: inherit; }
	.conv.open .conv-head { border-bottom: 1px solid var(--line-2); }
	.ch-main { min-width: 0; flex: 1; }
	.ch-top { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
	.ch-client { font-weight: 700; color: var(--strong); }
	.ch-phone { font-size: 0.82rem; color: var(--soft); font-variant-numeric: tabular-nums; }
	.ch-prop { font-size: 0.78rem; color: var(--muted); }
	.ch-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.ch-badges { display: flex; gap: 0.35rem; flex: none; flex-wrap: wrap; justify-content: flex-end; }
	.pill { font-size: 0.7rem; font-weight: 700; padding: 0.18rem 0.5rem; border-radius: 999px; white-space: nowrap; background: rgba(255, 255, 255, 0.08); color: var(--soft); }
	.pill.s-active { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
	.pill.s-escalated { background: rgba(220, 38, 38, 0.2); color: #fca5a5; }
	.pill.s-paused { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
	.pill.ai-on { background: rgba(22, 163, 74, 0.2); color: #6ee7a8; }
	.pill.ai-off { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
	.pill.w-on { background: rgba(22, 163, 74, 0.14); color: #6ee7a8; }
	.pill.w-off { background: rgba(255, 255, 255, 0.06); color: var(--muted); }
	.conv-body { padding: 1rem 1.1rem; }
	.escal { font-size: 0.82rem; color: #fca5a5; margin-bottom: 0.8rem; }
	.thread { display: flex; flex-direction: column; gap: 0.5rem; max-height: 360px; overflow-y: auto; padding: 0.3rem; }
	.msg { display: flex; }
	.msg.customer { justify-content: flex-start; }
	.msg.ai, .msg.agent { justify-content: flex-end; }
	.msg.system { justify-content: center; }
	.bubble { max-width: 78%; font-size: 0.86rem; line-height: 1.45; padding: 0.5rem 0.7rem; border-radius: 12px; background: rgba(255, 255, 255, 0.06); color: var(--soft); position: relative; }
	.msg.ai .bubble { background: rgba(var(--gold-rgb), 0.14); color: var(--strong); }
	.msg.agent .bubble { background: rgba(59, 130, 246, 0.16); color: #cfe0ff; }
	.who { display: block; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 0.15rem; }
	.mt { display: block; font-size: 0.64rem; color: var(--muted); margin-top: 0.2rem; text-align: right; }
	.sys { font-size: 0.72rem; color: var(--muted); font-style: italic; }
	.conv-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-top: 0.9rem; padding-top: 0.8rem; border-top: 1px solid var(--line-2); }
	.tip { font-size: 0.76rem; color: var(--muted); }
	.tl { margin-top: 0.8rem; }
	.tl summary { cursor: pointer; font-size: 0.8rem; color: var(--muted); }
	.tl ul { list-style: none; margin: 0.5rem 0 0; padding: 0; display: grid; gap: 0.3rem; }
	.tl li { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--soft); text-transform: capitalize; }
	.tl li span { color: var(--muted); }
	.empty { text-align: center; color: var(--muted); }
	.muted { color: var(--muted); font-size: 0.85rem; }
</style>
