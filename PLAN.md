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
- [x] Discogs link reliability hardening (slug/plural/query path normalization + UI/ingest canonicalization)
- [x] Client playback/queue reliability pass (shared event channels + enqueue/quota helpers)
- [x] Failure Center remediation audit feedback (action/scope/affected summaries + quick triage chips)
- [x] Mobile commute UX pass in Listening Station (sticky quick rail, commute preset, focused row navigation, auto-next playback toggle, skip+play action)

## Current Focus (P0)
- [~] Failure Center phase 2
  - Goal: reduce manual intervention and speed up recovery from blocked sources.
  - Remaining work:
    - Add category-specific one-click remediations not yet covered.
    - Add scoped bulk actions with clearer confirmation/copy for destructive or broad actions.
    - Improve operator clarity on what action ran, against which sources, and what changed.
  - Done when:
    - Top recurring failure categories each have a direct remediation path.
    - Remediation actions are auditable in UI feedback (success/failure + affected count).

## Near-Term (P1)
- [ ] Observability phase 2 completion
  - Extend trend views beyond current 10m/60m bars into operator-useful diagnostics:
    - breakdown by failure category/source kind/provider
    - clearer latency/throughput trend context per window
    - simple anomaly highlighting (spike/drop badges)
  - Done when:
    - A user can identify "what changed" in the last hour without opening logs.

- [ ] Regression coverage phase 2 completion
  - Focus on route-level and behavior-level coverage for:
    - sources-next/failure remediation decision paths
    - queue playback transition edge cases
    - OAuth callback happy/error path parity across providers
  - Done when:
    - Critical ingest/playback/auth regressions are caught by the regression suite before deploy.

- [ ] Copy and mobile polish pass
  - Continue simplifying dense controls and labels on narrow screens.
  - Ensure action feedback text is short, explicit, and non-ambiguous.
  - Done when:
    - Primary flows (add source, recover source, play/review/save) are comfortably usable on mobile.

## Later (P2)
- [ ] Reliability guardrails
  - Add lightweight deploy-time smoke checks for auth, queue enqueue, and source-next endpoints.
  - Add alert thresholds for repeated failure categories and stalled processing.

- [ ] Product quality upgrades
  - Introduce clearer onboarding health states (connected, partially configured, blocked).
  - Add user-facing "what to do next" hints tied to current system state.

## Next Execution Order
1. Finish Failure Center phase 2 (highest leverage for operational stability).
2. Close Observability phase 2 with category/source breakdown views.
3. Land remaining regression coverage for remediation + playback transitions.
4. Run copy/mobile pass to tighten usability after behavior stabilizes.
