-- 021_whatsapp_connections.sql — per-tenant WhatsApp Cloud API credentials, populated
-- by Meta Embedded Signup. Each tenant owns its own WhatsApp Business number; the
-- access token is stored ENCRYPTED (AES-256-GCM, key = WHATSAPP_ENC_KEY) — never plain.
-- phone_number_id is UNIQUE (it's how inbound webhooks route to the owning tenant).
--
-- Run manually in Supabase. Fails open before this migration: the app uses the single
-- platform number from .env until a tenant connects its own.

create table if not exists whatsapp_connections (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references clients(id) on delete cascade,
	meta_business_id text,
	whatsapp_business_account_id text,
	phone_number_id text not null unique,   -- inbound webhooks route on this
	display_phone_number text,
	verified_name text,
	encrypted_access_token text not null,   -- AES-256-GCM blob, never plaintext
	token_expires_at timestamptz,
	-- connected | disconnected | pending_verification | permission_revoked
	-- | expired_token | phone_number_removed | webhook_error
	status text not null default 'connected',
	connected_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists whatsapp_connections_client_idx on whatsapp_connections (client_id, updated_at desc);

comment on table whatsapp_connections is 'Per-tenant WhatsApp Cloud API credentials from Meta Embedded Signup. Tokens are encrypted at rest.';
