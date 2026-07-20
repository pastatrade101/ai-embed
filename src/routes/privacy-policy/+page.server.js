// Public privacy policy — reachable by anyone (incl. Meta App Review), signed in or
// not, so unlike the marketing root it does NOT redirect authenticated users away.
// We only need the absolute origin for the canonical + Open Graph URLs.
export function load({ url }) {
	return { origin: url.origin };
}
