-- Multiple independently owned logs per project/date. No record UPDATE/DELETE.
-- Retain author/idempotency uniqueness, primary keys, RLS, grants and photo RPC.
-- Older clients still receive a conflict for additional same-day work.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create index if not exists idx_daily_logs_project_date
  on public.daily_logs(project_id, log_date);
alter table public.daily_logs
  drop constraint if exists daily_logs_project_id_log_date_key;

CREATE OR REPLACE FUNCTION public.sync_daily_log_create(p_project_id uuid, p_client_id uuid, p_idempotency_key text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

  -- Authorization is re-evaluated on every retry. A role label alone is not
  -- enough: non-admin project members must still have can_edit=true.
  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_user_id and profile.role = 'admin'
  ) and not exists (
    select 1 from public.project_members member
    where member.project_id = p_project_id
      and member.profile_id = v_user_id
      and member.can_edit
      and member.project_role in ('manager', 'superintendent', 'foreman', 'contractor')
  ) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || trim(p_idempotency_key), 0)
  );

  select * into v_existing
  from public.daily_logs log
  where log.created_by = v_user_id
    and log.idempotency_key = trim(p_idempotency_key)
  limit 1;

  if found then
    if v_existing.id <> p_client_id or v_existing.project_id <> p_project_id then
      raise exception 'Idempotency key was already used for another operation'
        using errcode = '23505';
    end if;
    v_log := v_existing;
    v_duplicate := true;
  else
    -- Keep old outboxes safe: an additional same-day record needs explicit review.
    -- Serialize the check for concurrent mobile submissions of the same day.
    perform pg_advisory_xact_lock(hashtextextended(
      'daily-log-day:' || p_project_id::text || ':' || (p_payload->>'log_date')::date::text, 0
    ));
    if exists (select 1 from public.daily_logs existing
      where existing.project_id = p_project_id
        and existing.log_date = (p_payload->>'log_date')::date)
      and coalesce(p_payload->'allow_same_day', 'false'::jsonb) <> 'true'::jsonb then
      raise exception 'RC_DAILY_LOG_SAME_DAY_CONFIRMATION daily_logs_project_id_log_date_key'
        using errcode = '23505';
    end if;
    insert into public.daily_logs (
      id, project_id, log_date, created_by, weather_temp,
      weather_conditions, weather_wind, work_summary, safety_notes,
      geo_tag, idempotency_key
    ) values (
      p_client_id, p_project_id, (p_payload->>'log_date')::date, v_user_id,
      coalesce((p_payload->>'weather_temp')::numeric, 0),
      left(coalesce(p_payload->>'weather_conditions', ''), 200),
      left(coalesce(p_payload->>'weather_wind', ''), 200),
      left(coalesce(p_payload->>'work_summary', ''), 20000),
      left(coalesce(p_payload->>'safety_notes', ''), 20000),
      p_payload->'geo_tag', trim(p_idempotency_key)
    ) returning * into v_log;

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
  end if;

  return jsonb_build_object(
    'id', v_log.id,
    'project_id', v_log.project_id,
    'created_by', v_log.created_by,
    'idempotency_key', v_log.idempotency_key,
    'duplicate', v_duplicate
  );
end;
$function$;

commit;
