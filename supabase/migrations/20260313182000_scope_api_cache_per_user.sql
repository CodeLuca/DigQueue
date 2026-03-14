alter table public.api_cache drop constraint if exists api_cache_pkey;

create unique index if not exists api_cache_user_key_uq
  on public.api_cache (user_id, key);

create index if not exists api_cache_key_idx
  on public.api_cache (key);
