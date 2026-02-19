create or replace function public.reset_identity_sequences()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform setval(pg_get_serial_sequence('public.tracks', 'id'), coalesce((select max(id) from public.tracks), 1), true);
  perform setval(pg_get_serial_sequence('public.youtube_matches', 'id'), coalesce((select max(id) from public.youtube_matches), 1), true);
  perform setval(pg_get_serial_sequence('public.queue_items', 'id'), coalesce((select max(id) from public.queue_items), 1), true);
  perform setval(pg_get_serial_sequence('public.feedback_events', 'id'), coalesce((select max(id) from public.feedback_events), 1), true);
  perform setval(pg_get_serial_sequence('public.__drizzle_migrations', 'id'), coalesce((select max(id) from public.__drizzle_migrations), 1), true);
end;
$$;
