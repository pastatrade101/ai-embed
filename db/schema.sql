-- Makutano Digital — run this once in the Supabase SQL editor.
-- Five tables, every row scoped by client_id. The generic knowledge_items
-- table carries a metadata JSONB column so one schema serves any industry.
--
-- Embedding dimension MUST match the model: vector(1024) = Voyage voyage-3.
-- For OpenAI text-embedding-3-small, change every vector(1024) to vector(1536).

-- extensions
create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table clients (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  business_type text,
  business_context text,                    -- injected into the system prompt
  whatsapp_number text,
  lead_email text,
  website_url text,                         -- optional one-time crawl source
  plan text not null default 'starter',
  monthly_conversation_cap int default 200,
  brand_color text default '#0f6e56',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table knowledge_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  category text,
  body text,
  price_amount numeric(12,2),
  price_currency text default 'USD',
  metadata jsonb not null default '{}'::jsonb,   -- industry-specific
  is_published boolean not null default true,
  updated_at timestamptz not null default now()
);
create index on knowledge_items (client_id);
create index on knowledge_items using gin (metadata);

create table content_chunks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  item_id uuid not null references knowledge_items(id) on delete cascade,
  content text not null,
  embedding vector(1024),                   -- voyage-3
  created_at timestamptz not null default now()
);
create index on content_chunks (client_id);
create index content_chunks_embedding_idx
  on content_chunks using hnsw (embedding vector_cosine_ops);

create table leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text, whatsapp text, email text, interest text,
  transcript jsonb,
  created_at timestamptz not null default now()
);
create index on leads (client_id, created_at desc);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index on conversations (client_id, created_at desc);

-- Retrieval function. Tenant isolation is enforced INSIDE this query,
-- not in application code.
create or replace function match_chunks(
  p_client_id uuid,
  p_query_embedding vector(1024),
  p_match_count int default 5
) returns table (chunk_id uuid, item_id uuid, content text, similarity float)
language sql stable as $$
  select cc.id, cc.item_id, cc.content,
         1 - (cc.embedding <=> p_query_embedding) as similarity
  from content_chunks cc
  where cc.client_id = p_client_id             -- tenant isolation
  order by cc.embedding <=> p_query_embedding
  limit p_match_count;
$$;

-- RLS on, no permissive policies = anon key gets nothing.
-- The Worker uses the service_role key which bypasses RLS.
alter table clients          enable row level security;
alter table knowledge_items  enable row level security;
alter table content_chunks   enable row level security;
alter table leads            enable row level security;
alter table conversations    enable row level security;
