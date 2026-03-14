with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by updated_at desc nulls last, id desc
    ) as rn
  from public.app_secrets
  where user_id is not null
)
delete from public.app_secrets target
using ranked
where target.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists app_secrets_user_id_uq
  on public.app_secrets (user_id)
  where user_id is not null;
