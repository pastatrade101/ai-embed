// Shared limits for the widget's greeting bubble (the "concierge" line that
// slides out beside the chat button). Defined once so the settings UI counter,
// the save-time validation, and the public /api/config all agree.
//
// Kept deliberately short: the bubble is a single speech bubble anchored to the
// launcher, so a long message would wrap into an ugly tall column or overflow on
// mobile. ~120 characters is roughly two comfortable lines.
export const GREETING_MAX = 120; // characters

/**
 * Normalise an operator's greeting input for storage: collapse whitespace
 * (the bubble is one line — newlines/tabs would break the layout), trim, and
 * hard-cap the length. Returns null for blank input so the widget falls back to
 * its smart, context-aware greetings.
 */
export function clampGreeting(v) {
	if (v == null) return null;
	const s = String(v).replace(/\s+/g, ' ').trim();
	// Slice by code points, not UTF-16 units, so the cap never lands in the
	// middle of a surrogate pair (an emoji at the boundary) and leaves a broken
	// lone-surrogate glyph in the bubble.
	return s ? [...s].slice(0, GREETING_MAX).join('') : null;
}
