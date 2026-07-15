<script>
	// Inlined Lucide / Feather icons (MIT-licensed) — a lightweight icon set with
	// no runtime dependency. Colour follows `currentColor`; size/stroke are props.
	export let name;
	export let size = 24;
	export let stroke = 2;
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#if name === 'sparkles'}
		<path d="M12 3 10.1 8.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
		<path d="M5 3v4" /><path d="M3 5h4" /><path d="M19 17v4" /><path d="M17 19h4" />
	{:else if name === 'arrow-right'}
		<line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
	{:else if name === 'play'}
		<circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />
	{:else if name === 'bot'}
		<path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" />
		<path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
	{:else if name === 'book-open'}
		<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
	{:else if name === 'calendar'}
		<rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
	{:else if name === 'message-circle'}
		<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
	{:else if name === 'trending-up'}
		<polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
	{:else if name === 'bar-chart'}
		<line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
	{:else if name === 'globe'}
		<circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
	{:else if name === 'qr'}
		<rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
	{:else if name === 'phone'}
		<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
	{:else if name === 'map-pin'}
		<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
	{:else if name === 'mail'}
		<rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" />
	{:else if name === 'arrow-up'}
		<line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
	{:else if name === 'check'}
		<polyline points="20 6 9 17 4 12" />
	{/if}
</svg>
