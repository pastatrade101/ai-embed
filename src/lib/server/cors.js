// Shared CORS handling for the widget's cross-origin calls.
// In production, restrict `Access-Control-Allow-Origin` to onboarded domains
// rather than '*'.
export const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'content-type'
};

/** Response to a CORS preflight OPTIONS request. */
export function preflight() {
	return new Response(null, { status: 204, headers: corsHeaders });
}

/** JSON response with CORS headers attached. */
export function jsonCors(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', ...corsHeaders }
	});
}
