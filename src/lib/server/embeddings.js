// Voyage voyage-3 embeddings (1024 dims). Anthropic has no embeddings model,
// so we call Voyage directly over HTTP — there is no official JS SDK.
import { env } from '$env/dynamic/private';

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-3';

/**
 * Embed an array of texts. `inputType` is 'document' for stored knowledge
 * (ingestion) and 'query' for the visitor's live question (retrieval) —
 * Voyage tunes the vectors differently for each side.
 * @param {string[]} texts
 * @param {'document'|'query'} inputType
 * @returns {Promise<number[][]>}
 */
const MAX_RETRIES = 4; // survive short rate-limit bursts (free tier is 3 RPM)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function embed(texts, inputType) {
	if (!texts.length) return [];
	if (!env.VOYAGE_API_KEY) throw new Error('VOYAGE_API_KEY is not set');

	for (let attempt = 0; ; attempt++) {
		const res = await fetch(VOYAGE_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${env.VOYAGE_API_KEY}`
			},
			body: JSON.stringify({ model: MODEL, input: texts, input_type: inputType })
		});

		if (res.ok) {
			const json = await res.json();
			// Voyage returns data sorted by the `index` field — sort defensively.
			return json.data
				.slice()
				.sort((a, b) => a.index - b.index)
				.map((d) => d.embedding);
		}

		const detail = await res.text().catch(() => '');
		// Back off and retry on rate limits (429) and transient server errors.
		if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
			const retryAfter = Number(res.headers.get('retry-after'));
			const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(24000, 1500 * 2 ** attempt);
			await sleep(waitMs);
			continue;
		}
		throw new Error(`Voyage error ${res.status}: ${detail}`);
	}
}

/** Embed a single query string. */
export async function embedQuery(text) {
	const [vector] = await embed([text], 'query');
	return vector;
}

// Chunking lives in knowledge.js (see chunkItem) — it renders structured facts
// alongside the body so price and metadata reach retrieval.
