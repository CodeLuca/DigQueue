with ranked_pending_queue as (
  select
    id,
    row_number() over (
      partition by user_id, track_id, youtube_video_id
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
      partition by user_id, release_id, youtube_video_id
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

with ranked_chosen_matches as (
  select
    id,
    track_id,
    user_id,
    row_number() over (
      partition by user_id, track_id
      order by chosen desc, score desc, fetched_at desc, id desc
    ) as rn
  from public.youtube_matches
  where user_id is not null
),
match_choice_plan as (
  select
    id,
    case when rn = 1 then true else false end as keep_chosen
  from ranked_chosen_matches
)
update public.youtube_matches target
set chosen = plan.keep_chosen
from match_choice_plan plan
where target.id = plan.id
  and target.chosen is distinct from plan.keep_chosen;

create unique index if not exists queue_items_user_pending_track_video_uq
  on public.queue_items (user_id, track_id, youtube_video_id)
  where user_id is not null and track_id is not null and status = 'pending';

create unique index if not exists queue_items_user_pending_release_video_uq
  on public.queue_items (user_id, release_id, youtube_video_id)
  where user_id is not null and track_id is null and release_id is not null and status = 'pending';

create unique index if not exists youtube_matches_user_track_chosen_uq
  on public.youtube_matches (user_id, track_id)
  where user_id is not null and chosen = true;
