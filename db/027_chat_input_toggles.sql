-- 027: Per-client hosted-chat input toggles (attach + voice).
--
-- Lets an operator hide the file-attachment (📎) and voice/microphone (🎤)
-- buttons in the hosted chat (/c/[slug]) from Settings → Assistant:
--   attachments_enabled  show the attach button (still also requires the plan
--                        feature). Defaults on.
--   voice_enabled        show the mic (speech-to-text) button. Defaults on.
--
-- The app FAILS OPEN before this migration runs: the hosted loader reads with
-- select('*') so absent columns are simply omitted (treated as enabled), and
-- settings saves retry without these columns on a missing-column error — nothing
-- breaks if this hasn't been applied yet. Numbered 027 to sit above the archived
-- 022–026 migrations that already exist in Supabase from the rolled-back build.
alter table clients add column if not exists attachments_enabled boolean not null default true;
alter table clients add column if not exists voice_enabled boolean not null default true;
