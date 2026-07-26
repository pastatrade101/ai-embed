// Central platform safeguards & fair-usage knobs.
//
// Every value has a safe code DEFAULT equal to the platform's current behaviour,
// and each can be overridden by an environment variable WITHOUT a code change or
// a database schema change (honouring the "no schema change" constraint). A quota
// of 0 means "no limit" (off), so nothing changes until an operator sets a value.
//
// This gives one place to read the safeguards, feeds the super-admin "Limits &
// safeguards" panel, and drives the fair-usage flagging + the optional per-feature
// run quotas. (In-UI editing of these would need a config store, i.e. a schema
// change — deliberately out of scope; env is the code-free override path for now.)
import { env } from '$env/dynamic/private';

const num = (v, d) => {
	const n = Number(v);
	return Number.isFinite(n) && n >= 0 ? n : d;
};
const list = (v, d) => (v && String(v).trim() ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : d);

/** Resolved platform safeguards (env override → code default). */
export function platformConfig() {
	return {
		fairUse: {
			// Profitability-flag thresholds (see admin revenue page).
			costPct: num(env.FAIR_USE_COST_PCT, 50), // paying tenant: AI cost % of revenue → review
			freeUSD: num(env.FAIR_USE_FREE_USD, 2) //   free tenant: $/mo AI → review
		},
		quotas: {
			// Monthly RUN quotas for expensive operations. 0 = unlimited (default).
			bulkImport: num(env.QUOTA_BULK_IMPORT, 0),
			websiteSync: num(env.QUOTA_WEBSITE_SYNC, 0)
		},
		limits: {
			maxUploadMB: num(env.MAX_UPLOAD_MB, 8), //     per-file upload ceiling (also BODY_SIZE_LIMIT)
			maxDocMB: num(env.MAX_DOC_MB, 8), //           per-document analysis ceiling
			tokenSafetyMaxInput: num(env.TOKEN_SAFETY_MAX_INPUT, 0) // per-request input-token ceiling; 0 = off
		},
		models: {
			// Which AI models are available platform-wide. Empty = all (default).
			enabled: list(env.MODELS_ENABLED, [])
		}
	};
}

/** The env var name that overrides each surfaced setting (for the admin panel). */
export const CONFIG_ENV_KEYS = {
	'fairUse.costPct': 'FAIR_USE_COST_PCT',
	'fairUse.freeUSD': 'FAIR_USE_FREE_USD',
	'quotas.bulkImport': 'QUOTA_BULK_IMPORT',
	'quotas.websiteSync': 'QUOTA_WEBSITE_SYNC',
	'limits.maxUploadMB': 'MAX_UPLOAD_MB',
	'limits.maxDocMB': 'MAX_DOC_MB',
	'limits.tokenSafetyMaxInput': 'TOKEN_SAFETY_MAX_INPUT',
	'models.enabled': 'MODELS_ENABLED'
};
