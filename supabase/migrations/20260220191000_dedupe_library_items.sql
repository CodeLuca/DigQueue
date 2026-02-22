-- Merge duplicate releases that represent the same Discogs release URL.
with ranked_releases as (
  select
    id,
    user_id,
    discogs_url,
    row_number() over (
      partition by user_id, discogs_url
      order by
        (id >= 1000000000) desc,
        details_fetched desc,
        (label_id <> -900001) desc,
        id desc
    ) as rn,
    first_value(id) over (
      partition by user_id, discogs_url
      order by
        (id >= 1000000000) desc,
        details_fetched desc,
        (label_id <> -900001) desc,
        id desc
    ) as keep_id
  from public.releases
  where user_id is not null
    and coalesce(discogs_url, '') <> ''
),
release_merge_map as (
  select id as old_id, keep_id
  from ranked_releases
  where rn > 1
),
release_flags as (
  select
    m.keep_id,
    bool_or(r.wishlist) as wishlist_any,
    bool_or(r.details_fetched) as details_fetched_any,
    bool_or(r.youtube_matched) as youtube_matched_any,
    bool_or(r.listened) as listened_any
  from release_merge_map m
  join public.releases r on r.id in (m.old_id, m.keep_id)
  group by m.keep_id
)
update public.releases r
set
  wishlist = f.wishlist_any,
  details_fetched = f.details_fetched_any,
  youtube_matched = f.youtube_matched_any,
  listened = f.listened_any
from release_flags f
where r.id = f.keep_id;

with ranked_releases as (
  select
    id,
    user_id,
    discogs_url,
    row_number() over (
      partition by user_id, discogs_url
      order by
        (id >= 1000000000) desc,
        details_fetched desc,
        (label_id <> -900001) desc,
        id desc
    ) as rn,
    first_value(id) over (
      partition by user_id, discogs_url
      order by
        (id >= 1000000000) desc,
        details_fetched desc,
        (label_id <> -900001) desc,
        id desc
    ) as keep_id
  from public.releases
  where user_id is not null
    and coalesce(discogs_url, '') <> ''
),
release_merge_map as (
  select id as old_id, keep_id
  from ranked_releases
  where rn > 1
)
update public.tracks t
set release_id = m.keep_id
from release_merge_map m
where t.release_id = m.old_id;

with ranked_releases as (
  select
    id,
    user_id,
    discogs_url,
    row_number() over (
      partition by user_id, discogs_url
      order by
        (id >= 1000000000) desc,
        details_fetched desc,
        (label_id <> -900001) desc,
        id desc
    ) as rn,
    first_value(id) over (
      partition by user_id, discogs_url
      order by
        (id >= 1000000000) desc,
        details_fetched desc,
        (label_id <> -900001) desc,
        id desc
    ) as keep_id
  from public.releases
  where user_id is not null
    and coalesce(discogs_url, '') <> ''
),
release_merge_map as (
  select id as old_id, keep_id
  from ranked_releases
  where rn > 1
)
update public.queue_items q
set release_id = m.keep_id
from release_merge_map m
where q.release_id = m.old_id;

with ranked_releases as (
  select
    id,
    user_id,
    discogs_url,
    row_number() over (
      partition by user_id, discogs_url
      order by
        (id >= 1000000000) desc,
        details_fetched desc,
        (label_id <> -900001) desc,
        id desc
    ) as rn,
    first_value(id) over (
      partition by user_id, discogs_url
      order by
        (id >= 1000000000) desc,
        details_fetched desc,
        (label_id <> -900001) desc,
        id desc
    ) as keep_id
  from public.releases
  where user_id is not null
    and coalesce(discogs_url, '') <> ''
),
release_merge_map as (
  select id as old_id, keep_id
  from ranked_releases
  where rn > 1
)
update public.feedback_events f
set release_id = m.keep_id
from release_merge_map m
where f.release_id = m.old_id;

with ranked_releases as (
  select
    id,
    user_id,
    discogs_url,
    row_number() over (
      partition by user_id, discogs_url
      order by
        (id >= 1000000000) desc,
        details_fetched desc,
        (label_id <> -900001) desc,
        id desc
    ) as rn,
    first_value(id) over (
      partition by user_id, discogs_url
      order by
        (id >= 1000000000) desc,
        details_fetched desc,
        (label_id <> -900001) desc,
        id desc
    ) as keep_id
  from public.releases
  where user_id is not null
    and coalesce(discogs_url, '') <> ''
),
release_merge_map as (
  select id as old_id, keep_id
  from ranked_releases
  where rn > 1
)
insert into public.release_signals (
  release_id,
  user_id,
  primary_artist,
  styles_text,
  genres_text,
  contributors_text,
  companies_text,
  format_text,
  country,
  year,
  updated_at
)
select
  m.keep_id,
  rs.user_id,
  rs.primary_artist,
  rs.styles_text,
  rs.genres_text,
  rs.contributors_text,
  rs.companies_text,
  rs.format_text,
  rs.country,
  rs.year,
  rs.updated_at
from release_merge_map m
join public.release_signals rs on rs.release_id = m.old_id
on conflict (release_id) do nothing;

with ranked_releases as (
  select
    id,
    user_id,
    discogs_url,
    row_number() over (
      partition by user_id, discogs_url
      order by
        (id >= 1000000000) desc,
        details_fetched desc,
        (label_id <> -900001) desc,
        id desc
    ) as rn
  from public.releases
  where user_id is not null
    and coalesce(discogs_url, '') <> ''
)
delete from public.releases r
using ranked_releases d
where r.id = d.id
  and d.rn > 1;

-- Deduplicate same logical track within a release.
with ranked_tracks as (
  select
    id,
    user_id,
    release_id,
    row_number() over (
      partition by user_id, release_id, coalesce(nullif(trim(position), ''), '__'), lower(trim(title))
      order by saved desc, listened desc, id asc
    ) as rn,
    first_value(id) over (
      partition by user_id, release_id, coalesce(nullif(trim(position), ''), '__'), lower(trim(title))
      order by saved desc, listened desc, id asc
    ) as keep_id
  from public.tracks
  where user_id is not null
),
track_merge_map as (
  select id as old_id, keep_id
  from ranked_tracks
  where rn > 1
),
track_flags as (
  select
    m.keep_id,
    bool_or(t.saved) as saved_any,
    bool_or(t.listened) as listened_any,
    bool_or(t.wishlist) as wishlist_any
  from track_merge_map m
  join public.tracks t on t.id in (m.old_id, m.keep_id)
  group by m.keep_id
)
update public.tracks t
set
  saved = f.saved_any,
  listened = f.listened_any,
  wishlist = f.wishlist_any
from track_flags f
where t.id = f.keep_id;

with ranked_tracks as (
  select
    id,
    user_id,
    release_id,
    row_number() over (
      partition by user_id, release_id, coalesce(nullif(trim(position), ''), '__'), lower(trim(title))
      order by saved desc, listened desc, id asc
    ) as rn,
    first_value(id) over (
      partition by user_id, release_id, coalesce(nullif(trim(position), ''), '__'), lower(trim(title))
      order by saved desc, listened desc, id asc
    ) as keep_id
  from public.tracks
  where user_id is not null
),
track_merge_map as (
  select id as old_id, keep_id
  from ranked_tracks
  where rn > 1
)
update public.queue_items q
set track_id = m.keep_id
from track_merge_map m
where q.track_id = m.old_id;

with ranked_tracks as (
  select
    id,
    user_id,
    release_id,
    row_number() over (
      partition by user_id, release_id, coalesce(nullif(trim(position), ''), '__'), lower(trim(title))
      order by saved desc, listened desc, id asc
    ) as rn,
    first_value(id) over (
      partition by user_id, release_id, coalesce(nullif(trim(position), ''), '__'), lower(trim(title))
      order by saved desc, listened desc, id asc
    ) as keep_id
  from public.tracks
  where user_id is not null
),
track_merge_map as (
  select id as old_id, keep_id
  from ranked_tracks
  where rn > 1
)
update public.youtube_matches y
set track_id = m.keep_id
from track_merge_map m
where y.track_id = m.old_id;

with ranked_tracks as (
  select
    id,
    user_id,
    release_id,
    row_number() over (
      partition by user_id, release_id, coalesce(nullif(trim(position), ''), '__'), lower(trim(title))
      order by saved desc, listened desc, id asc
    ) as rn,
    first_value(id) over (
      partition by user_id, release_id, coalesce(nullif(trim(position), ''), '__'), lower(trim(title))
      order by saved desc, listened desc, id asc
    ) as keep_id
  from public.tracks
  where user_id is not null
),
track_merge_map as (
  select id as old_id, keep_id
  from ranked_tracks
  where rn > 1
)
update public.feedback_events f
set track_id = m.keep_id
from track_merge_map m
where f.track_id = m.old_id;

with ranked_tracks as (
  select
    id,
    user_id,
    release_id,
    row_number() over (
      partition by user_id, release_id, coalesce(nullif(trim(position), ''), '__'), lower(trim(title))
      order by saved desc, listened desc, id asc
    ) as rn
  from public.tracks
  where user_id is not null
)
delete from public.tracks t
using ranked_tracks d
where t.id = d.id
  and d.rn > 1;

create unique index if not exists releases_user_discogs_url_uq
  on public.releases (user_id, discogs_url)
  where user_id is not null and coalesce(discogs_url, '') <> '';

create unique index if not exists tracks_user_release_pos_title_uq
  on public.tracks (
    user_id,
    release_id,
    (coalesce(nullif(trim(position), ''), '__')),
    (lower(trim(title)))
  )
  where user_id is not null;
