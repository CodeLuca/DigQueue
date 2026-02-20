# Plan

## Current MVP Status
- [x] App scaffold and dark UI foundation
- [x] Supabase Postgres/Drizzle schema + migration
- [x] Discogs label -> release -> track ingestion
- [x] YouTube search + candidate scoring + override
- [x] Queue orchestration + persistent mini-player
- [x] Todo/wishlist actions + recommendation seed logic
- [x] CSV/JSON export + legal outbound links
- [x] Pages: dashboard, label detail, release detail, settings

## Next Iterations
1. Release-mode fallback when track matches are weak.
2. Recommendation ranking from listening history and label affinity.
3. OAuth-based YouTube playlist export.
4. Better job control (batch process, retries, failure UI).
