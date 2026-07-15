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

export async function load({ locals }) {
	const clientId = locals.user.client_id;
	const [itemsRes, convRes] = await Promise.all([
		supabase.from('knowledge_items').select('*').eq('client_id', clientId).order('updated_at', { ascending: false }),
		supabase.from('conversations').select('messages').eq('client_id', clientId).order('created_at', { ascending: false }).limit(60)
	]);
	const list = itemsRes.data ?? [];
	const tourIds = list.filter((i) => (i.category ?? '').toLowerCase().includes('tour')).map((i) => i.id);
	const departures = await departuresByItem(clientId, tourIds);
	const questions = customerQuestions(convRes.data ?? []);
	return { items: list, departures, questions };
}

export const actions = {
	addItem: async ({ request, locals }) => addKnowledge(locals.user.client_id, await request.formData()),
	updateItem: async ({ request, locals }) => updateKnowledge(locals.user.client_id, await request.formData()),
	deleteItem: async ({ request, locals }) => deleteKnowledge(locals.user.client_id, await request.formData()),
	duplicateItem: async ({ request, locals }) => duplicateKnowledge(locals.user.client_id, await request.formData()),
	bulkImport: async ({ request, locals }) => importKnowledge(locals.user.client_id, await request.formData()),
	resync: async ({ locals }) => resyncEmbeddings(locals.user.client_id),
	addDeparture: async ({ request, locals }) => addDeparture(locals.user.client_id, await request.formData()),
	deleteDeparture: async ({ request, locals }) => deleteDeparture(locals.user.client_id, await request.formData())
};
