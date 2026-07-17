// Dashboard = the platform summary. Shares the one snapshot with the Revenue,
// Clients and Settings pages so every screen shows the same numbers.
import { adminSnapshot } from '$lib/server/admin-snapshot.js';

export const load = (event) => adminSnapshot(event);
