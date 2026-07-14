# Makutano Digital

An embeddable, grounded AI site assistant. Any business drops one `<script>` tag
onto its website; the assistant answers customer questions from the business's
own verified data, captures leads, and hands them to WhatsApp — it never invents
facts and never sends customers to a competitor.

SvelteKit + Supabase (Postgres + pgvector) + Claude Haiku 4.5 + Voyage voyage-3.

## Architecture

Two paths. The **runtime path** runs on every visitor question and never touches
the operator's live site. The **admin path** runs at onboarding (and again when
data changes). All intelligence is server-side, scoped by `client_id`.

```
RUNTIME  widget → /api/chat → embed question → match_chunks(client, q) → Claude (grounded) → answer + lead capture
ADMIN    operator data → admin panel → chunk + embed (voyage-3) → content_chunks
```

Tenant isolation is enforced **inside** the `match_chunks()` SQL function, not in
application code. RLS is on with no permissive policies — the anon key reads
nothing; the server uses the `service_role` key which bypasses RLS.

## Project structure

```
db/schema.sql                     # run once in the Supabase SQL editor
src/lib/server/
  supabase.js                     # service_role client (server only)
  embeddings.js                   # Voyage voyage-3 + chunking
  rag.js                          # retrieve + ground + answer, and ingestion
  email.js                        # Resend lead notifications
  cors.js                         # cross-origin helpers for the widget
src/routes/
  +layout.svelte  +page.svelte  +page.server.js         # admin dashboard
  clients/[slug]/+page.svelte  +page.server.js           # manage one client
  api/chat/+server.js                                    # widget chat endpoint
  api/leads/+server.js                                   # lead capture
static/
  widget.js                       # the embeddable vanilla-JS widget (<30KB)
  embed-demo.html                 # local test page
```

## Setup

1. Create a Supabase project. Open the SQL editor and run `db/schema.sql`.
2. Copy `.env.example` to `.env` and fill in every key (all server-side only).
3. Install and run:

   ```sh
   npm install
   npm run dev          # admin at http://localhost:5173
   ```

4. In the admin panel, create a client, add a few knowledge items (they embed
   automatically), then open `http://localhost:5173/embed-demo.html` to try the
   widget against that client.

## Onboarding a client

1. Create the `clients` row (name, slug, business_context, WhatsApp).
2. Add `knowledge_items` — the clean, human-readable catalogue. Each save chunks
   the body, embeds each chunk with Voyage, and writes `content_chunks`.
3. Give the operator their embed snippet (shown on the client page).

The website is a bootstrap, not the source of truth: the assistant always answers
from `knowledge_items`, never the live page. That makes it immune to messy sites
and prevents hallucination. Data freshness is the main churn risk — make
"message me and I'll update it" a dead-simple service until a self-serve editor
exists.

## Accounts, roles & plans

The platform has **two roles**, one login page (`/login`):

- **Super admin (you)** → `/admin`. Sees every tenant, manages clients, plans &
  subscriptions, and each client's operator logins.
- **Operator (a client)** → `/portal`. Self-serve: manages their own knowledge,
  settings, and views their leads / conversations / usage. Scoped to one client.

Auth is built-in: email + password (scrypt-hashed), signed session cookie, users
in one `users` table. `service_role` still does all data access server-side, so
the "RLS on, no policies" model is untouched.

**Plans & subscriptions** are internal (no card processor): a `plans` table of
tiers (name, price, monthly conversation cap). Assigning a plan to a client sets
its cap; `/api/chat` enforces the cap and pauses answering when a subscription is
past-due/canceled or the cap is hit. Billing is manual for now (spec Phase 6).

### One-time activation

1. Run **`db/002_auth_billing.sql`** in the Supabase SQL editor (adds `users`,
   `plans`, subscription columns; seeds Starter/Growth/Pro plans). Idempotent.
2. Add **`AUTH_SECRET`** (a long random string) to `.env`.
3. Create your super-admin account:
   ```sh
   node scripts/create-user.mjs super_admin you@example.com "your-password" "Your Name"
   ```
4. `npm run dev`, sign in at `/login` → you land on `/admin`.

Create operator logins from the admin **client → Access** tab (or at client
creation). Operators sign in at the same `/login` and land on `/portal`.

## Guardrails (baked in, not a polish step)

- Answers only from retrieved context; refuses to invent tours, services, prices.
- On unknown questions, says so and offers to connect to the team.
- Never recommends a competitor.
- Prices are stored as a real column so exact figures are injected, never generated.
- CORS should be restricted to onboarded domains in production (currently `*`).

## Model note

The chat model is `claude-haiku-4-5` — fast and cheap per conversation, which is
the business case; grounding does the heavy lifting. Swap `CHAT_MODEL` in
`src/lib/server/rag.js` to `claude-sonnet-5` for a Pro tier.
