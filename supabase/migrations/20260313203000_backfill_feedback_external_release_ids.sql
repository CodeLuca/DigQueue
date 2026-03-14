update public.feedback_events target
set external_discogs_release_id = matches.external_release_id
from (
  select
    feedback.id,
    substring(release.discogs_url from '/release/([0-9]+)')::bigint as external_release_id
  from public.feedback_events feedback
  join public.releases release on release.id = feedback.release_id
  where feedback.event_type = 'dismiss'
    and feedback.release_id is not null
    and feedback.external_discogs_release_id is null
    and release.discogs_url ~ '/release/[0-9]+'
) matches
where target.id = matches.id;

with ranked_dismiss_identity as (
  select
    id,
    row_number() over (
      partition by user_id, event_type, external_discogs_release_id
      order by
        (release_id is not null) desc,
        (label_id is not null) desc,
        created_at desc,
        id desc
    ) as rn
  from public.feedback_events
  where user_id is not null
    and event_type = 'dismiss'
    and external_discogs_release_id is not null
),
duplicate_dismiss_identity as (
  select id
  from ranked_dismiss_identity
  where rn > 1
)
delete from public.feedback_events target
using duplicate_dismiss_identity dup
where target.id = dup.id;
