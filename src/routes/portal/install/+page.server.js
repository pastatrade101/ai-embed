import { fail } from '@sveltejs/kit';
import { getClientById } from '$lib/server/tenant.js';
import { detectPlatform, checkInstall, buildSnippet, guideFor, PLATFORM_GUIDES } from '$lib/server/website.js';
import { sendEmail } from '$lib/server/email.js';

export function load() {
	return { guides: PLATFORM_GUIDES };
}

export const actions = {
	detect: async ({ request }) => {
		const url = String((await request.formData()).get('url') ?? '');
		const r = await detectPlatform(url);
		if (!r.ok) return fail(400, { kind: 'detect', error: r.error });
		return { kind: 'detect', url: r.url, platform: r.platform };
	},

	check: async ({ request, locals }) => {
		const url = String((await request.formData()).get('url') ?? '');
		const client = await getClientById(locals.user.client_id);
		const r = await checkInstall(url, client.slug);
		if (!r.ok) return fail(400, { kind: 'check', status: r.status, error: r.error });
		return { kind: 'check', status: r.status, message: r.message ?? null };
	},

	sendDev: async ({ request, locals }) => {
		const form = await request.formData();
		const devEmail = String(form.get('devEmail') ?? '').trim();
		const url = String(form.get('url') ?? '').trim();
		const platform = String(form.get('platform') ?? 'other');
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(devEmail)) {
			return fail(400, { kind: 'sendDev', error: 'Please enter a valid email address.' });
		}
		const client = await getClientById(locals.user.client_id);
		const snippet = buildSnippet(client.slug);
		const guide = guideFor(platform);
		const text = [
			'Hi,',
			'',
			`${client.name} uses Makutano Digital — an AI assistant that answers website visitors and captures leads. Could you add it to ${url || 'our website'}?`,
			'',
			'1) Paste this snippet just before the closing </body> tag (or in the site’s custom-code / footer area):',
			'',
			snippet,
			'',
			`Steps for ${guide.name}:`,
			...guide.steps.map((s, i) => `   ${i + 1}. ${s}`),
			'',
			guide.note ? `Note: ${guide.note}` : null,
			'',
			'That’s it — a chat button appears at the bottom-right of every page.',
			'',
			'Thank you!',
			client.name
		]
			.filter((l) => l !== null)
			.join('\n');

		const res = await sendEmail({
			to: devEmail,
			subject: `Please add the ${client.name} assistant to our website`,
			text,
			replyTo: client.contact_email || undefined
		});
		if (res.skipped) return fail(400, { kind: 'sendDev', error: 'Email isn’t configured yet — copy the code and send it manually for now.' });
		if (!res.ok) return fail(502, { kind: 'sendDev', error: 'Could not send the email. Please try again.' });
		return { kind: 'sendDev', ok: true, to: devEmail };
	}
};
