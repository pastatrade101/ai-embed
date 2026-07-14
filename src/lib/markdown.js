// Minimal, safe Markdown → HTML for assistant messages shown in operator-facing
// screens (conversation transcripts). Mirrors the embeddable widget's md() so the
// operator sees the same formatting the customer saw. Escapes first, then inserts
// only tags we control (bold, italic, code, links, lists, paragraphs) — safe for
// {@html}.

function esc(s) {
	return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** Render a subset of Markdown to a safe HTML string. */
export function renderMarkdown(raw) {
	let s = esc(raw ?? '');
	s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
	s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	s = s.replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*/g, '$1<em>$2</em>');
	s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
	s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener">${url}</a>`);

	const lines = s.split('\n');
	let out = '';
	let listType = null;
	let para = [];
	const flushPara = () => {
		if (para.length) {
			out += '<p>' + para.join('<br>') + '</p>';
			para = [];
		}
	};
	const flushList = () => {
		if (listType) {
			out += '</' + listType + '>';
			listType = null;
		}
	};
	for (const line of lines) {
		const ul = line.match(/^\s*[-*]\s+(.*)$/);
		const ol = line.match(/^\s*\d+\.\s+(.*)$/);
		if (ul) {
			flushPara();
			if (listType !== 'ul') {
				flushList();
				out += '<ul>';
				listType = 'ul';
			}
			out += '<li>' + ul[1] + '</li>';
		} else if (ol) {
			flushPara();
			if (listType !== 'ol') {
				flushList();
				out += '<ol>';
				listType = 'ol';
			}
			out += '<li>' + ol[1] + '</li>';
		} else if (line.trim() === '') {
			flushList();
			flushPara();
		} else {
			flushList();
			para.push(line.replace(/^#{1,6}\s+/, ''));
		}
	}
	flushList();
	flushPara();
	return out || esc(raw ?? '');
}

/** Flatten Markdown to plain text for single-line previews (row snippets). */
export function stripMarkdown(raw) {
	return String(raw ?? '')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*\n]+)\*/g, '$1')
		.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/^\s*[-*]\s+/gm, '')
		.replace(/^\s*\d+\.\s+/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
}
