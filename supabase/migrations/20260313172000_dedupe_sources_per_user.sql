create temporary table duplicate_label_map as
with ranked as (
  select
    id,
    user_id,
    entity_kind,
    external_discogs_id,
    first_value(id) over (
      partition by user_id, entity_kind, external_discogs_id
      order by updated_at desc nulls last, id desc
    ) as canonical_id
  from public.labels
  where user_id is not null
    and external_discogs_id is not null
)
select id as duplicate_id, canonical_id
from ranked
where id <> canonical_id;

insert into public.source_releases (source_id, release_id, user_id, release_order, discovered_at)
select distinct
  map.canonical_id,
  sr.release_id,
  sr.user_id,
  sr.release_order,
  sr.discovered_at
from duplicate_label_map map
join public.source_releases sr on sr.source_id = map.duplicate_id
on conflict (source_id, release_id) do nothing;

update public.releases as target
set label_id = map.canonical_id
from duplicate_label_map map
where target.label_id = map.duplicate_id;

update public.queue_items as target
set label_id = map.canonical_id
from duplicate_label_map map
where target.label_id = map.duplicate_id;

update public.feedback_events as target
set label_id = map.canonical_id
from duplicate_label_map map
where target.label_id = map.duplicate_id;

delete from public.source_releases as target
using duplicate_label_map map
where target.source_id = map.duplicate_id;

delete from public.labels as target
using duplicate_label_map map
where target.id = map.duplicate_id;

drop table duplicate_label_map;

create unique index if not exists labels_user_entity_external_uq
  on public.labels (user_id, entity_kind, external_discogs_id)
  where user_id is not null and external_discogs_id is not null;
