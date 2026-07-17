import { adminSnapshot } from '$lib/server/admin-snapshot.js';

export const load = (event) => adminSnapshot(event);
