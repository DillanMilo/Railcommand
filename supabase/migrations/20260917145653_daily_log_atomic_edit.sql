-- Atomic, optimistic daily-log editing. No existing records are rewritten by deployment.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create or replace function public.update_daily_log_checked(p_project_id uuid, p_log_id uuid, p_expected jsonb, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_user_id uuid := auth.uid();
  v_log public.daily_logs%rowtype;
begin
  if v_user_id is null then raise exception 'Not authenticated' using errcode='28000'; end if;
  if jsonb_typeof(p_expected) is distinct from 'object' or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'Reload the daily log before editing' using errcode='22023';
  end if;
  if not exists(select 1 from public.profiles where id=v_user_id and role='admin')
     and not exists(select 1 from public.project_members where project_id=p_project_id and profile_id=v_user_id and can_edit and project_role in ('manager','superintendent','foreman','contractor')) then
    raise exception 'Permission denied' using errcode='42501';
  end if;
  select * into v_log from public.daily_logs where id=p_log_id and project_id=p_project_id for update;
  if not found or v_log.created_by <> v_user_id then raise exception 'You can only edit your own daily logs' using errcode='42501'; end if;
  perform 1 from public.daily_log_personnel where daily_log_id=p_log_id for update;
  perform 1 from public.daily_log_equipment where daily_log_id=p_log_id for update;
  perform 1 from public.daily_log_work_items where daily_log_id=p_log_id for update;
  if jsonb_typeof(p_payload->'personnel') is distinct from 'array'
     or jsonb_typeof(p_payload->'equipment') is distinct from 'array'
     or jsonb_typeof(p_payload->'work_items') is distinct from 'array'
     or jsonb_typeof(p_expected->'personnel') is distinct from 'array'
     or jsonb_typeof(p_expected->'equipment') is distinct from 'array'
     or jsonb_typeof(p_expected->'work_items') is distinct from 'array' then raise exception 'Invalid daily-log rows' using errcode='22023'; end if;
  if jsonb_array_length(p_payload->'personnel')>100 or jsonb_array_length(p_payload->'equipment')>100 or jsonb_array_length(p_payload->'work_items')>200 then raise exception 'Daily-log payload exceeds row limits' using errcode='22023'; end if;
  if jsonb_build_object(
      'log_date', to_jsonb(v_log.log_date),
      'weather_temp', to_jsonb(v_log.weather_temp),
      'weather_conditions', to_jsonb(v_log.weather_conditions),
      'weather_wind', to_jsonb(v_log.weather_wind),
      'work_summary', to_jsonb(v_log.work_summary),
      'safety_notes', to_jsonb(v_log.safety_notes),
      'geo_tag', to_jsonb(v_log.geo_tag),
      'personnel', coalesce((select jsonb_agg(to_jsonb(row) order by row.id) from public.daily_log_personnel row where row.daily_log_id=p_log_id), '[]'::jsonb),
      'equipment', coalesce((select jsonb_agg(to_jsonb(row) order by row.id) from public.daily_log_equipment row where row.daily_log_id=p_log_id), '[]'::jsonb),
      'work_items', coalesce((select jsonb_agg(to_jsonb(row) order by row.id) from public.daily_log_work_items row where row.daily_log_id=p_log_id), '[]'::jsonb)
    ) is distinct from jsonb_build_object(
      'log_date', p_expected->'log_date',
      'weather_temp', p_expected->'weather_temp',
      'weather_conditions', p_expected->'weather_conditions',
      'weather_wind', p_expected->'weather_wind',
      'work_summary', p_expected->'work_summary',
      'safety_notes', p_expected->'safety_notes',
      'geo_tag', p_expected->'geo_tag',
      'personnel', coalesce((select jsonb_agg(value order by value->>'id') from jsonb_array_elements(p_expected->'personnel')), '[]'::jsonb),
      'equipment', coalesce((select jsonb_agg(value order by value->>'id') from jsonb_array_elements(p_expected->'equipment')), '[]'::jsonb),
      'work_items', coalesce((select jsonb_agg(value order by value->>'id') from jsonb_array_elements(p_expected->'work_items')), '[]'::jsonb)
    ) then
    raise exception 'RC_DAILY_LOG_EDIT_CONFLICT' using errcode='40001';
  end if;
  update public.daily_logs set
    log_date=(p_payload->>'log_date')::date,
    weather_temp=(p_payload->>'weather_temp')::numeric,
    weather_conditions=coalesce(p_payload->>'weather_conditions',''),
    weather_wind=coalesce(p_payload->>'weather_wind',''),
    work_summary=coalesce(p_payload->>'work_summary',''),
    safety_notes=coalesce(p_payload->>'safety_notes',''),
    geo_tag=nullif(p_payload->'geo_tag','null'::jsonb)
  where id=p_log_id and project_id=p_project_id and created_by=v_user_id;
  if not found then raise exception 'Permission denied' using errcode='42501'; end if;
  delete from public.daily_log_personnel where daily_log_id=p_log_id;
  delete from public.daily_log_equipment where daily_log_id=p_log_id;
  delete from public.daily_log_work_items where daily_log_id=p_log_id;
  if exists(select 1 from public.daily_log_personnel where daily_log_id=p_log_id)
     or exists(select 1 from public.daily_log_equipment where daily_log_id=p_log_id)
     or exists(select 1 from public.daily_log_work_items where daily_log_id=p_log_id) then raise exception 'Permission denied for daily-log rows' using errcode='42501'; end if;
    insert into public.daily_log_personnel (daily_log_id, role, headcount, company)
    select v_log.id, item->>'role',
      coalesce((item->>'headcount')::integer, 0),
      coalesce(item->>'company', '')
    from jsonb_array_elements(coalesce(p_payload->'personnel', '[]'::jsonb)) item
    where trim(coalesce(item->>'role', '')) <> '';

    insert into public.daily_log_equipment (daily_log_id, equipment_type, count, notes)
    select v_log.id, item->>'equipment_type',
      coalesce((item->>'count')::integer, 0),
      coalesce(item->>'notes', '')
    from jsonb_array_elements(coalesce(p_payload->'equipment', '[]'::jsonb)) item
    where trim(coalesce(item->>'equipment_type', '')) <> '';

    insert into public.daily_log_work_items (daily_log_id, description, quantity, unit, location)
    select v_log.id, item->>'description',
      coalesce((item->>'quantity')::numeric, 0),
      coalesce(item->>'unit', ''),
      coalesce(item->>'location', '')
    from jsonb_array_elements(coalesce(p_payload->'work_items', '[]'::jsonb)) item
    where trim(coalesce(item->>'description', '')) <> '';
  return jsonb_build_object('id',p_log_id,'project_id',p_project_id);
end;
$function$;
revoke all on function public.update_daily_log_checked(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.update_daily_log_checked(uuid,uuid,jsonb,jsonb) to authenticated;
commit;
