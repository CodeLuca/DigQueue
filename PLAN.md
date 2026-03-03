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
- [~] Job control UX: batch controls exist; grouped Failure Center + run history/throughput are shipped, but deeper remediation workflows still need improvement

## Next Iterations
1. Failure center phase 2: one-click remediation actions per category (e.g. reconnect OAuth, clear stale locks, targeted retry).
2. Processing observability phase 2: persistent timeline, per-source last-success timestamp, and run duration percentiles.
3. Regression coverage phase 2: route-level tests for OAuth start/callback handlers and queue playback state transitions.
4. Copy and mobile UX polish pass across all tabs (reduce control density, simplify labels/actions on narrow screens).
