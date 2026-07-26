// We only need the absolute origin for the canonical + Open Graph URLs.
export function load({ url }) {
	return { origin: url.origin };
}
