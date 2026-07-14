import { supabase } from '$lib/server/supabase.js';
import {
	addKnowledge,
	updateKnowledge,
	deleteKnowledge,
	importKnowledge,
	addDeparture,
	deleteDeparture
} from '$lib/server/tenant.js';
import { departuresByItem } from '$lib/server/tours.js';

export async function load({ locals }) {
	const { data: items } = await supabase
		.from('knowledge_items')
		.select('*')
		.eq('client_id', locals.user.client_id)
		.order('updated_at', { ascending: false });
	const list = items ?? [];
	const tourIds = list.filter((i) => (i.category ?? '').toLowerCase().includes('tour')).map((i) => i.id);
	const departures = await departuresByItem(locals.user.client_id, tourIds);
	return { items: list, departures };
}

export const actions = {
	addItem: async ({ request, locals }) => addKnowledge(locals.user.client_id, await request.formData()),
	updateItem: async ({ request, locals }) => updateKnowledge(locals.user.client_id, await request.formData()),
	deleteItem: async ({ request, locals }) => deleteKnowledge(locals.user.client_id, await request.formData()),
	bulkImport: async ({ request, locals }) => importKnowledge(locals.user.client_id, await request.formData()),
	addDeparture: async ({ request, locals }) => addDeparture(locals.user.client_id, await request.formData()),
	deleteDeparture: async ({ request, locals }) => deleteDeparture(locals.user.client_id, await request.formData())
};
