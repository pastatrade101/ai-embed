// Dashboard = the platform command center. Shares the one snapshot with the
// Revenue, Clients, Industries, AI and Settings pages so every screen agrees.
import { fail } from '@sveltejs/kit';
import { adminSnapshot } from '$lib/server/admin-snapshot.js';
import { platformCopilot } from '$lib/server/admin-intelligence.js';

export const load = (event) => adminSnapshot(event);

export const actions = {
	// Platform Copilot — natural-language Q&A over the live platform snapshot.
	// hooks.server.js already restricts /admin to super_admin, so this is safe.
	copilot: async (event) => {
		const form = await event.request.formData();
		const question = String(form.get('question') ?? '').trim();
		if (!question) return fail(400, { error: 'Ask a question about the platform.' });
		const snap = await adminSnapshot(event);
		if (snap.loadError) return fail(502, { question, error: 'Could not load platform data right now.' });
		const res = await platformCopilot(question, snap);
		if (res?.error) return fail(502, { question, error: 'The copilot is temporarily unavailable — please try again in a moment.' });
		return { question, answer: res.text };
	}
};
