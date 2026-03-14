create extension if not exists pgcrypto;

drop index if exists labels_user_entity_external_uq;

create temporary table artist_source_id_map as
select
  id as old_id,
  (
    1000000000000000::bigint
    + (
      (
        ('x' || substr(encode(digest('artist:' || user_id::text, 'sha256'), 'hex'), 1, 6))::bit(24)::int
        % 900000
      ) + 1
    )::bigint * 1000000000::bigint
    + external_discogs_id
  )::bigint as new_id
from public.labels
where entity_kind = 'artist'
  and user_id is not null
  and external_discogs_id is not null
  and id < 1000000000000000::bigint;

insert into public.labels (
  id,
  user_id,
  entity_kind,
  external_discogs_id,
  name,
  discogs_url,
  blurb,
  image_url,
  notable_releases_json,
  source_type,
  active,
  status,
  current_page,
  total_pages,
  retry_count,
  last_error,
  added_at,
  updated_at
)
select
  map.new_id,
  source.user_id,
  source.entity_kind,
  source.external_discogs_id,
  source.name,
  source.discogs_url,
  source.blurb,
  source.image_url,
  source.notable_releases_json,
  source.source_type,
  source.active,
  source.status,
  source.current_page,
  source.total_pages,
  source.retry_count,
  source.last_error,
  source.added_at,
  source.updated_at
from artist_source_id_map map
join public.labels source on source.id = map.old_id;

update public.releases target
set label_id = map.new_id
from artist_source_id_map map
where target.label_id = map.old_id;

update public.source_releases target
set source_id = map.new_id
from artist_source_id_map map
where target.source_id = map.old_id;

update public.queue_items target
set label_id = map.new_id
from artist_source_id_map map
where target.label_id = map.old_id;

update public.feedback_events target
set label_id = map.new_id
from artist_source_id_map map
where target.label_id = map.old_id;

delete from public.labels target
using artist_source_id_map map
where target.id = map.old_id;

drop table artist_source_id_map;

create unique index if not exists labels_user_entity_external_uq
  on public.labels (user_id, entity_kind, external_discogs_id)
  where user_id is not null and external_discogs_id is not null;
