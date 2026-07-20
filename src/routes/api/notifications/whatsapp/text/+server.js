// POST /api/notifications/whatsapp/text  { to, text, previewUrl? }
// Manual/trigger endpoint. Auth: operator/admin session, or x-internal-key.
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
	if (!body.to || !body.text) return json({ ok: false, error: '`to` and `text` are required' }, { status: 422 });

	const res = await NotificationService.send({ channel: Channel.WHATSAPP, type: 'text', to: body.to, text: body.text, previewUrl: body.previewUrl });
	return json(res, { status: res.ok ? 200 : res.skipped ? 503 : 502 });
}
