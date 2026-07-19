import { fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { getProposalSettings, saveProposalSettings, isMissingProposalAI } from '$lib/server/proposal-settings.js';

// Proposal AI performance — derived from existing proposals + their meta. No new
// tables; fails open (empty) before migration 018.
async function analytics(clientId) {
	const empty = { total: 0, byStatus: {}, aiPct: 0, avgValue: 0, avgAcceptedValue: 0, acceptanceRate: 0, sent: 0, avgViews: 0, topMissing: [], accepted: 0, revenue: 0, upsellReady: 0 };
	const { data, error } = await supabase
		.from('proposals')
		.select('status, total, viewed_count, meta, created_at, sent_at, accepted_at')
		.eq('client_id', clientId)
		.limit(1000);
	if (error || !data) return empty;
	const rows = data;
	const total = rows.length;
	if (!total) return empty;
	const byStatus = {};
	let aiCount = 0, valueSum = 0, acceptedSum = 0, acceptedCount = 0, viewsSum = 0, upsellReady = 0;
	const missing = {};
	for (const p of rows) {
		byStatus[p.status] = (byStatus[p.status] || 0) + 1;
		const m = p.meta || {};
		if (m.creationMode || m.aiCta || (Array.isArray(m.aiUpsell) && m.aiUpsell.length) || m.requirements) aiCount++;
		if (Array.isArray(m.aiUpsell) && m.aiUpsell.length) upsellReady++;
		valueSum += Number(p.total) || 0;
		viewsSum += p.viewed_count || 0;
		if (p.status === 'accepted' || p.status === 'converted') {
			acceptedCount++;
			acceptedSum += Number(p.total) || 0;
		}
		const mr = m.requirements?.missing;
		if (Array.isArray(mr)) for (const x of mr) { const k = String(x).trim(); if (k) missing[k] = (missing[k] || 0) + 1; }
	}
	const decided = (byStatus.accepted || 0) + (byStatus.converted || 0) + (byStatus.declined || 0);
	return {
		total,
		byStatus,
		aiPct: Math.round((aiCount / total) * 100),
		avgValue: Math.round(valueSum / total),
		avgAcceptedValue: acceptedCount ? Math.round(acceptedSum / acceptedCount) : 0,
		acceptanceRate: decided ? Math.round((((byStatus.accepted || 0) + (byStatus.converted || 0)) / decided) * 100) : 0,
		sent: total - (byStatus.draft || 0),
		avgViews: Math.round((viewsSum / total) * 10) / 10,
		topMissing: Object.entries(missing).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ k, v })),
		accepted: acceptedCount,
		revenue: acceptedSum,
		upsellReady
	};
}

export async function load({ locals }) {
	const clientId = locals.user.client_id;
	const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
	let needsMigration = false;
	const probe = await supabase.from('clients').select('proposal_ai').eq('id', clientId).limit(1);
	if (probe.error && isMissingProposalAI(probe.error)) needsMigration = true;
	return {
		settings: getProposalSettings(client),
		needsMigration,
		analytics: await analytics(clientId),
		currency: client?.default_currency || 'USD'
	};
}

export const actions = {
	save: async ({ locals, request }) => {
		let parsed = {};
		try {
			parsed = JSON.parse(String((await request.formData()).get('settings') ?? '{}'));
		} catch {
			return fail(400, { error: 'Could not read the settings.' });
		}
		const res = await saveProposalSettings(locals.user.client_id, parsed);
		if (res.needsMigration) return fail(400, { error: 'Proposal AI settings need a one-time database update — run db/019_proposal_ai.sql in Supabase, then save again.' });
		if (!res.ok) return fail(400, { error: 'Could not save settings.' });
		return { ok: 'Settings saved.', settings: res.settings };
	}
};
