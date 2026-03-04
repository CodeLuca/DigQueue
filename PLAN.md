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
- [~] Job control UX: batch controls exist; grouped Failure Center + run history/throughput are shipped, plus direct Discogs reconnect and stale-lock cleanup actions, but deeper remediation workflows still need improvement

## Next Iterations
1. Failure center phase 2: expand remediation actions per category beyond current retry/reconnect/lock-cleanup/metadata-refresh/rate-limit-pause controls (grouping logic is now centralized in shared helper).
2. Processing observability phase 2: longer-window trend views (run duration percentiles + 10-minute timeline with bar visualization + 60-minute summary are now surfaced; throughput/timeline primitives, sync event types, and sources-next response defaults are centralized).
3. Regression coverage phase 2: route-level tests for OAuth start/callback handlers and queue playback state transitions (OAuth provider/start/redirect/callback query/messages/url/next-resolution + temp-cookie options/keys mapping + state helper + queue mutation/selection/POST-parse/DB helpers are now extracted and covered).
4. Copy and mobile UX polish pass across all tabs (Failure Center + sync status density reduced, including duplicate hint suppression and collapsed per-source success on small screens; continue simplifying labels/actions on narrow screens).
