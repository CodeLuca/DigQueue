\set ON_ERROR_STOP on

truncate table
  public.youtube_matches,
  public.queue_items,
  public.feedback_events,
  public.tracks,
  public.release_signals,
  public.releases,
  public.labels,
  public.api_cache,
  public.app_secrets,
  public.__drizzle_migrations
restart identity;

create temporary table stage_labels (
  id bigint,
  name text,
  discogs_url text,
  blurb text,
  image_url text,
  notable_releases_json text,
  source_type text,
  active boolean,
  status text,
  current_page integer,
  total_pages integer,
  retry_count integer,
  last_error text,
  added_at bigint,
  updated_at bigint
);

create temporary table stage_releases (
  id bigint,
  label_id bigint,
  title text,
  artist text,
  year integer,
  catno text,
  discogs_url text,
  thumb_url text,
  details_fetched boolean,
  youtube_matched boolean,
  listened boolean,
  wishlist boolean,
  match_confidence double precision,
  processing_error text,
  fetched_at bigint,
  release_order integer,
  import_source text
);

create temporary table stage_tracks (
  id bigint,
  release_id bigint,
  position text,
  title text,
  duration text,
  artists_text text,
  listened boolean,
  saved boolean,
  wishlist boolean,
  created_at bigint
);

create temporary table stage_youtube_matches (
  id bigint,
  track_id bigint,
  video_id text,
  title text,
  channel_title text,
  score double precision,
  embeddable boolean,
  chosen boolean,
  fetched_at bigint
);

create temporary table stage_queue_items (
  id bigint,
  youtube_video_id text,
  track_id bigint,
  release_id bigint,
  label_id bigint,
  source text,
  priority integer,
  bumped_at bigint,
  status text,
  added_at bigint
);

create temporary table stage_feedback_events (
  id bigint,
  track_id bigint,
  release_id bigint,
  label_id bigint,
  event_type text,
  event_value double precision,
  source text,
  created_at bigint
);

create temporary table stage_release_signals (
  release_id bigint,
  primary_artist text,
  styles_text text,
  genres_text text,
  contributors_text text,
  companies_text text,
  format_text text,
  country text,
  year integer,
  updated_at bigint
);

create temporary table stage_api_cache (
  key text,
  response_json text,
  fetched_at bigint,
  expires_at bigint
);

create temporary table stage_app_secrets (
  id bigint,
  discogs_token text,
  youtube_api_key text,
  updated_at bigint
);

create temporary table stage_drizzle_migrations (
  id integer,
  hash text,
  created_at bigint
);

\copy stage_labels from :'snapshot_dir'/csv/labels.csv with (format csv, header true)
\copy stage_releases from :'snapshot_dir'/csv/releases.csv with (format csv, header true)
\copy stage_tracks from :'snapshot_dir'/csv/tracks.csv with (format csv, header true)
\copy stage_youtube_matches from :'snapshot_dir'/csv/youtube_matches.csv with (format csv, header true)
\copy stage_release_signals from :'snapshot_dir'/csv/release_signals.csv with (format csv, header true)
\copy stage_queue_items from :'snapshot_dir'/csv/queue_items.csv with (format csv, header true)
\copy stage_feedback_events from :'snapshot_dir'/csv/feedback_events.csv with (format csv, header true)
\copy stage_api_cache from :'snapshot_dir'/csv/api_cache.csv with (format csv, header true)
\copy stage_app_secrets from :'snapshot_dir'/csv/app_secrets.csv with (format csv, header true)
\copy stage_drizzle_migrations from :'snapshot_dir'/csv/__drizzle_migrations.csv with (format csv, header true)

insert into public.labels (
  id, user_id, name, discogs_url, blurb, image_url, notable_releases_json, source_type, active, status,
  current_page, total_pages, retry_count, last_error, added_at, updated_at
)
select id, :'app_user_id'::uuid, name, discogs_url, blurb, image_url, notable_releases_json, source_type, active, status,
  current_page, total_pages, retry_count, last_error, added_at, updated_at
from stage_labels;

insert into public.releases (
  id, user_id, label_id, title, artist, year, catno, discogs_url, thumb_url, details_fetched,
  youtube_matched, listened, wishlist, match_confidence, processing_error, fetched_at, release_order, import_source
)
select id, :'app_user_id'::uuid, label_id, title, artist, year, catno, discogs_url, thumb_url, details_fetched,
  youtube_matched, listened, wishlist, match_confidence, processing_error, fetched_at, release_order, import_source
from stage_releases;

insert into public.tracks (
  id, user_id, release_id, position, title, duration, artists_text, listened, saved, wishlist, created_at
)
select id, :'app_user_id'::uuid, release_id, position, title, duration, artists_text, listened, saved, wishlist, created_at
from stage_tracks;

insert into public.youtube_matches (
  id, user_id, track_id, video_id, title, channel_title, score, embeddable, chosen, fetched_at
)
select id, :'app_user_id'::uuid, track_id, video_id, title, channel_title, score, embeddable, chosen, fetched_at
from stage_youtube_matches;

insert into public.release_signals (
  release_id, user_id, primary_artist, styles_text, genres_text, contributors_text, companies_text, format_text, country, year, updated_at
)
select release_id, :'app_user_id'::uuid, primary_artist, styles_text, genres_text, contributors_text, companies_text, format_text, country, year, updated_at
from stage_release_signals;

insert into public.queue_items (
  id, user_id, youtube_video_id, track_id, release_id, label_id, source, priority, bumped_at, status, added_at
)
select id, :'app_user_id'::uuid, youtube_video_id, track_id, release_id, label_id, source, priority, bumped_at, status, added_at
from stage_queue_items;

insert into public.feedback_events (
  id, user_id, track_id, release_id, label_id, event_type, event_value, source, created_at
)
select id, :'app_user_id'::uuid, track_id, release_id, label_id, event_type, event_value, source, created_at
from stage_feedback_events;

insert into public.api_cache (
  key, user_id, response_json, fetched_at, expires_at
)
select key, :'app_user_id'::uuid, response_json, fetched_at, expires_at
from stage_api_cache;

insert into public.app_secrets (
  id, user_id, discogs_token, youtube_api_key, updated_at
)
select id, :'app_user_id'::uuid, discogs_token, youtube_api_key, updated_at
from stage_app_secrets;

insert into public.__drizzle_migrations (id, hash, created_at)
select id, hash, created_at
from stage_drizzle_migrations;

select setval(pg_get_serial_sequence('public.tracks', 'id'), coalesce((select max(id) from public.tracks), 1), true);
select setval(pg_get_serial_sequence('public.youtube_matches', 'id'), coalesce((select max(id) from public.youtube_matches), 1), true);
select setval(pg_get_serial_sequence('public.queue_items', 'id'), coalesce((select max(id) from public.queue_items), 1), true);
select setval(pg_get_serial_sequence('public.feedback_events', 'id'), coalesce((select max(id) from public.feedback_events), 1), true);
select setval(pg_get_serial_sequence('public.__drizzle_migrations', 'id'), coalesce((select max(id) from public.__drizzle_migrations), 1), true);
