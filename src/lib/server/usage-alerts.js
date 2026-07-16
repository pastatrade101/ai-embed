// Usage notifications — email the operator as they approach/hit their monthly AI
// allowance, so limits are never a surprise. De-duped per threshold per billing
// period via clients.ai_usage_alerts, so each level is sent at most once a month.
// Fire-and-forget: called from the chat gate; never blocks a reply.
import { supabase } from './supabase.js';
import { sendEmail } from './email.js';

const THRESHOLDS = [100, 95, 80]; // highest first — report the strongest level crossed

function currentPeriod() {
	const n = new Date();
	return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

const crossed = (pct) => THRESHOLDS.find((t) => pct >= t) ?? null;

// In-process claim lock: closes the read-modify-write window so several new
// conversations crossing a threshold at once don't each send a duplicate email.
// (Durable de-dup is the DB `sent` array; this just prevents concurrent sends.)
const inflight = new Set();

function alertCopy(name, threshold, status) {
	const remaining = Math.max(0, Math.round(status.estRemainingConversations ?? 0));
	const who = name || 'there';
	if (threshold >= 100) {
		return {
			subject: 'Your AI assistant has reached this month’s allowance',
			text: `Hi ${who},\n\nYour AI assistant has used 100% of this month's AI allowance. It's still running on a small grace allowance so live customer chats aren't interrupted, but new capacity is limited.\n\nTo restore full capacity, upgrade your plan or add AI Credits from your billing page:\n/portal/billing\n\n— Makutano`
		};
	}
	if (threshold >= 95) {
		return {
			subject: 'You’ve nearly used this month’s AI allowance',
			text: `Hi ${who},\n\nYou've used 95% of this month's AI allowance (about ${remaining} customer conversations left). To avoid any slowdown for your customers, upgrade your plan or add AI Credits:\n/portal/billing\n\n— Makutano`
		};
	}
	return {
		subject: 'You’re approaching this month’s AI allowance',
		text: `Hi ${who},\n\nHeads up — you've used 80% of this month's AI allowance (about ${remaining} customer conversations left). Everything is still working normally; if you expect a busy month, you can upgrade or add AI Credits any time:\n/portal/billing\n\n— Makutano`
	};
}

/** Send a usage alert if the tenant just crossed a threshold not yet notified
 *  this period. No-ops below 80%, without a recipient, or if already sent. */
export async function notifyUsageIfCrossed(clientId, status) {
	const threshold = crossed(status?.pct ?? 0);
	if (!threshold) return; // below 80% — nothing to say, and no DB read
	const period = currentPeriod();
	const key = `${clientId}:${period}:${threshold}`;
	if (inflight.has(key)) return; // another request is already handling this level
	inflight.add(key);
	try {
		const { data: c } = await supabase.from('clients').select('name, lead_email, contact_email, ai_usage_alerts').eq('id', clientId).maybeSingle();
		if (!c) return;
		const to = c.lead_email || c.contact_email;
		if (!to) return;

		const state = c.ai_usage_alerts && typeof c.ai_usage_alerts === 'object' ? c.ai_usage_alerts : {};
		const sent = state.period === period && Array.isArray(state.sent) ? state.sent : [];
		if (sent.includes(threshold)) return; // already told them this level this month

		const { subject, text } = alertCopy(c.name, threshold, status);
		const res = await sendEmail({ to, subject, text });
		// Only record as sent when the email actually went out — a skipped (no
		// provider) or failed (429/5xx) send stays un-marked so it retries later.
		if (!res?.ok) return;

		await supabase
			.from('clients')
			.update({ ai_usage_alerts: { period, sent: [...sent, threshold] } })
			.eq('id', clientId);
	} catch {
		/* fire-and-forget — never disrupt the chat */
	} finally {
		inflight.delete(key);
	}
}
