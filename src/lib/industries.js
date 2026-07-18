// Industry Registry — client-safe layer. Everything industry-specific that the
// UI needs (terminology, knowledge categories, onboarding copy) lives here as
// plain data; server-only material (AI prompts, schemas, themes) lives in
// $lib/server/industries.js keyed by the same ids.
//
// The platform engine never branches on an industry name — it reads whatever
// entry `clients.industry` points at, falling back to tourism (the default
// industry, which reproduces the original product verbatim so existing tenants
// are unchanged). Adding an industry = adding an entry here + its server twin.
// No core logic changes.

export const DEFAULT_INDUSTRY = 'tourism';

export const INDUSTRIES = {
	tourism: {
		key: 'tourism',
		label: 'Tour Operator / Travel',
		icon: '🦁',
		tagline: 'Safaris, treks, day trips & travel packages',
		businessType: 'tour operator',
		// Nouns the UI interpolates. Tourism values reproduce the original copy.
		terms: {
			item: 'tour',
			items: 'tours',
			catalogue: 'tours & travel info',
			conversion: 'booking',
			conversions: 'bookings',
			customer: 'traveller',
			schedule: 'departures'
		},
		// Quick-add type chips on the Knowledge page (original ADD_TYPES verbatim).
		knowledgeTypes: ['Tour', 'Destination', 'Day Trip', 'Climb', 'Accommodation', 'Transport', 'FAQ', 'Policy', 'Travel Tip'],
		// Research-draft categories on the Insights page (original list verbatim).
		researchCategories: ['Travel guide', 'FAQ', 'Destination', 'Policy', 'Transport', 'Accommodation'],
		defaultResearchCategory: 'Travel guide',
		// Date-level availability (tour_departures) applies to items whose category
		// matches this substring; industries without scheduled items set null.
		scheduleCategoryMatch: 'tour',
		// Knowledge-page copy — original strings verbatim.
		kb: {
			searchPlaceholder: 'Search tours, FAQs, destinations…',
			titlePlaceholder: 'e.g. 5-Day Serengeti & Ngorongoro Safari',
			categoryPlaceholder: 'Tour',
			detailsPlaceholder: 'Duration: 5 days\nGroup size: max 6\nIncludes: park fees, meals, guide\nBest season: Jun–Oct',
			bodyPlaceholder: "Full itinerary, what's included, fitness level, best months…",
			emptyTitle: 'Your catalogue is empty',
			emptyText: 'Your AI can only recommend tours and answer questions that exist here. Add your first item to get started.',
			addFirstCta: 'Add a tour',
			importCta: 'Import tours',
			importHint: 'Have a spreadsheet? Paste a CSV to add lots of tours in one go.',
			csvExample: `title,category,price,currency,body,duration,group_size,includes,best_season
"5-Day Serengeti Safari",tour,1450,USD,"Northern circuit itinerary…","5 days","max 6","park fees, meals, guide","Jun–Oct"`
		},
		onboarding: {
			businessHeading: 'Tell us about your tour business',
			namePlaceholder: 'e.g. Kilima Safaris',
			descPlaceholder: 'Describe your tours, style, and where you operate…',
			offeringsLabel: 'Your tours',
			offeringsHint: 'What you sell',
			offeringsHeading: 'What kinds of tours do you sell?',
			offeringsDesc: 'Pick everything that applies — you can upload the full catalogue later.',
			focusLabel: 'Tour focus',
			focusOptions: ['Safari', 'Kilimanjaro', 'Zanzibar', 'Gorilla trekking', 'Cultural', 'Honeymoon', 'Family', 'Budget', 'Luxury'],
			suggestions: [
				'A boutique safari operator in Arusha specializing in Serengeti & Ngorongoro',
				'Family-friendly Tanzania tours with Zanzibar beach extensions',
				'Luxury Kilimanjaro climbs with private guides',
				'Budget group departures to Masai Mara from Nairobi'
			],
			uploadNote: 'CSV, JSON, or paste your itineraries — add them from your dashboard once you’re in.',
			// Seed sentence prefix written into business_context at provisioning
			// ("Tour focus: Safari, Kilimanjaro." — original string verbatim).
			contextLabel: 'Tour focus'
		}
	},

	hotel: {
		key: 'hotel',
		label: 'Hotel / Lodge',
		icon: '🏨',
		tagline: 'Hotels, lodges, camps & guesthouses',
		businessType: 'hotel',
		terms: { item: 'room', items: 'rooms & offers', catalogue: 'rooms, rates & facilities', conversion: 'reservation', conversions: 'reservations', customer: 'guest', schedule: 'availability' },
		knowledgeTypes: ['Room', 'Rate', 'Facility', 'Dining', 'Activity', 'Transport', 'FAQ', 'Policy'],
		researchCategories: ['Guide', 'FAQ', 'Facility', 'Policy', 'Dining', 'Activity'],
		defaultResearchCategory: 'Guide',
		scheduleCategoryMatch: null,
		onboarding: {
			businessHeading: 'Tell us about your property',
			namePlaceholder: 'e.g. Baobab Lodge',
			descPlaceholder: 'Describe your property, rooms, and what makes a stay special…',
			offeringsLabel: 'Your rooms',
			offeringsHint: 'What you offer',
			offeringsHeading: 'What kind of stays do you offer?',
			offeringsDesc: 'Pick everything that applies — you can add full room details later.',
			focusLabel: 'Property focus',
			focusOptions: ['Beach resort', 'Safari lodge', 'City hotel', 'Boutique', 'Budget', 'Luxury', 'Family', 'Conference', 'Long stay'],
			suggestions: [
				'A beachfront boutique hotel in Zanzibar with 24 rooms and a dive centre',
				'A safari lodge on the edge of the Serengeti with full-board packages',
				'A city business hotel with conference facilities and airport transfers'
			],
			uploadNote: 'CSV, JSON, or paste your room types and rates — add them from your dashboard once you’re in.',
			contextLabel: 'Property focus'
		}
	},

	healthcare: {
		key: 'healthcare',
		label: 'Hospital / Clinic',
		icon: '🏥',
		tagline: 'Hospitals, clinics & medical practices',
		businessType: 'healthcare provider',
		terms: { item: 'service', items: 'services', catalogue: 'services & departments', conversion: 'appointment', conversions: 'appointments', customer: 'patient', schedule: 'availability' },
		knowledgeTypes: ['Service', 'Department', 'Doctor', 'Insurance', 'Preparation', 'FAQ', 'Policy'],
		researchCategories: ['Guide', 'FAQ', 'Service', 'Department', 'Insurance', 'Policy'],
		defaultResearchCategory: 'Guide',
		scheduleCategoryMatch: null,
		onboarding: {
			businessHeading: 'Tell us about your facility',
			namePlaceholder: 'e.g. Amani Medical Centre',
			descPlaceholder: 'Describe your facility, departments, and the care you provide…',
			offeringsLabel: 'Your services',
			offeringsHint: 'What you provide',
			offeringsHeading: 'What services do you provide?',
			offeringsDesc: 'Pick everything that applies — you can add full details later.',
			focusLabel: 'Service focus',
			focusOptions: ['General practice', 'Dental', 'Maternity', 'Pediatrics', 'Laboratory', 'Imaging', 'Surgery', 'Pharmacy', 'Specialist clinics'],
			suggestions: [
				'A private clinic in Dar es Salaam offering general practice, laboratory and imaging',
				'A dental practice with same-week appointments and NHIF accepted',
				'A maternity and pediatrics centre with 24/7 emergency care'
			],
			uploadNote: 'CSV, JSON, or paste your services and departments — add them from your dashboard once you’re in.',
			contextLabel: 'Service focus'
		}
	},

	education: {
		key: 'education',
		label: 'School / University',
		icon: '🎓',
		tagline: 'Schools, colleges & universities',
		businessType: 'educational institution',
		terms: { item: 'programme', items: 'programmes', catalogue: 'programmes & admissions info', conversion: 'application', conversions: 'applications', customer: 'student', schedule: 'intakes' },
		knowledgeTypes: ['Programme', 'Admissions', 'Fees', 'Scholarship', 'Campus', 'Calendar', 'FAQ', 'Policy'],
		researchCategories: ['Guide', 'FAQ', 'Programme', 'Admissions', 'Fees', 'Policy'],
		defaultResearchCategory: 'Guide',
		scheduleCategoryMatch: null,
		onboarding: {
			businessHeading: 'Tell us about your institution',
			namePlaceholder: 'e.g. Mwanza Business College',
			descPlaceholder: 'Describe your institution, programmes, and who you serve…',
			offeringsLabel: 'Your programmes',
			offeringsHint: 'What you teach',
			offeringsHeading: 'What programmes do you offer?',
			offeringsDesc: 'Pick everything that applies — you can add the full catalogue later.',
			focusLabel: 'Programme focus',
			focusOptions: ['Primary', 'Secondary', 'Diploma', 'Degree', 'Vocational', 'Short courses', 'Online', 'Postgraduate'],
			suggestions: [
				'A business college in Mwanza offering diplomas in accounting and IT',
				'An international primary and secondary school with boarding facilities',
				'A vocational training centre with evening and weekend classes'
			],
			uploadNote: 'CSV, JSON, or paste your programmes and fees — add them from your dashboard once you’re in.',
			contextLabel: 'Programme focus'
		}
	},

	government: {
		key: 'government',
		label: 'Government / Public Service',
		icon: '🏛️',
		tagline: 'Ministries, councils & public institutions',
		businessType: 'public institution',
		terms: { item: 'service', items: 'services', catalogue: 'services & procedures', conversion: 'application', conversions: 'applications', customer: 'citizen', schedule: 'office hours' },
		knowledgeTypes: ['Service', 'Department', 'Procedure', 'Form', 'Requirement', 'FAQ', 'Policy'],
		researchCategories: ['Guide', 'FAQ', 'Service', 'Procedure', 'Requirement', 'Policy'],
		defaultResearchCategory: 'Guide',
		scheduleCategoryMatch: null,
		onboarding: {
			businessHeading: 'Tell us about your institution',
			namePlaceholder: 'e.g. Dodoma City Council',
			descPlaceholder: 'Describe your institution and the services citizens come to you for…',
			offeringsLabel: 'Your services',
			offeringsHint: 'What citizens need',
			offeringsHeading: 'What services do citizens ask about?',
			offeringsDesc: 'Pick everything that applies — you can add full procedures later.',
			focusLabel: 'Service focus',
			focusOptions: ['Permits & licensing', 'Registration', 'Taxes & levies', 'Land & housing', 'Health services', 'Education services', 'Utilities', 'Public records'],
			suggestions: [
				'A municipal council handling business licences, land rates and building permits',
				'A government agency processing registrations and public records',
				'A ministry department guiding citizens through applications and requirements'
			],
			uploadNote: 'CSV, JSON, or paste your services and procedures — add them from your dashboard once you’re in.',
			contextLabel: 'Service focus'
		}
	},

	retail: {
		key: 'retail',
		label: 'Shop / Retail',
		icon: '🛍️',
		tagline: 'Shops, boutiques & online stores',
		businessType: 'retailer',
		terms: { item: 'product', items: 'products', catalogue: 'products & pricing', conversion: 'order', conversions: 'orders', customer: 'customer', schedule: 'stock' },
		knowledgeTypes: ['Product', 'Collection', 'Pricing', 'Shipping', 'Returns', 'FAQ', 'Policy'],
		researchCategories: ['Guide', 'FAQ', 'Product', 'Shipping', 'Returns', 'Policy'],
		defaultResearchCategory: 'Guide',
		scheduleCategoryMatch: null,
		onboarding: {
			businessHeading: 'Tell us about your shop',
			namePlaceholder: 'e.g. Elite Boutique',
			descPlaceholder: 'Describe what you sell, your style, and who shops with you…',
			offeringsLabel: 'Your products',
			offeringsHint: 'What you sell',
			offeringsHeading: 'What do you sell?',
			offeringsDesc: 'Pick everything that applies — you can upload the full catalogue later.',
			focusLabel: 'Product focus',
			focusOptions: ['Fashion', 'Electronics', 'Beauty', 'Home & decor', 'Groceries', 'Accessories', 'Kids', 'Sports', 'Handmade'],
			suggestions: [
				'A fashion boutique in Dar es Salaam with delivery across Tanzania',
				'An electronics shop selling phones and accessories with warranty support',
				'A beauty store stocking skincare and cosmetics with WhatsApp ordering'
			],
			uploadNote: 'CSV, JSON, or paste your product list — add it from your dashboard once you’re in.',
			contextLabel: 'Product focus'
		}
	},

	realestate: {
		key: 'realestate',
		label: 'Real Estate',
		icon: '🏠',
		tagline: 'Agencies, developers & property managers',
		businessType: 'real estate agency',
		terms: { item: 'property', items: 'properties', catalogue: 'listings & pricing', conversion: 'viewing', conversions: 'viewings', customer: 'client', schedule: 'viewings' },
		knowledgeTypes: ['Listing', 'Location', 'Pricing', 'Financing', 'Process', 'FAQ', 'Policy'],
		researchCategories: ['Guide', 'FAQ', 'Listing', 'Location', 'Financing', 'Policy'],
		defaultResearchCategory: 'Guide',
		scheduleCategoryMatch: null,
		onboarding: {
			businessHeading: 'Tell us about your agency',
			namePlaceholder: 'e.g. Prime Homes Agency',
			descPlaceholder: 'Describe the properties you handle and the areas you cover…',
			offeringsLabel: 'Your listings',
			offeringsHint: 'What you offer',
			offeringsHeading: 'What kind of properties do you handle?',
			offeringsDesc: 'Pick everything that applies — you can add full listings later.',
			focusLabel: 'Listing focus',
			focusOptions: ['Sales', 'Rentals', 'Commercial', 'Land', 'New developments', 'Luxury', 'Affordable', 'Property management'],
			suggestions: [
				'A residential agency covering rentals and sales in Dar es Salaam',
				'A developer selling plots and new apartments with payment plans',
				'A property manager handling commercial and office space'
			],
			uploadNote: 'CSV, JSON, or paste your listings — add them from your dashboard once you’re in.',
			contextLabel: 'Listing focus'
		}
	},

	restaurant: {
		key: 'restaurant',
		label: 'Restaurant / Café',
		icon: '🍽️',
		tagline: 'Restaurants, cafés & catering',
		businessType: 'restaurant',
		terms: { item: 'dish', items: 'menu items', catalogue: 'menu & offers', conversion: 'reservation', conversions: 'reservations', customer: 'guest', schedule: 'opening hours' },
		knowledgeTypes: ['Menu', 'Drinks', 'Special', 'Catering', 'Events', 'FAQ', 'Policy'],
		researchCategories: ['Guide', 'FAQ', 'Menu', 'Events', 'Catering', 'Policy'],
		defaultResearchCategory: 'Guide',
		scheduleCategoryMatch: null,
		onboarding: {
			businessHeading: 'Tell us about your restaurant',
			namePlaceholder: 'e.g. Mama Asha Kitchen',
			descPlaceholder: 'Describe your food, style, and what guests love about you…',
			offeringsLabel: 'Your menu',
			offeringsHint: 'What you serve',
			offeringsHeading: 'What do you serve?',
			offeringsDesc: 'Pick everything that applies — you can add the full menu later.',
			focusLabel: 'Menu focus',
			focusOptions: ['Local cuisine', 'Seafood', 'Grill & BBQ', 'Vegetarian', 'Fast food', 'Fine dining', 'Catering', 'Delivery'],
			suggestions: [
				'A seafood restaurant on the Dar waterfront with weekend live music',
				'A family restaurant serving Swahili dishes with delivery and catering',
				'A café with fresh juice, breakfast and lunch specials'
			],
			uploadNote: 'CSV, JSON, or paste your menu — add it from your dashboard once you’re in.',
			contextLabel: 'Menu focus'
		}
	},

	ictagency: {
		key: 'ictagency',
		label: 'ICT / Tech Agency',
		icon: '💻',
		tagline: 'Software, web, IT support & digital services',
		businessType: 'tech agency',
		terms: { item: 'service', items: 'services', catalogue: 'services & pricing', conversion: 'enquiry', conversions: 'enquiries', customer: 'client', schedule: 'availability' },
		knowledgeTypes: ['Service', 'Solution', 'Package', 'Technology', 'Pricing', 'Portfolio', 'Support', 'FAQ', 'Policy'],
		researchCategories: ['Guide', 'FAQ', 'Service', 'Technology', 'Process', 'Policy'],
		defaultResearchCategory: 'Guide',
		scheduleCategoryMatch: null,
		onboarding: {
			businessHeading: 'Tell us about your agency',
			namePlaceholder: 'e.g. Nexus Tech Solutions',
			descPlaceholder: 'Describe your services, the tech you work with, and who you build for…',
			offeringsLabel: 'Your services',
			offeringsHint: 'What you offer',
			offeringsHeading: 'What tech services do you offer?',
			offeringsDesc: 'Pick everything that applies — you can add full details later.',
			focusLabel: 'Service focus',
			focusOptions: ['Web development', 'Mobile apps', 'Software development', 'IT support', 'Cloud & hosting', 'Cybersecurity', 'Networking', 'Digital marketing', 'Data & AI', 'Hardware supply'],
			suggestions: [
				'A software agency in Dar es Salaam building web and mobile apps for SMEs',
				'An IT support company offering managed services, networking and cloud setup',
				'A digital agency doing web design, branding and social media marketing'
			],
			uploadNote: 'CSV, JSON, or paste your services — add them from your dashboard once you’re in.',
			contextLabel: 'Service focus'
		}
	},

	services: {
		key: 'services',
		label: 'Other Business',
		icon: '💼',
		tagline: 'Any other business or organisation',
		businessType: 'business',
		terms: { item: 'service', items: 'services', catalogue: 'services & pricing', conversion: 'enquiry', conversions: 'enquiries', customer: 'customer', schedule: 'availability' },
		knowledgeTypes: ['Service', 'Pricing', 'Process', 'Team', 'FAQ', 'Policy'],
		researchCategories: ['Guide', 'FAQ', 'Service', 'Process', 'Policy'],
		defaultResearchCategory: 'Guide',
		scheduleCategoryMatch: null,
		onboarding: {
			businessHeading: 'Tell us about your business',
			namePlaceholder: 'e.g. Salama Consulting',
			descPlaceholder: 'Describe what you do and who you serve…',
			offeringsLabel: 'Your services',
			offeringsHint: 'What you offer',
			offeringsHeading: 'What do you offer?',
			offeringsDesc: 'Pick everything that applies — you can add full details later.',
			focusLabel: 'Focus',
			focusOptions: ['Consulting', 'Legal', 'Financial', 'Insurance', 'Logistics', 'Construction', 'IT & software', 'Beauty & wellness', 'NGO / non-profit', 'Other'],
			suggestions: [
				'A law firm helping clients with contracts, land and company registration',
				'A logistics company handling clearing, forwarding and deliveries',
				'An insurance agency advising on motor, health and business cover'
			],
			uploadNote: 'CSV, JSON, or paste your services — add them from your dashboard once you’re in.',
			contextLabel: 'Focus'
		}
	}
};

// Example item titles/details per industry — used to derive knowledge-page
// placeholder copy below (tourism defines its `kb` block explicitly, verbatim).
const KB_EXAMPLES = {
	hotel: { title: 'Deluxe Ocean-View Room', details: 'Sleeps: 2 adults + 1 child\nRate: from USD 120/night\nIncludes: breakfast, WiFi\nView: ocean' },
	healthcare: { title: 'Dental Check-up & Cleaning', details: 'Duration: 45 minutes\nPrice: from TZS 50,000\nDepartment: Dental\nInsurance: NHIF accepted' },
	education: { title: 'Diploma in Business Administration', details: 'Duration: 2 years\nFees: TZS 1,200,000/year\nIntakes: January & September\nMode: full-time or evening' },
	government: { title: 'Business Licence Application', details: 'Processing time: 5 working days\nFee: TZS 50,000\nRequired: TIN, ID, lease agreement\nOffice: Licensing desk' },
	retail: { title: 'Leather Handbag — Classic', details: 'Price: TZS 85,000\nColours: black, tan\nDelivery: 1–2 days in Dar\nReturns: 7 days' },
	realestate: { title: '3-Bedroom Apartment, Masaki', details: 'Rent: USD 1,200/month\nBedrooms: 3\nParking: 2 cars\nAvailable: from June' },
	restaurant: { title: 'Grilled Seafood Platter', details: 'Price: TZS 45,000\nServes: 2\nAvailable: daily from 5pm\nContains: prawns, calamari, fish' },
	ictagency: { title: 'Business Website — Starter Package', details: 'Price: from TZS 1,200,000\nTimeline: 2–3 weeks\nIncludes: 5 pages, hosting setup, WhatsApp integration\nSupport: 3 months' },
	services: { title: 'Company Registration Package', details: 'Price: from TZS 300,000\nTimeline: 7 working days\nIncludes: name search, BRELA filing\nRequirement: IDs of directors' }
};

// Derive the knowledge-page copy for every entry that doesn't define its own,
// so adding an industry never requires hand-writing boilerplate strings.
for (const e of Object.values(INDUSTRIES)) {
	if (e.kb) continue;
	const t = e.terms;
	const ex = KB_EXAMPLES[e.key] ?? { title: 'Example item', details: 'Price: …\nDetails: …' };
	e.kb = {
		searchPlaceholder: `Search ${t.items}, FAQs…`,
		titlePlaceholder: `e.g. ${ex.title}`,
		categoryPlaceholder: e.knowledgeTypes[0],
		detailsPlaceholder: ex.details,
		bodyPlaceholder: `Full details, what's included, and anything a ${t.customer} would ask…`,
		emptyTitle: 'Your catalogue is empty',
		emptyText: `Your AI can only recommend ${t.items} and answer questions that exist here. Add your first item to get started.`,
		addFirstCta: `Add a ${t.item}`,
		importCta: `Import ${t.items}`,
		importHint: `Have a spreadsheet? Paste a CSV to add lots of ${t.items} in one go.`,
		csvExample: `title,category,price,currency,body\n"${ex.title}",${e.knowledgeTypes[0].toLowerCase()},100,USD,"Description…"`
	};
}

/** Ordered list for pickers (tourism first — the default). */
export const INDUSTRY_LIST = Object.values(INDUSTRIES);

/** Resolve an industry key from a client row (or raw key). Unknown/missing →
 *  tourism, so pre-migration rows and legacy tenants behave exactly as today. */
export function industryKeyOf(clientOrKey) {
	const key = typeof clientOrKey === 'string' ? clientOrKey : clientOrKey?.industry;
	return key && INDUSTRIES[key] ? key : DEFAULT_INDUSTRY;
}

/** The client-safe industry entry for a client row (never null). */
export function industryOf(clientOrKey) {
	return INDUSTRIES[industryKeyOf(clientOrKey)];
}

// ---- Proposal Engine config -------------------------------------------------
// One reusable engine, configured per industry. The engine never branches on a
// doc type or industry name — it reads this config. Every label here is data.

/** All document types the engine supports (key → display label). */
export const PROPOSAL_DOC_TYPES = {
	quotation: 'Quotation',
	proposal: 'Proposal',
	estimate: 'Estimate',
	offer: 'Offer',
	booking: 'Booking Summary',
	invoice: 'Invoice',
	payment_request: 'Payment Request',
	agreement: 'Service Agreement',
	contract: 'Contract Draft',
	custom: 'Custom Document'
};

// The headline name each industry gives its primary sales document, plus which
// document types its picker offers (first = default). Industry-agnostic: unknown
// industries fall back to the neutral 'services' set.
const PROPOSAL_DOC_LABEL = {
	tourism: 'Quotation',
	hotel: 'Booking Proposal',
	healthcare: 'Treatment Estimate',
	education: 'Fee Estimate',
	government: 'Service Proposal',
	retail: 'Product Offer',
	realestate: 'Property Proposal',
	restaurant: 'Catering Quote',
	ictagency: 'Project Proposal',
	services: 'Proposal'
};
const PROPOSAL_DOC_TYPES_BY_INDUSTRY = {
	tourism: ['quotation', 'proposal', 'invoice', 'custom'],
	hotel: ['booking', 'quotation', 'invoice', 'custom'],
	healthcare: ['estimate', 'invoice', 'custom'],
	education: ['estimate', 'offer', 'invoice', 'custom'],
	government: ['proposal', 'estimate', 'custom'],
	retail: ['offer', 'quotation', 'invoice', 'custom'],
	realestate: ['proposal', 'offer', 'agreement', 'custom'],
	restaurant: ['quotation', 'booking', 'invoice', 'custom'],
	ictagency: ['proposal', 'quotation', 'estimate', 'agreement', 'contract', 'invoice', 'custom'],
	services: ['proposal', 'quotation', 'estimate', 'invoice', 'custom']
};
const PROPOSAL_DEFAULT_TERMS =
	'This document is valid until the expiry date shown above. All prices are quoted in the stated currency and are subject to availability and confirmation. Taxes apply where relevant. Please get in touch if you have any questions — we’re happy to help.';

/** Proposal config for a client/industry: available doc types, default type,
 *  the industry’s headline label, and sensible default terms. */
export function proposalConfig(clientOrKey) {
	const key = industryKeyOf(clientOrKey);
	const keys = PROPOSAL_DOC_TYPES_BY_INDUSTRY[key] ?? PROPOSAL_DOC_TYPES_BY_INDUSTRY.services;
	const docTypes = keys.map((k) => ({ key: k, label: PROPOSAL_DOC_TYPES[k] ?? k }));
	return {
		docTypes,
		defaultDocType: docTypes[0].key,
		docLabel: PROPOSAL_DOC_LABEL[key] ?? 'Proposal',
		defaultTerms: PROPOSAL_DEFAULT_TERMS
	};
}
