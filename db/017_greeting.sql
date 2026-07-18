-- 017: Operator-editable chat-widget greeting (the "concierge" bubble).
--
-- The widget's greeting bubble (the message that slides out beside the chat
-- button after a short idle) can now be customised per client:
--   greeting_message  a custom line the operator sets; when blank the widget
--                     falls back to smart, context-aware greetings (page
--                     intent → returning visitor → time-of-day + industry).
--                     Hard-capped in the app to GREETING_MAX chars so the
--                     bubble stays to ~2 short lines (see src/lib/greeting.js).
--   greeting_enabled  operator toggle to switch the concierge on/off without
--                     touching the embed code. Defaults on.
--
-- The app FAILS OPEN before this migration runs: /api/config reads with
-- select('*') so absent columns are simply omitted, and settings saves retry
-- without these columns on a missing-column error — nothing breaks if this
-- hasn't been applied yet.
alter table clients add column if not exists greeting_message text;
alter table clients add column if not exists greeting_enabled boolean not null default true;
