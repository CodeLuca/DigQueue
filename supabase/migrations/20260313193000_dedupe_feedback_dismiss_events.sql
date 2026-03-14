alter table public.feedback_events
  add column if not exists external_discogs_release_id bigint;

with ranked_track_dismisses as (
  select
    id,
    row_number() over (
      partition by user_id, event_type, track_id
      order by created_at desc, id desc
    ) as rn
  from public.feedback_events
  where user_id is not null
    and event_type = 'dismiss'
    and track_id is not null
),
duplicate_track_dismisses as (
  select id
  from ranked_track_dismisses
  where rn > 1
)
delete from public.feedback_events target
using duplicate_track_dismisses dup
where target.id = dup.id;

with ranked_release_dismisses as (
  select
    id,
    row_number() over (
      partition by user_id, event_type, release_id
      order by created_at desc, id desc
    ) as rn
  from public.feedback_events
  where user_id is not null
    and event_type = 'dismiss'
    and track_id is null
    and release_id is not null
),
duplicate_release_dismisses as (
  select id
  from ranked_release_dismisses
  where rn > 1
)
delete from public.feedback_events target
using duplicate_release_dismisses dup
where target.id = dup.id;

with ranked_external_release_dismisses as (
  select
    id,
    row_number() over (
      partition by user_id, event_type, external_discogs_release_id
      order by created_at desc, id desc
    ) as rn
  from public.feedback_events
  where user_id is not null
    and event_type = 'dismiss'
    and track_id is null
    and release_id is null
    and external_discogs_release_id is not null
),
duplicate_external_release_dismisses as (
  select id
  from ranked_external_release_dismisses
  where rn > 1
)
delete from public.feedback_events target
using duplicate_external_release_dismisses dup
where target.id = dup.id;

create unique index if not exists feedback_events_user_track_dismiss_uq
  on public.feedback_events (user_id, event_type, track_id)
  where user_id is not null and event_type = 'dismiss' and track_id is not null;

create unique index if not exists feedback_events_user_release_dismiss_uq
  on public.feedback_events (user_id, event_type, release_id)
  where user_id is not null and event_type = 'dismiss' and track_id is null and release_id is not null;

create unique index if not exists feedback_events_user_external_release_dismiss_uq
  on public.feedback_events (user_id, event_type, external_discogs_release_id)
  where user_id is not null and event_type = 'dismiss' and track_id is null and release_id is null and external_discogs_release_id is not null;
