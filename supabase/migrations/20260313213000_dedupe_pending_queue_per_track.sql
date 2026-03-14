with ranked_pending_queue as (
  select
    id,
    row_number() over (
      partition by user_id, track_id
      order by priority desc, bumped_at desc nulls last, added_at desc, id desc
    ) as rn
  from public.queue_items
  where user_id is not null
    and track_id is not null
    and status = 'pending'
),
duplicate_pending_queue as (
  select id
  from ranked_pending_queue
  where rn > 1
)
delete from public.queue_items target
using duplicate_pending_queue dup
where target.id = dup.id;

with ranked_release_queue as (
  select
    id,
    row_number() over (
      partition by user_id, release_id
      order by priority desc, bumped_at desc nulls last, added_at desc, id desc
    ) as rn
  from public.queue_items
  where user_id is not null
    and track_id is null
    and release_id is not null
    and status = 'pending'
),
duplicate_release_queue as (
  select id
  from ranked_release_queue
  where rn > 1
)
delete from public.queue_items target
using duplicate_release_queue dup
where target.id = dup.id;

drop index if exists public.queue_items_user_pending_track_video_uq;
drop index if exists public.queue_items_user_pending_release_video_uq;

create unique index if not exists queue_items_user_pending_track_uq
  on public.queue_items (user_id, track_id)
  where user_id is not null and track_id is not null and status = 'pending';

create unique index if not exists queue_items_user_pending_release_uq
  on public.queue_items (user_id, release_id)
  where user_id is not null and track_id is null and release_id is not null and status = 'pending';
