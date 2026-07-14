-- Migration 006 — conversation memory. Idempotent; run after 005.
-- Conversations now have a stable identity (the widget sends conversation_id and
-- we append to one row instead of creating a row per turn) plus a rolling
-- summary so long chats don't resend the whole history to the model.

alter table conversations add column if not exists summary text;
alter table conversations add column if not exists updated_at timestamptz not null default now();
create index if not exists conversations_updated_idx on conversations (client_id, updated_at desc);
