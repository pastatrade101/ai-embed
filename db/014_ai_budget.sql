-- Migration 014 — AI Credits / cost-budget billing.
-- Each plan includes a monthly AI COST budget (USD of Claude + Voyage spend). The
-- customer never sees dollars or tokens by default — the app renders this as
-- "AI Usage %" and "≈ N conversations". The budget is the real revenue-protection
-- limit; monthly_conversation_cap stays as a fallback/derivation only.
--
-- Balanced ~70% gross margin on AI, on the live plan prices (Starter $20 / Growth
-- $49 / Pro $99 / Free $0). Adjust in the Plans console or here anytime.
-- Idempotent.

alter table plans add column if not exists included_ai_budget numeric(12,4) not null default 0;

update plans set included_ai_budget = 0.50 where key = 'free'    and included_ai_budget = 0;
update plans set included_ai_budget = 6.00 where key = 'starter' and included_ai_budget = 0;
update plans set included_ai_budget = 15.00 where key = 'growth'  and included_ai_budget = 0;
update plans set included_ai_budget = 32.00 where key = 'pro'     and included_ai_budget = 0;

-- Aggregate a tenant's AI spend since a cutoff. Done in SQL because PostgREST caps
-- row reads at 1000 — summing client-side would silently undercount high-volume
-- tenants and never enforce the budget. Called with the service_role key.
create or replace function tenant_ai_cost(p_client_id uuid, p_since timestamptz)
returns numeric language sql stable as $$
  select coalesce(sum(estimated_cost), 0)::numeric
  from usage_records
  where client_id = p_client_id and created_at >= p_since;
$$;

-- Per-feature usage rollup for the AI Usage dashboard (cost + tokens + calls).
create or replace function tenant_ai_usage(p_client_id uuid, p_since timestamptz)
returns table (feature text, cost numeric, input_tokens bigint, cached_tokens bigint, output_tokens bigint, calls bigint)
language sql stable as $$
  select coalesce(feature, 'conversation') as feature,
         coalesce(sum(estimated_cost), 0)::numeric,
         coalesce(sum(input_tokens), 0)::bigint,
         coalesce(sum(cached_tokens), 0)::bigint,
         coalesce(sum(output_tokens), 0)::bigint,
         count(*)::bigint
  from usage_records
  where client_id = p_client_id and created_at >= p_since
  group by 1;
$$;
