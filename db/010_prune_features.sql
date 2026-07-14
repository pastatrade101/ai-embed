-- Migration 010 — remove features that aren't enforced/deliverable from every plan,
-- so the pricing table only advertises what the product actually does. Idempotent.
-- Dropped: "Priority responses", "Custom branding & logo", "Multiple websites".

update plans
set features = coalesce(
	(
		select jsonb_agg(elem)
		from jsonb_array_elements(features) elem
		where (elem #>> '{}') not in ('Priority responses', 'Custom branding & logo', 'Multiple websites')
	),
	'[]'::jsonb
)
where features is not null
  and jsonb_typeof(features) = 'array';
