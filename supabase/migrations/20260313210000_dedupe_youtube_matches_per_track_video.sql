with ranked_track_video_matches as (
  select
    id,
    row_number() over (
      partition by user_id, track_id, video_id
      order by chosen desc, embeddable desc, score desc, fetched_at desc, id desc
    ) as rn
  from public.youtube_matches
  where user_id is not null
),
duplicate_track_video_matches as (
  select id
  from ranked_track_video_matches
  where rn > 1
)
delete from public.youtube_matches target
using duplicate_track_video_matches dup
where target.id = dup.id;

with ranked_chosen_matches as (
  select
    id,
    track_id,
    user_id,
    row_number() over (
      partition by user_id, track_id
      order by chosen desc, embeddable desc, score desc, fetched_at desc, id desc
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

create unique index if not exists youtube_matches_user_track_video_uq
  on public.youtube_matches (user_id, track_id, video_id)
  where user_id is not null;
