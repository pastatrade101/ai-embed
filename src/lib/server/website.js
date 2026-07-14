// Phase C — website helpers. Detect an operator's site platform from its URL,
// serve a platform-specific install guide, and verify the widget is live. All
// network calls are best-effort with a short timeout; a failure returns a
// friendly result rather than throwing.

const WIDGET_HOST = 'https://app.makutano.digital';

/** The one-line embed snippet for a tenant. */
export function buildSnippet(slug) {
	return `<script src="${WIDGET_HOST}/widget.js" data-client="${slug}"><\/script>`;
}

/** Add a scheme if missing, validate, and return a clean origin URL (or null). */
export function normalizeUrl(raw) {
	let s = String(raw ?? '').trim();
	if (!s) return null;
	if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
	try {
		const u = new URL(s);
		if (!/^https?:$/.test(u.protocol)) return null;
		if (!u.hostname.includes('.')) return null;
		return u.toString();
	} catch {
		return null;
	}
}

async function fetchPage(url) {
	const res = await fetch(url, {
		headers: { 'user-agent': 'Mozilla/5.0 (compatible; MakutanoBot/1.0; +https://makutano.digital)' },
		redirect: 'follow',
		signal: AbortSignal.timeout(9000)
	});
	const html = (await res.text()).slice(0, 300000);
	return { html, headers: res.headers, finalUrl: res.url };
}

// Order matters — check the most specific fingerprints first.
const SIGNATURES = [
	{ id: 'shopify', test: (h, hd, u) => /cdn\.shopify\.com|Shopify\.theme|myshopify\.com|"ShopId"/i.test(h) || hd.has('x-shopid') || hd.has('x-shopify-stage') },
	{ id: 'wix', test: (h, hd) => /static\.parastorage\.com|wixstatic\.com|X-Wix|_wixCssState|content="Wix\.com/i.test(h) || hd.has('x-wix-request-id') },
	{ id: 'squarespace', test: (h) => /static1\.squarespace\.com|This is Squarespace|content="Squarespace|assets\.squarespace\.com/i.test(h) },
	{ id: 'webflow', test: (h) => /content="Webflow"|assets\.website-files\.com|assets-global\.website-files\.com|\.webflow\.io/i.test(h) },
	{ id: 'godaddy', test: (h) => /img\d?\.wsimg\.com|dpbuilder|GoDaddy Website Builder|"websiteBuilder"/i.test(h) },
	{ id: 'wordpress', test: (h) => /wp-content|wp-includes|\/wp-json|content="WordPress/i.test(h) }
];

/**
 * Best-effort platform detection from a URL.
 * @returns {{ ok:boolean, url?:string, platform?:string, error?:string }}
 */
export async function detectPlatform(rawUrl) {
	const url = normalizeUrl(rawUrl);
	if (!url) return { ok: false, error: 'That doesn’t look like a valid website address.' };
	let page;
	try {
		page = await fetchPage(url);
	} catch {
		return { ok: false, error: 'We couldn’t reach that website. Check the address and try again.' };
	}
	const hit = SIGNATURES.find((s) => {
		try {
			return s.test(page.html, page.headers, url);
		} catch {
			return false;
		}
	});
	return { ok: true, url: page.finalUrl || url, platform: hit ? hit.id : 'other' };
}

/**
 * Verify our widget script is present on the page for this tenant.
 * @returns {{ ok:boolean, status:'installed'|'wrong-id'|'missing', message?:string, error?:string }}
 */
export async function checkInstall(rawUrl, slug) {
	const url = normalizeUrl(rawUrl);
	if (!url) return { ok: false, status: 'missing', error: 'That doesn’t look like a valid website address.' };
	let page;
	try {
		page = await fetchPage(url);
	} catch {
		return { ok: false, status: 'missing', error: 'We couldn’t reach that website. Check the address and try again.' };
	}
	const hasScript = /widget\.js/i.test(page.html);
	const esc = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const hasClient = new RegExp(`data-client\\s*=\\s*["']${esc}["']`, 'i').test(page.html);
	if (hasScript && hasClient) return { ok: true, status: 'installed' };
	if (hasScript && !hasClient)
		return {
			ok: true,
			status: 'wrong-id',
			message: `We found an assistant on your page, but not this one. Make sure the code has data-client="${slug}".`
		};
	return {
		ok: true,
		status: 'missing',
		message:
			'We couldn’t find the assistant code in your page source yet. If you just added it, publish your site and try again. (If you added it through a tag manager, it may still work for visitors.)'
	};
}

// Platform install guides. Steps are deliberately worded to survive minor menu
// changes. `id: 'other'` is the generic fallback.
export const PLATFORM_GUIDES = {
	wordpress: {
		name: 'WordPress',
		time: '3 min',
		steps: [
			'In your WordPress dashboard, go to Plugins → Add New and install “WPCode – Insert Headers and Footers” (free), then Activate it.',
			'Go to Code Snippets → Header & Footer.',
			'Paste your code into the “Footer” box.',
			'Click Save Changes. The chat button appears on every page.'
		],
		note: 'Prefer not to use a plugin? You can paste the code before the </body> tag in your theme’s footer.php (Appearance → Theme File Editor), but the plugin is safer and survives theme updates.'
	},
	wix: {
		name: 'Wix',
		time: '3 min',
		steps: [
			'Open your Wix dashboard and go to Settings → Custom Code (under “Advanced”).',
			'Click + Add Custom Code.',
			'Paste your code into the box, and set “Place Code in” to Body – end.',
			'Under “Add Code to Pages”, choose All pages, then click Apply.'
		],
		note: 'Custom Code requires a Wix Premium plan with a connected domain.'
	},
	squarespace: {
		name: 'Squarespace',
		time: '2 min',
		steps: [
			'In your Squarespace dashboard, go to Settings → Advanced → Code Injection.',
			'Paste your code into the Footer box.',
			'Click Save. The chat button appears across your site.'
		],
		note: 'Code Injection is available on Business and Commerce plans.'
	},
	shopify: {
		name: 'Shopify',
		time: '4 min',
		steps: [
			'From your Shopify admin, go to Online Store → Themes.',
			'On your current theme, click the ⋯ (three dots) → Edit code.',
			'Open Layout → theme.liquid.',
			'Paste your code on the line just before the closing </body> tag, then click Save.'
		],
		note: 'This adds the assistant to your storefront on every page.'
	},
	webflow: {
		name: 'Webflow',
		time: '3 min',
		steps: [
			'Open your project and go to Site Settings → Custom Code.',
			'Paste your code into the Footer Code box.',
			'Click Save Changes.',
			'Publish your site for the change to go live.'
		],
		note: 'Custom code publishes on Webflow site plans (and paid workspace plans).'
	},
	godaddy: {
		name: 'GoDaddy Website Builder',
		time: '5 min',
		steps: [
			'Edit your site, then add a section and choose the HTML / Custom Code element where you want it.',
			'Paste your code into the Custom Code box and save.',
			'Publish your site.'
		],
		note: 'GoDaddy’s Website Builder has limited custom-code support. If you can’t add it, no problem — just use your shareable link and QR code instead (they need no website at all).'
	},
	other: {
		name: 'Any website (custom HTML)',
		time: '2 min',
		steps: [
			'Open the HTML for your site (or ask whoever manages it).',
			'Paste your code on the line just before the closing </body> tag.',
			'Save and publish. The chat button appears bottom-right on every page it’s on.'
		],
		note: 'Not sure how? Use “Send to my web person” below and we’ll email them everything.'
	}
};

export function guideFor(platform) {
	return PLATFORM_GUIDES[platform] ?? PLATFORM_GUIDES.other;
}
