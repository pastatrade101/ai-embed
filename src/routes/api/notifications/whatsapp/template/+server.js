// POST /api/notifications/whatsapp/template  { to, name, language?, parameters?[], components?[] }
import { json } from '@sveltejs/kit';
import { NotificationService, Channel, notifyAuthorized } from '$lib/server/notifications.js';

export async function POST(event) {
	if (!notifyAuthorized(event)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	let body;
	try {
		body = await event.request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
	}
	if (!body.to || !body.name) return json({ ok: false, error: '`to` and `name` are required' }, { status: 422 });

	const res = await NotificationService.send({
		channel: Channel.WHATSAPP,
		type: 'template',
		to: body.to,
		name: body.name,
		language: body.language,
		parameters: body.parameters,
		components: body.components
	});
	return json(res, { status: res.ok ? 200 : res.skipped ? 503 : 502 });
}
