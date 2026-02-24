# Plan

## Delivered
- [x] App scaffold + UI system foundation
- [x] Supabase Postgres/Drizzle schema + migrations
- [x] Discogs source ingestion (label/artist -> release -> track)
- [x] YouTube candidate search, scoring, and manual override support
- [x] Queue orchestration + persistent mini-player
- [x] Todo/wishlist actions + recommendation seed/event capture
- [x] CSV/JSON export + legal outbound links
- [x] Core pages: Sources, Listening Station, Library, Recommendations, Settings
- [x] Release-level fallback when per-track matches are weak
- [x] Recommendation ranking from listening history + label affinity
- [x] OAuth-based YouTube playlist export from Library
- [x] Auth/onboarding flow refresh (`/welcome`, logged-in how-to-use access)
- [x] Mobile/iOS playback hardening + single-tab playback ownership guard
- [x] Production rollout on Railway with current feature set
- [x] Beginner-friendly batch controls on Sources (queue/retry/resume/pause quick actions)

## In Progress / Partial
- [~] Job control UX: batch controls now exist, but run visibility and error guidance still need improvement

## Next Iterations
1. Failure center that groups errors by type (rate limit, provider, data, auth) with one-click suggested actions.
2. Processing observability panel (current worker/source, throughput, recent run history, last successful sync).
3. Regression coverage for auth redirects, playlist export flow, and mobile playback behavior (especially iOS/background cases).
4. Copy and mobile UX polish pass across all tabs (reduce control density, simplify labels/actions on narrow screens).
