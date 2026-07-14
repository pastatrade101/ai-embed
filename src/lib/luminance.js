// Pick readable text (dark or white) for an arbitrary background color, so
// avatars and the brand mark stay legible whatever brand_color a client picks.
export function readableInk(hex) {
	const c = String(hex ?? '').trim().replace('#', '');
	const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
	if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return '#ffffff';
	const r = parseInt(full.slice(0, 2), 16);
	const g = parseInt(full.slice(2, 4), 16);
	const b = parseInt(full.slice(4, 6), 16);
	// YIQ perceived brightness — >150 is a "light" background → use dark ink.
	const yiq = (r * 299 + g * 587 + b * 114) / 1000;
	return yiq > 150 ? '#0b0e14' : '#ffffff';
}
