# Context

## Environment Variables
- `DISCOGS_TOKEN`
- `YOUTUBE_API_KEY`
- `NEXT_PUBLIC_APP_NAME` (default: DigQueue)
- `DATABASE_URL` (default: `./db/digqueue.db`)

## Important Paths
- DB schema: `db/schema.ts`
- Processing logic: `lib/processing.ts`
- Discogs client: `lib/discogs.ts`
- YouTube client: `lib/youtube.ts`
- Dashboard: `app/page.tsx`
- Player: `components/mini-player.tsx`

## Operational Notes
- API routes and data-heavy pages are forced dynamic.
- SQLite lock mitigation is enabled via DB timeout.
- Seed labels can be loaded from dashboard action.
