# SQLite -> Supabase Import

## Snapshot source
Current snapshot is stored at:
- `db/snapshots/2026-02-18-pre-supabase`

It includes:
- `schema.sql`: raw SQLite schema dump
- `row-counts.json`: row counts per table
- `csv/*.csv`: full table exports

## 1) Apply schema to linked Supabase project
```bash
supabase db push
```

## 2) Import snapshot data
Set `SUPABASE_DB_URL` to your Supabase Postgres connection string (direct DB URL), and set the target user id (created in Supabase Auth) via `SUPABASE_APP_USER_ID`.

Current migration user:
- email: `lucamarchal@gmail.com`
- id: `0e31abc1-380d-4a3e-866c-48a02a36c6e3`

Then run:
```bash
bash scripts/supabase-import-snapshot.sh "$SUPABASE_DB_URL" db/snapshots/2026-02-18-pre-supabase "$SUPABASE_APP_USER_ID"
```

## 3) Validate row counts
Compare with:
- `db/snapshots/2026-02-18-pre-supabase/row-counts.json`

Example check:
```sql
select 'labels' as table_name, count(*) from public.labels
union all select 'releases', count(*) from public.releases
union all select 'tracks', count(*) from public.tracks
union all select 'youtube_matches', count(*) from public.youtube_matches
union all select 'queue_items', count(*) from public.queue_items
union all select 'feedback_events', count(*) from public.feedback_events
union all select 'release_signals', count(*) from public.release_signals
union all select 'api_cache', count(*) from public.api_cache
union all select 'app_secrets', count(*) from public.app_secrets
union all select '__drizzle_migrations', count(*) from public.__drizzle_migrations;
```
