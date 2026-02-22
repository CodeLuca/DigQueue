alter table public.app_secrets
  add column if not exists youtube_oauth_refresh_token text,
  add column if not exists youtube_oauth_access_token text,
  add column if not exists youtube_oauth_expires_at bigint,
  add column if not exists youtube_oauth_scope text,
  add column if not exists youtube_oauth_channel_id text,
  add column if not exists youtube_oauth_channel_title text;
