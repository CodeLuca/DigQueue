# DigQueue

DigQueue is a local-first MVP for digging Discogs labels while you work.

It provides:
- Label queue ingestion from Discogs (URL, ID, or name search)
- Release + track caching in Supabase Postgres via Drizzle
- Automatic YouTube candidate matching (embeddable/syndicated)
- Release-level full-upload fallback when per-track matching is weak
- Error-aware processing with retry/error tracking on labels and releases
- Persistent mini-player with autoplay next + keyboard shortcuts
- Playback modes: `track` (default), `release`, `hybrid`
- Track/release todo flow (`listened`, `saved / wishlist`) for future recommendations
- Deep recommendation signals: behavior events + Discogs metadata graph (styles/contributors/companies/formats)
- Queue-wide run control to process labels incrementally in sequence
- Ranked buy-link finder (Bandcamp-first + confidence tiers + store fallbacks)
- Legal export options (CSV/JSON) and legal purchase/search links

## Legal

DigQueue **does not download copyrighted audio**.

It only stores metadata and links, with playback through the YouTube IFrame API.
No Soulseek, ripping, or copyrighted audio download features are implemented.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind + shadcn-style UI components
- Supabase Postgres + Drizzle ORM
- Next.js server routes for Discogs + YouTube APIs
- YouTube IFrame Player API for continuous playback

## Environment

Create `.env.local`:

```bash
DISCOGS_CONSUMER_KEY=...
DISCOGS_CONSUMER_SECRET=...
YOUTUBE_API_KEY=...
YOUTUBE_OAUTH_CLIENT_ID=...
YOUTUBE_OAUTH_CLIENT_SECRET=...
# Optional override; otherwise defaults to {origin}/api/youtube/oauth/callback
# YOUTUBE_OAUTH_REDIRECT_URI=http://localhost:3000/api/youtube/oauth/callback
BANDCAMP_WISHLIST_URL=...
NEXT_PUBLIC_APP_NAME=DigQueue
SUPABASE_DB_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_SECRETS_ENCRYPTION_KEY=base64-32-byte-key
```

Optional:
- `DISCOGS_TOKEN` can be set as a backend fallback for non-user-specific Discogs access.
- `BANDCAMP_WISHLIST_URL` can point to a public fan wishlist page (for example `https://bandcamp.com/yourname/wishlist`).
- Wishlist imports are cached and paged slowly to avoid hitting Bandcamp rate limits.
- In Discogs app settings, add OAuth callback URL: `http://localhost:3000/api/discogs/oauth/callback` (and your production callback URL for deploys).
- `APP_SECRETS_ENCRYPTION_KEY` must be a 32-byte AES key encoded as base64 (or 64-char hex). It is required for storing user API secrets.

Users connect Discogs from `/connect-discogs` with one-click OAuth. `/settings` shows integration status and test results.

## Run

```bash
yarn install
yarn db:migrate
yarn dev
```

Smoke checks:

```bash
# Public auth-start redirects + auth-boundary checks on protected endpoints
yarn smoke:core

# Include authenticated queue/sync probes plus queue-scope/enqueue/worker validation boundary checks
SMOKE_BASE_URL=http://127.0.0.1:3000 \
SMOKE_COOKIE='sb-access-token=...; sb-refresh-token=...' \
yarn smoke:core
```

Release verification:

```bash
# Local release verification path
yarn release:verify

# Local release verification + live-app smoke verification
SMOKE_BASE_URL=https://your-deploy.example.com yarn release:verify:live

# Include authenticated smoke probes
SMOKE_BASE_URL=https://your-deploy.example.com \
SMOKE_COOKIE='sb-access-token=...; sb-refresh-token=...' \
yarn release:verify:live
```

`release:verify:live` retries Railway deployment/service status probes before falling back to live URL readiness, then waits for the live base URL to start responding before it runs smoke probes.

Release checklist:
- Confirm Discogs OAuth callback URL is configured for the target deploy origin.
- Run `yarn release:verify`.
- Run `yarn release:verify:live` against a live app URL.
- For authenticated smoke probes, provide `SMOKE_COOKIE` with a valid logged-in session.

## Git Workflow

After every major change or feature is finished:
1. Run checks (`yarn check` and, when relevant, `yarn build`).
2. Commit the completed work with a clear message.
3. Push immediately to the remote branch.

This repo should not accumulate multiple completed major features locally without pushing.

Node:
- Recommended: Node `20.x` (see `.nvmrc`)

Open [http://localhost:3000](http://localhost:3000).

## Implemented Routes

Pages:
- `/` dashboard (label queue, up-next, recommendations)
- `/welcome` guided quick start
- `/how-to-use` setup + workflow guide
- `/listen` unlistened track inbox with bulk todo actions
- `/labels/[id]` label progress + releases
- `/releases/[id]` tracklist, YouTube candidates, overrides, todo/wishlist
- `/settings` integrations, legal note, shortcut reference

API:
- `/api/discogs/label/[id]/releases`
- `/api/discogs/release/[id]`
- `/api/discogs/oauth/start`
- `/api/discogs/oauth/callback`
- `/api/youtube/search`
- `/api/youtube/oauth/start`
- `/api/youtube/oauth/callback`
- `/api/youtube/playlist/export`
- `/api/settings/keys/test`
- `/api/sources/next`
- `/api/queue/list`
- `/api/queue/enqueue`
- `/api/queue/scope`
- `/api/queue/next`
- `/api/finder/release/[id]`
- `/api/worker/process`
- `/api/export/csv`
- `/api/export/json`

## UX Details

- Dark, warm contrast palette with shared design tokens in `app/globals.css` and `lib/design-tokens.ts`
- Keyboard shortcuts:
  - `space` play/pause
  - `n` next
  - `b` previous
  - `l` focus label input
- Mobile single-column and desktop multi-panel layout

## Notes on Processing

`Process Label` starts a rate-limited incremental worker loop:
- fetches label release pages
- fetches release details + tracklist
- runs YouTube search/scoring for each track
- stores candidates and auto-chooses top result
- appends playable matches to queue
- captures Discogs release signals for deeper recommendations

Pause/resume is available per label.
You can also run the whole label queue from the dashboard.
Failure Center groups source errors by root cause and provides targeted remediation actions (retry by category, Discogs reconnect, stale lock cleanup, metadata refresh).

## Seed Data

Seed lists are included in `lib/seed-data.ts` and can be loaded with the **Load Seed Labels** button on the dashboard.
- Direct Discogs URL/ID seeds load without API token.
- Search-name seeds require a Discogs connection (or `DISCOGS_TOKEN` backend fallback); otherwise they are skipped (best-effort behavior).

## Limitations (MVP)

- YouTube playlist export is optional and requires connecting YouTube in Settings
- Recommendation graph currently runs in-process (no background materialized graph jobs yet)
- Background workers are lease-locked in Postgres, but there is no external job queue/retry dashboard yet

## Roadmap

1. Materialized recommendation graph jobs + optional embeddings layer
2. Release mode fallback for weak per-track matches
3. OAuth-based YouTube playlist export
4. Multi-user profiles and sync

## Supabase Bootstrap

This repo is now initialized and linked for Supabase CLI (`project-ref: swmkzqnpkncgwpwwwkto`).

Snapshot before migration:
- `db/snapshots/2026-02-18-pre-supabase/schema.sql`
- `db/snapshots/2026-02-18-pre-supabase/row-counts.json`
- `db/snapshots/2026-02-18-pre-supabase/csv/*.csv`

Schema migration:
- `supabase/migrations/` (initial schema + follow-up migrations)

Import tooling:
- `supabase/import/load_snapshot.sql`
- `scripts/supabase-import-snapshot.sh`
- `supabase/import/README.md`

Commands:
```bash
yarn supabase:start
yarn supabase:status
yarn supabase:db:push
yarn supabase:import:snapshot
```

Local + production targeting:
- Set `SUPABASE_ENV=local` for localhost stack (`supabase start`).
- Set `SUPABASE_ENV=production` for hosted Supabase.
- Configure matching keys in `.env.local`:
  - local: `NEXT_PUBLIC_SUPABASE_URL_LOCAL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL`, `SUPABASE_SERVICE_ROLE_KEY_LOCAL`
  - production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
