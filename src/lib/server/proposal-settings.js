// Proposal AI Settings — the tenant's control center for how Proposal AI behaves.
// One jsonb blob on clients.proposal_ai (migration 019), always read through
// getProposalSettings() which fills in defaults, so the whole feature FAILS OPEN
// before the migration runs (missing column => {} => all defaults).
//
// NOT user/permission management (no RBAC) — purely AI behaviour, business rules
// and brand. Templates and modular blocks are intentionally out of scope (they
// need engines that don't exist yet).
import { supabase } from './supabase.js';

export const WRITING_STYLES = ['', 'professional', 'friendly', 'executive', 'luxury', 'government', 'healthcare', 'retail', 'educational', 'legal', 'technical', 'confident', 'minimal'];
export const DETAIL_LEVELS = ['brief', 'standard', 'detailed'];
export const CREATIVITY = ['conservative', 'balanced', 'creative'];
export const MISSING_BEHAVIOURS = ['ask', 'warn', 'block'];
export const KNOWLEDGE_SOURCES = ['conversation', 'crm', 'knowledge_base', 'catalogue', 'pricing', 'policies', 'previous_proposals'];

export const PROPOSAL_AI_DEFAULTS = {
	// General
	defaultMode: 'conversation', // conversation | crm | blank
	defaultExpiryDays: 30, // 0 = no expiry
	enableVersioning: true,
	enableTimeline: true,
	enableLiveSync: true,
	// AI generation
	writingStyle: '', // '' = use the brand tone
	detailLevel: 'standard', // brief | standard | detailed
	creativity: 'balanced', // conservative | balanced | creative
	enableFollowup: true,
	enableRegeneration: true,
	autoDetectChanges: true,
	requireConfirmApply: true,
	// Knowledge sources the AI may use
	sources: { conversation: true, crm: true, knowledge_base: true, catalogue: true, pricing: true, policies: true, previous_proposals: true },
	// Required information before generating
	requiredFields: [], // labels the operator must have, e.g. ['Budget','Timeline']
	minCompleteness: 0, // 0–100
	missingBehaviour: 'warn', // ask | warn | block
	// Brand voice
	brandPersonality: '', // professional | luxury | corporate | ...
	customInstructions: '', // injected into every proposal prompt
	// Recommendations
	enableUpsell: true,
	enableCrossSell: true,
	enablePremium: true,
	enableBundles: true,
	enableDiscounts: false,
	maxDiscountPercent: 10, // ceiling the WhatsApp assistant may offer without a human
	allowNegotiation: true, // let the WhatsApp assistant negotiate / modify the proposal
	maxRecommendations: 4,
	minConfidence: 0, // hide recs below this 0–100
	// Explainability (Section 19 UI toggles)
	showConfidence: true,
	showSources: true,
	showReasoning: true,
	showQualityScore: true,
	showChangeSummary: true,
	showDecisionHistory: true,
	// Approval (light — not RBAC; a soft gate + notes. Workflows are future work.)
	requireApproval: false,
	autoApproveAI: true,
	approvalNotes: ''
};

/** True when the error is "clients.proposal_ai doesn't exist yet" (migration 019). */
export function isMissingProposalAI(error) {
	if (!error) return false;
	const m = `${error.code ?? ''} ${error.message ?? ''}`;
	return /proposal_ai|42703|PGRST204|column .* does not exist|schema cache/i.test(m);
}

/** Merge stored config over defaults (nested `sources` merged, arrays replaced). */
export function mergeSettings(stored = {}) {
	const s = stored && typeof stored === 'object' ? stored : {};
	return {
		...PROPOSAL_AI_DEFAULTS,
		...s,
		sources: { ...PROPOSAL_AI_DEFAULTS.sources, ...(s.sources && typeof s.sources === 'object' ? s.sources : {}) },
		requiredFields: Array.isArray(s.requiredFields) ? s.requiredFields : PROPOSAL_AI_DEFAULTS.requiredFields
	};
}

/** Resolved settings for a client (the client object already carries proposal_ai). */
export function getProposalSettings(client) {
	return mergeSettings(client?.proposal_ai);
}

/** Persist settings. Returns { ok, needsMigration }. */
export async function saveProposalSettings(clientId, settings) {
	const clean = mergeSettings(settings);
	const { error } = await supabase.from('clients').update({ proposal_ai: clean }).eq('id', clientId);
	if (error) return { ok: false, needsMigration: isMissingProposalAI(error), error };
	return { ok: true, settings: clean };
}

const STYLE_HINT = {
	professional: 'a crisp, professional business tone',
	friendly: 'a warm, friendly, approachable tone',
	executive: 'a concise, high-level executive tone',
	luxury: 'a refined, premium, luxury tone',
	government: 'a formal, precise, compliant tone',
	healthcare: 'a careful, reassuring, clinically-appropriate tone',
	retail: 'a lively, benefit-led retail tone',
	educational: 'a clear, patient, explanatory tone',
	legal: 'a formal, precise, unambiguous tone',
	technical: 'a precise, technically-literate tone',
	confident: 'a confident, assured tone',
	minimal: 'a spare, minimal, no-fluff tone'
};
const DETAIL_TOKENS = { brief: 900, standard: 1600, detailed: 2400 };
const CREATIVITY_HINT = {
	conservative: 'Stay conservative and strictly factual — do not embellish.',
	balanced: '',
	creative: 'You may be more persuasive and expressive, while staying truthful.'
};

/** Extra system directives from the settings, appended to every proposal prompt. */
export function aiDirectives(settings, { includeStyle = true } = {}) {
	const parts = [];
	if (includeStyle && settings.writingStyle && STYLE_HINT[settings.writingStyle]) parts.push(`Write in ${STYLE_HINT[settings.writingStyle]}.`);
	if (settings.brandPersonality) parts.push(`The brand personality is ${settings.brandPersonality}.`);
	if (CREATIVITY_HINT[settings.creativity]) parts.push(CREATIVITY_HINT[settings.creativity]);
	const ci = String(settings.customInstructions || '').trim();
	if (ci) parts.push(`Organisation rules you MUST follow: ${ci}`);
	return parts.join(' ');
}

/** maxTokens for a drafting call, from the detail level. */
export function detailTokens(settings, fallback = 1600) {
	return DETAIL_TOKENS[settings.detailLevel] ?? fallback;
}
