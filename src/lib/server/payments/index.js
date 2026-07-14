// Active payment provider, or null when none is configured (then upgrades fall
// back to "contact us" manual activation). Add more providers here later.
import { snippeProvider, snippeConfigured } from './snippe.js';

export function getPaymentProvider() {
	if (snippeConfigured()) return snippeProvider;
	return null;
}

export function paymentsEnabled() {
	return getPaymentProvider() !== null;
}
