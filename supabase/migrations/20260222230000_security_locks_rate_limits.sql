create table if not exists public.worker_locks (
  lock_key text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id bigint not null,
  lease_token text not null,
  locked_until bigint not null,
  updated_at bigint not null
);

create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  request_count integer not null default 0,
  window_started_at bigint not null,
  reset_at bigint not null,
  updated_at bigint not null
);

create index if not exists worker_locks_user_source_idx on public.worker_locks(user_id, source_id);
create index if not exists worker_locks_locked_until_idx on public.worker_locks(locked_until);
create index if not exists api_rate_limits_user_endpoint_idx on public.api_rate_limits(user_id, endpoint);
create index if not exists api_rate_limits_reset_idx on public.api_rate_limits(reset_at);

alter table public.labels enable row level security;
alter table public.releases enable row level security;
alter table public.tracks enable row level security;
alter table public.youtube_matches enable row level security;
alter table public.queue_items enable row level security;
alter table public.feedback_events enable row level security;
alter table public.release_signals enable row level security;
alter table public.api_cache enable row level security;
alter table public.app_secrets enable row level security;
alter table public.source_releases enable row level security;
alter table public.worker_locks enable row level security;
alter table public.api_rate_limits enable row level security;

alter table public.labels force row level security;
alter table public.releases force row level security;
alter table public.tracks force row level security;
alter table public.youtube_matches force row level security;
alter table public.queue_items force row level security;
alter table public.feedback_events force row level security;
alter table public.release_signals force row level security;
alter table public.api_cache force row level security;
alter table public.app_secrets force row level security;
alter table public.source_releases force row level security;
alter table public.worker_locks force row level security;
alter table public.api_rate_limits force row level security;

drop policy if exists labels_own on public.labels;
drop policy if exists releases_own on public.releases;
drop policy if exists tracks_own on public.tracks;
drop policy if exists youtube_matches_own on public.youtube_matches;
drop policy if exists queue_items_own on public.queue_items;
drop policy if exists feedback_events_own on public.feedback_events;
drop policy if exists release_signals_own on public.release_signals;
drop policy if exists api_cache_own on public.api_cache;
drop policy if exists app_secrets_own on public.app_secrets;
drop policy if exists source_releases_own on public.source_releases;
drop policy if exists worker_locks_own on public.worker_locks;
drop policy if exists api_rate_limits_own on public.api_rate_limits;

create policy labels_own on public.labels
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy releases_own on public.releases
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy tracks_own on public.tracks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy youtube_matches_own on public.youtube_matches
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy queue_items_own on public.queue_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy feedback_events_own on public.feedback_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy release_signals_own on public.release_signals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy api_cache_own on public.api_cache
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy app_secrets_own on public.app_secrets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy source_releases_own on public.source_releases
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy worker_locks_own on public.worker_locks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy api_rate_limits_own on public.api_rate_limits
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
