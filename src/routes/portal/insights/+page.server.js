import { fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { listTours } from '$lib/server/tours.js';
import { catalogueGaps } from '$lib/server/dashboard.js';
import { FEATURE, planAllows } from '$lib/server/gating.js';
import { unlockingPlanName } from '$lib/feature-value.js';
import { quota, AI } from '$lib/server/ai.js';
import { askAnalyst } from '$lib/server/analyst.js';
import { researchDraft, saveResearchDraft } from '$lib/server/research.js';

const metaGet = (md, ...keys) => {
	if (!md || typeof md !== 'object') return null;
	for (const k of Object.keys(md)) {
		if (keys.some((w) => k.toLowerCase().includes(w))) {
			const v = md[k];
			if (v != null && String(v).trim()) return String(v).trim();
		}
	}
	return null;
};

async function access(clientId, plan) {
	const [analystAllowed, researchAllowed, analystQuota, researchQuota] = await Promise.all([
		planAllows(plan, FEATURE.DATA_ANALYST),
		planAllows(plan, FEATURE.RESEARCH),
		quota(clientId, plan, AI.DATA_ANALYST),
		quota(clientId, plan, AI.RESEARCH)
	]);
	return {
		analyst: { allowed: analystAllowed, quota: analystQuota },
		research: { allowed: researchAllowed, quota: researchQuota }
	};
}

export async function load({ locals }) {
	const clientId = locals.user.client_id;
	const { data: c } = await supabase.from('clients').select('plan').eq('id', clientId).maybeSingle();
	const plan = c?.plan ?? 'free';

	// Light fetch for research topic suggestions (gaps customers ask about) + the
	// plans that unlock each premium tool, so locked blocks can name the upgrade.
	const [tourItems, { data: convs }, { data: activePlans }] = await Promise.all([
		listTours(clientId),
		supabase.from('conversations').select('messages').eq('client_id', clientId).order('created_at', { ascending: false }).limit(120),
		supabase.from('plans').select('name, features, sort, is_active').eq('is_active', true).order('sort')
	]);
	const tours = (tourItems ?? []).map((t) => ({ title: t.title, destination: metaGet(t.metadata, 'destination', 'route', 'park', 'location') }));
	const gaps = catalogueGaps(convs ?? [], tours).map((g) => g.label);

	return {
		access: await access(clientId, plan),
		suggestions: ['Which tours convert best into leads?', 'Where are my leads dropping off?', 'What’s my potential booking value this month?', 'Which travel month is most in demand?'],
		researchTopics: gaps,
		analystPlan: unlockingPlanName(activePlans, FEATURE.DATA_ANALYST),
		researchPlan: unlockingPlanName(activePlans, FEATURE.RESEARCH)
	};
}

export const actions = {
	ask: async ({ request, locals }) => {
		const clientId = locals.user.client_id;
		const { data: c } = await supabase.from('clients').select('plan').eq('id', clientId).maybeSingle();
		const plan = c?.plan ?? 'free';
		if (!(await planAllows(plan, FEATURE.DATA_ANALYST))) return fail(403, { section: 'analyst', error: 'The AI data analyst isn’t included in your plan — upgrade to use it.' });
		const form = await request.formData();
		const question = String(form.get('question') ?? '').trim();
		if (!question) return fail(400, { section: 'analyst', error: 'Ask a question about your business.' });
		let res;
		try {
			res = await askAnalyst(clientId, plan, question);
		} catch (e) {
			console.error('[insights/ask]', e?.message ?? e);
			return fail(502, { section: 'analyst', error: 'The analyst is temporarily unavailable — please try again in a moment.' });
		}
		if (res.error === 'quota') return fail(429, { section: 'analyst', error: `You’ve used all ${res.quota.limit} analyst questions this month. Upgrade for more.`, quota: res.quota });
		if (res.error === 'ai_error') return fail(502, { section: 'analyst', error: 'The analyst is temporarily unavailable — please try again in a moment.' });
		if (!res.text || !res.text.trim()) return fail(502, { section: 'analyst', error: 'The analyst couldn’t produce an answer — please rephrase and try again.' });
		return { section: 'analyst', question, answer: res.text, quota: res.quota };
	},

	research: async ({ request, locals }) => {
		const clientId = locals.user.client_id;
		const { data: c } = await supabase.from('clients').select('plan').eq('id', clientId).maybeSingle();
		const plan = c?.plan ?? 'free';
		if (!(await planAllows(plan, FEATURE.RESEARCH))) return fail(403, { section: 'research', error: 'The AI research assistant isn’t included in your plan — upgrade to use it.' });
		const form = await request.formData();
		const topic = String(form.get('topic') ?? '').trim();
		if (!topic) return fail(400, { section: 'research', error: 'Enter a topic to research.' });
		let res;
		try {
			res = await researchDraft(clientId, plan, topic);
		} catch (e) {
			console.error('[insights/research]', e?.message ?? e);
			return fail(502, { section: 'research', error: 'The research assistant is temporarily unavailable — please try again in a moment.' });
		}
		if (res.error === 'quota') return fail(429, { section: 'research', error: `You’ve used all ${res.quota.limit} research drafts this month. Upgrade for more.`, quota: res.quota });
		if (res.error === 'ai_error') return fail(502, { section: 'research', error: 'The research assistant is temporarily unavailable — please try again in a moment.' });
		if (res.error === 'empty') return fail(502, { section: 'research', error: 'Couldn’t draft an entry for that topic — try rephrasing or a more specific topic.' });
		if (res.error) return fail(400, { section: 'research', error: 'Couldn’t complete the research — please try again.' });
		return { section: 'research', topic, draft: { title: res.title, body: res.body }, quota: res.quota };
	},

	saveDraft: async ({ request, locals }) => {
		const form = await request.formData();
		const r = await saveResearchDraft(locals.user.client_id, {
			title: String(form.get('title') ?? ''),
			body: String(form.get('body') ?? ''),
			category: String(form.get('category') ?? 'Travel guide')
		});
		if (r.error) return fail(400, { section: 'research', error: r.error });
		return { section: 'research', saved: 'Added to your AI Knowledge — your assistant can now answer from it.' };
	}
};
