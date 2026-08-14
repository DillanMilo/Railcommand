alter table public.daily_logs
  add column if not exists idempotency_key text;

create unique index if not exists daily_logs_created_by_idempotency_key_uidx
  on public.daily_logs (created_by, idempotency_key)
  where idempotency_key is not null;

comment on column public.daily_logs.idempotency_key is
  'Client-generated key used to make offline daily-log creation idempotent per user.';

drop policy if exists "Project editors can create daily_logs" on public.daily_logs;
create policy "Authorized users can create daily_logs"
on public.daily_logs
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = daily_logs.project_id
        and pm.profile_id = (select auth.uid())
        and pm.project_role in ('manager', 'superintendent', 'foreman', 'contractor')
    )
  )
);

create or replace function public.sync_daily_log_create(
  p_project_id uuid,
  p_client_id uuid,
  p_idempotency_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.daily_logs%rowtype;
  v_log public.daily_logs%rowtype;
  v_duplicate boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_project_id is null or p_client_id is null then
    raise exception 'Project ID and client ID are required' using errcode = '22023';
  end if;

  if p_idempotency_key is null
     or length(trim(p_idempotency_key)) < 16
     or length(p_idempotency_key) > 200 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(coalesce(p_payload->'personnel', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_payload->'equipment', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_payload->'work_items', '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid daily-log payload' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_payload->'personnel', '[]'::jsonb)) > 100
     or jsonb_array_length(coalesce(p_payload->'equipment', '[]'::jsonb)) > 100
     or jsonb_array_length(coalesce(p_payload->'work_items', '[]'::jsonb)) > 200 then
    raise exception 'Daily-log payload exceeds row limits' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role = 'admin'
  ) and not exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.profile_id = v_user_id
      and pm.project_role in ('manager', 'superintendent', 'foreman', 'contractor')
  ) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || trim(p_idempotency_key), 0)
  );

  select *
  into v_existing
  from public.daily_logs dl
  where dl.created_by = v_user_id
    and dl.idempotency_key = trim(p_idempotency_key)
  limit 1;

  if found then
    if v_existing.id <> p_client_id or v_existing.project_id <> p_project_id then
      raise exception 'Idempotency key was already used for another operation'
        using errcode = '23505';
    end if;
    v_log := v_existing;
    v_duplicate := true;
  else
    insert into public.daily_logs (
      id, project_id, log_date, created_by, weather_temp, weather_conditions,
      weather_wind, work_summary, safety_notes, geo_tag, idempotency_key
    ) values (
      p_client_id, p_project_id, (p_payload->>'log_date')::date, v_user_id,
      coalesce((p_payload->>'weather_temp')::numeric, 0),
      left(coalesce(p_payload->>'weather_conditions', ''), 200),
      left(coalesce(p_payload->>'weather_wind', ''), 200),
      left(coalesce(p_payload->>'work_summary', ''), 20000),
      left(coalesce(p_payload->>'safety_notes', ''), 20000),
      p_payload->'geo_tag', trim(p_idempotency_key)
    )
    returning * into v_log;

    insert into public.daily_log_personnel (daily_log_id, role, headcount, company)
    select v_log.id, left(trim(item->>'role'), 200),
      greatest(coalesce((item->>'headcount')::integer, 0), 0),
      left(coalesce(item->>'company', ''), 300)
    from jsonb_array_elements(coalesce(p_payload->'personnel', '[]'::jsonb)) item
    where trim(coalesce(item->>'role', '')) <> '';

    insert into public.daily_log_equipment (daily_log_id, equipment_type, count, notes)
    select v_log.id, left(trim(item->>'equipment_type'), 300),
      greatest(coalesce((item->>'count')::integer, 0), 0),
      left(coalesce(item->>'notes', ''), 2000)
    from jsonb_array_elements(coalesce(p_payload->'equipment', '[]'::jsonb)) item
    where trim(coalesce(item->>'equipment_type', '')) <> '';

    insert into public.daily_log_work_items (daily_log_id, description, quantity, unit, location)
    select v_log.id, left(trim(item->>'description'), 2000),
      greatest(coalesce((item->>'quantity')::numeric, 0), 0),
      left(coalesce(item->>'unit', ''), 100),
      left(coalesce(item->>'location', ''), 500)
    from jsonb_array_elements(coalesce(p_payload->'work_items', '[]'::jsonb)) item
    where trim(coalesce(item->>'description', '')) <> '';

    insert into public.activity_log (
      project_id, entity_type, entity_id, action, description, performed_by
    ) values (
      p_project_id, 'daily_log', v_log.id, 'created',
      'synchronized offline daily log for ' || v_log.log_date::text, v_user_id
    );
  end if;

  return jsonb_build_object(
    'id', v_log.id,
    'project_id', v_log.project_id,
    'created_by', v_log.created_by,
    'idempotency_key', v_log.idempotency_key,
    'duplicate', v_duplicate
  );
end;
$$;

revoke all on function public.sync_daily_log_create(uuid, uuid, text, jsonb) from public;
revoke all on function public.sync_daily_log_create(uuid, uuid, text, jsonb) from anon;
grant execute on function public.sync_daily_log_create(uuid, uuid, text, jsonb) to authenticated;

comment on function public.sync_daily_log_create(uuid, uuid, text, jsonb) is
  'Atomically creates one offline daily log and its child rows after fresh auth and permission checks.';;
