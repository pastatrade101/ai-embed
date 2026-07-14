-- Migration 003 — richer client settings (General / Contact / Assistant /
-- Booking / AI). Idempotent: run in the Supabase SQL editor after 002.

-- General
alter table clients add column if not exists logo_url text;

-- Contact
alter table clients add column if not exists phone text;
alter table clients add column if not exists contact_email text;
alter table clients add column if not exists address text;

-- Assistant (business_context is reused as "System instructions")
alter table clients add column if not exists assistant_name text;
alter table clients add column if not exists tone text;
alter table clients add column if not exists welcome_message text;
alter table clients add column if not exists languages text;

-- Booking
alter table clients add column if not exists default_currency text default 'USD';
alter table clients add column if not exists lead_destination text default 'whatsapp';
alter table clients add column if not exists business_hours text;

-- AI
alter table clients add column if not exists auto_lead_capture boolean not null default true;
alter table clients add column if not exists escalation text;
alter table clients add column if not exists suggested_questions jsonb not null default '[]'::jsonb;
