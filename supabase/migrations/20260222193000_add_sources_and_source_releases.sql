alter table public.labels
  add column if not exists entity_kind text not null default 'label';

alter table public.labels
  add column if not exists external_discogs_id bigint;

update public.labels
set external_discogs_id = case
  when id >= 1000000000 then id % 1000000000
  when id > 0 then id
  else null
end
where external_discogs_id is null;

update public.labels
set entity_kind = case
  when discogs_url ilike '%/artist/%' then 'artist'
  else 'label'
end;

create table if not exists public.source_releases (
  source_id bigint not null references public.labels(id) on delete cascade,
  release_id bigint not null references public.releases(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  release_order integer not null default 0,
  discovered_at bigint not null,
  primary key (source_id, release_id)
);

insert into public.source_releases (source_id, release_id, user_id, release_order, discovered_at)
select
  r.label_id,
  r.id,
  r.user_id,
  coalesce(r.release_order, 0),
  coalesce(r.fetched_at, extract(epoch from now())::bigint * 1000)
from public.releases r
where r.label_id is not null
on conflict (source_id, release_id) do nothing;

create index if not exists source_releases_source_idx on public.source_releases(source_id, release_order);
create index if not exists source_releases_release_idx on public.source_releases(release_id);
create index if not exists source_releases_user_source_idx on public.source_releases(user_id, source_id);
create index if not exists labels_entity_kind_idx on public.labels(entity_kind);
create index if not exists labels_external_discogs_id_idx on public.labels(external_discogs_id);
