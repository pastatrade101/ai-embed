// POST /api/notifications/whatsapp/document  { to, link | id, filename?, caption?, pdf? }
// Used later to deliver quotation / invoice PDFs. Set pdf:true to enforce a .pdf name.
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
	if (!body.to || (!body.link && !body.id)) return json({ ok: false, error: '`to` and one of `link`/`id` are required' }, { status: 422 });

	const res = await NotificationService.send({
		channel: Channel.WHATSAPP,
		type: body.pdf ? 'pdf' : 'document',
		to: body.to,
		link: body.link,
		id: body.id,
		filename: body.filename,
		caption: body.caption
	});
	return json(res, { status: res.ok ? 200 : res.skipped ? 503 : 502 });
}
