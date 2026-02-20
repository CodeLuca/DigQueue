# Context

## Environment Variables
- `DISCOGS_TOKEN`
- `YOUTUBE_API_KEY`
- `NEXT_PUBLIC_APP_NAME` (default: DigQueue)
- `SUPABASE_DB_URL` (preferred) or `POSTGRES_URL`/`DATABASE_URL` (Postgres URL)

## Important Paths
- DB schema: `db/schema.ts`
- Processing logic: `lib/processing.ts`
- Discogs client: `lib/discogs.ts`
- YouTube client: `lib/youtube.ts`
- Dashboard: `app/page.tsx`
- Player: `components/mini-player.tsx`

## Operational Notes
- API routes and data-heavy pages are forced dynamic.
- Supabase Postgres is the only supported database backend.
- Seed labels can be loaded from dashboard action.
