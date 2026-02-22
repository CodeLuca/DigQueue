create index if not exists queue_items_user_status_order_idx
  on public.queue_items (user_id, status, priority desc, bumped_at desc, id asc);

create index if not exists queue_items_user_status_track_idx
  on public.queue_items (user_id, status, track_id);

create index if not exists youtube_matches_user_track_choice_idx
  on public.youtube_matches (user_id, track_id, chosen desc, score desc, id asc);

create index if not exists labels_user_active_idx
  on public.labels (user_id, active);

create index if not exists releases_user_label_order_idx
  on public.releases (user_id, label_id, release_order, id);

create index if not exists tracks_user_release_state_idx
  on public.tracks (user_id, release_id, listened, saved, id);
