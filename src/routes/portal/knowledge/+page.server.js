import { supabase } from '$lib/server/supabase.js';
import {
	addKnowledge,
	updateKnowledge,
	deleteKnowledge,
	duplicateKnowledge,
	importKnowledge,
	resyncEmbeddings,
	addDeparture,
	deleteDeparture
} from '$lib/server/tenant.js';
import { departuresByItem } from '$lib/server/tours.js';
import { customerQuestions } from '$lib/server/dashboard.js';
import { scanWebsite, importWebsitePages, detectConflicts, resolveConflict as resolveConflictFn } from '$lib/server/website-sync.js';
import { planAllows, FEATURE } from '$lib/server/gating.js';
import { fail } from '@sveltejs/kit';

export async function load({ locals }) {
	const clientId = locals.user.client_id;
	const [itemsRes, convRes, clientRes] = await Promise.all([
		supabase.from('knowledge_items').select('*').eq('client_id', clientId).order('updated_at', { ascending: false }),
		supabase.from('conversations').select('messages').eq('client_id', clientId).order('created_at', { ascending: false }).limit(60),
		supabase.from('clients').select('website_url').eq('id', clientId).maybeSingle()
	]);
	const list = itemsRes.data ?? [];
	const tourIds = list.filter((i) => (i.category ?? '').toLowerCase().includes('tour')).map((i) => i.id);
	const departures = await departuresByItem(clientId, tourIds);
	const questions = customerQuestions(convRes.data ?? []);

	// Website Knowledge health + conflict review.
	const websiteItems = list.filter((i) => i?.metadata?.source === 'website');
	const lastSync = websiteItems.reduce((a, i) => {
		const t = i.metadata?.last_synced;
		return t && (!a || t > a) ? t : a;
	}, null);
	const conflicts = detectConflicts(list);

	return {
		items: list,
		departures,
		questions,
		websiteUrl: clientRes.data?.website_url ?? '',
		websiteHealth: { connected: websiteItems.length, lastSync, conflicts: conflicts.length },
		conflicts
	};
}

export const actions = {
	addItem: async ({ request, locals }) => addKnowledge(locals.user.client_id, await request.formData()),
	updateItem: async ({ request, locals }) => updateKnowledge(locals.user.client_id, await request.formData()),
	deleteItem: async ({ request, locals }) => deleteKnowledge(locals.user.client_id, await request.formData()),
	duplicateItem: async ({ request, locals }) => duplicateKnowledge(locals.user.client_id, await request.formData()),
	bulkImport: async ({ request, locals }) => importKnowledge(locals.user.client_id, await request.formData()),
	resync: async ({ locals }) => resyncEmbeddings(locals.user.client_id),
	addDeparture: async ({ request, locals }) => addDeparture(locals.user.client_id, await request.formData()),
	deleteDeparture: async ({ request, locals }) => deleteDeparture(locals.user.client_id, await request.formData()),

	// Website Knowledge Sync — scan a site for pages, then import the approved ones.
	scanWebsite: async ({ request, locals }) => {
		const clientId = locals.user.client_id;
		const { data: c } = await supabase.from('clients').select('plan').eq('id', clientId).maybeSingle();
		if (!(await planAllows(c?.plan, FEATURE.WEBSITE_SYNC))) {
			return fail(403, { section: 'website', error: 'Website Sync isn’t included in your plan — upgrade to connect your website.' });
		}
		const form = await request.formData();
		const url = String(form.get('url') ?? '').trim();
		const result = await scanWebsite(url);
		if (result.error) return fail(400, { section: 'website', error: result.error });
		// Remember the address so we can prefill it next time.
		await supabase.from('clients').update({ website_url: result.origin }).eq('id', clientId);
		return { section: 'website', scan: result };
	},

	importWebsite: async ({ request, locals }) => {
		const clientId = locals.user.client_id;
		const { data: c } = await supabase.from('clients').select('plan').eq('id', clientId).maybeSingle();
		if (!(await planAllows(c?.plan, FEATURE.WEBSITE_SYNC))) {
			return fail(403, { section: 'website', error: 'Website Sync isn’t included in your plan.' });
		}
		const form = await request.formData();
		let urls = [];
		try {
			urls = JSON.parse(String(form.get('urls') ?? '[]'));
		} catch {
			urls = [];
		}
		const { imported, failed } = await importWebsitePages(clientId, urls);
		return {
			section: 'website',
			ok: `Connected ${imported} page${imported === 1 ? '' : 's'} from your website${failed.length ? ` · ${failed.length} skipped` : ''}.`,
			failed
		};
	},

	resolveConflict: async ({ request, locals }) => {
		const form = await request.formData();
		const r = await resolveConflictFn(locals.user.client_id, {
			action: String(form.get('action') ?? ''),
			websiteId: String(form.get('websiteId') ?? ''),
			knowledgeId: String(form.get('knowledgeId') ?? '')
		});
		if (r.error) return fail(400, { section: 'website', error: r.error });
		return { section: 'website', ok: r.ok };
	}
};
