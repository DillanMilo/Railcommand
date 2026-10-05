-- Production mobile write hardening.
--
-- This migration replaces only the two existing mobile synchronization RPCs,
-- adds narrow mobile-photo Storage policies without removing legacy web
-- policies, and fixes entity-number formatting beyond 999. It does not update
-- or delete customer records. Rollout remains separately gated by
-- MOBILE_PILOT_MODE.

begin;

-- Stop before changing functions or policies when the expected production
-- contract is missing. This is intentionally stricter than a repair script.
do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.profiles') is null then v_missing := array_append(v_missing, 'public.profiles'); end if;
  if to_regclass('public.project_members') is null then v_missing := array_append(v_missing, 'public.project_members'); end if;
  if to_regclass('public.daily_logs') is null then v_missing := array_append(v_missing, 'public.daily_logs'); end if;
  if to_regclass('public.daily_log_personnel') is null then v_missing := array_append(v_missing, 'public.daily_log_personnel'); end if;
  if to_regclass('public.daily_log_equipment') is null then v_missing := array_append(v_missing, 'public.daily_log_equipment'); end if;
  if to_regclass('public.daily_log_work_items') is null then v_missing := array_append(v_missing, 'public.daily_log_work_items'); end if;
  if to_regclass('public.attachments') is null then v_missing := array_append(v_missing, 'public.attachments'); end if;
  if to_regclass('public.entity_number_sequences') is null then v_missing := array_append(v_missing, 'public.entity_number_sequences'); end if;
  if to_regclass('storage.objects') is null then v_missing := array_append(v_missing, 'storage.objects'); end if;

  if cardinality(v_missing) > 0 then
    raise exception 'RC_MOBILE_WRITE_BASELINE_MISMATCH: missing required relations %', array_to_string(v_missing, ', ')
      using errcode = '55000';
  end if;

  if to_regprocedure('public.sync_daily_log_create(uuid,uuid,text,jsonb)') is null
     or to_regprocedure('public.sync_daily_log_photo_attachment(uuid,uuid,uuid,text,text,text,text,text,bigint,text,double precision,double precision,timestamp with time zone)') is null
     or to_regprocedure('public.assign_entity_number()') is null then
    raise exception 'RC_MOBILE_WRITE_BASELINE_MISMATCH: required functions are unavailable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'project_members' and column_name = 'can_edit'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'objects' and column_name = 'owner_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'objects' and column_name = 'metadata'
  ) then
    raise exception 'RC_MOBILE_WRITE_BASELINE_MISMATCH: required authorization columns are unavailable'
      using errcode = '55000';
  end if;
end;
$$;

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
$$;

create or replace function public.sync_daily_log_photo_attachment(
  p_attachment_id uuid,
  p_project_id uuid,
  p_daily_log_id uuid,
  p_idempotency_key text,
  p_bucket text,
  p_storage_path text,
  p_file_name text,
  p_file_type text,
  p_file_size bigint,
  p_photo_category text,
  p_geo_lat double precision default null,
  p_geo_lng double precision default null,
  p_captured_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.attachments%rowtype;
  v_attachment public.attachments%rowtype;
  v_expected_bucket text;
  v_object storage.objects%rowtype;
  v_actual_size bigint;
  v_actual_type text;
  v_duplicate boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_attachment_id is null or p_project_id is null or p_daily_log_id is null then
    raise exception 'Attachment, project, and daily log IDs are required' using errcode = '22023';
  end if;
  if p_idempotency_key is null
     or length(trim(p_idempotency_key)) < 16
     or length(p_idempotency_key) > 200 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
  if p_photo_category not in ('standard', 'thermal')
     or p_file_size <= 0 or p_file_size > 26214400
     or length(coalesce(p_file_name, '')) = 0 or length(p_file_name) > 500
     or length(coalesce(p_file_type, '')) = 0 or length(p_file_type) > 200 then
    raise exception 'Invalid photo metadata' using errcode = '22023';
  end if;

  v_expected_bucket := case
    when p_photo_category = 'thermal' then 'thermal-photos'
    else 'project-photos'
  end;
  if p_bucket <> v_expected_bucket
     or p_storage_path not like p_project_id::text || '/daily_log/' || p_daily_log_id::text || '/' || p_attachment_id::text || '-%' then
    raise exception 'Invalid photo storage destination' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.daily_logs log
    where log.id = p_daily_log_id
      and log.project_id = p_project_id
      and log.created_by = v_user_id
  ) then
    raise exception 'Parent daily log is unavailable' using errcode = '23503';
  end if;
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

  -- Storage is read here only. Uploads and mutations remain exclusively on the
  -- Storage API. Finalization refuses metadata that does not match the object.
  select * into v_object
  from storage.objects object
  where object.bucket_id = p_bucket
    and object.name = p_storage_path
  limit 1;
  if not found then
    raise exception 'Uploaded photo is unavailable' using errcode = 'P0002';
  end if;
  if v_object.owner_id is distinct from v_user_id::text then
    raise exception 'Uploaded photo owner mismatch' using errcode = '42501';
  end if;

  begin
    v_actual_size := nullif(v_object.metadata->>'size', '')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Uploaded photo size metadata is invalid' using errcode = '22023';
  end;
  v_actual_type := lower(coalesce(v_object.metadata->>'mimetype', ''));
  if v_actual_size is distinct from p_file_size
     or v_actual_type is distinct from lower(p_file_type) then
    raise exception 'Uploaded photo metadata mismatch' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || trim(p_idempotency_key), 0)
  );

  select * into v_existing
  from public.attachments attachment
  where attachment.uploaded_by = v_user_id
    and attachment.idempotency_key = trim(p_idempotency_key)
  limit 1;

  if found then
    if v_existing.id <> p_attachment_id
       or v_existing.project_id <> p_project_id
       or v_existing.entity_id <> p_daily_log_id then
      raise exception 'Idempotency key was already used for another photo'
        using errcode = '23505';
    end if;
    v_attachment := v_existing;
    v_duplicate := true;
  else
    insert into public.attachments (
      id, entity_type, entity_id, project_id, file_name, file_url,
      file_type, file_size, photo_category, uploaded_by, geo_lat,
      geo_lng, captured_at, idempotency_key
    ) values (
      p_attachment_id, 'daily_log', p_daily_log_id, p_project_id,
      left(p_file_name, 500),
      '/storage/v1/object/public/' || p_bucket || '/' || p_storage_path,
      left(p_file_type, 200), p_file_size, p_photo_category, v_user_id,
      p_geo_lat, p_geo_lng, coalesce(p_captured_at, now()),
      trim(p_idempotency_key)
    ) returning * into v_attachment;
  end if;

  return jsonb_build_object('id', v_attachment.id, 'duplicate', v_duplicate);
end;
$$;

-- Add narrow policies for the mobile daily-log object path. Legacy Storage
-- policies are deliberately retained until the web path inventory and a
-- separate regression pass prove that they can be tightened safely.
drop policy if exists "mobile_daily_log_photos_insert_hardened" on storage.objects;
create policy "mobile_daily_log_photos_insert_hardened"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('project-photos', 'thermal-photos')
    and owner_id = (select auth.uid())::text
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/daily_log/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-.+$'
    and exists (
      select 1 from public.daily_logs log
      where log.id = split_part(name, '/', 3)::uuid
        and log.project_id = split_part(name, '/', 1)::uuid
        and log.created_by = (select auth.uid())
    )
    and (
      exists (
        select 1 from public.profiles profile
        where profile.id = (select auth.uid()) and profile.role = 'admin'
      )
      or exists (
        select 1 from public.project_members member
        where member.project_id = split_part(name, '/', 1)::uuid
          and member.profile_id = (select auth.uid())
          and member.can_edit
          and member.project_role in ('manager', 'superintendent', 'foreman', 'contractor')
      )
    )
  );

drop policy if exists "mobile_daily_log_photos_select_hardened" on storage.objects;
create policy "mobile_daily_log_photos_select_hardened"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('project-photos', 'thermal-photos')
    and owner_id = (select auth.uid())::text
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/daily_log/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-.+$'
    and exists (
      select 1 from public.daily_logs log
      where log.id = split_part(name, '/', 3)::uuid
        and log.project_id = split_part(name, '/', 1)::uuid
        and log.created_by = (select auth.uid())
    )
  );

-- Preserve the original type mapping but never truncate the numeric suffix.
create or replace function public.assign_entity_number()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  _prefix text;
  _type text;
  _next int;
begin
  case tg_table_name
    when 'submittals'        then _prefix := 'SUB'; _type := 'submittal';
    when 'rfis'              then _prefix := 'RFI'; _type := 'rfi';
    when 'punch_list_items'  then _prefix := 'PL';  _type := 'punch_list';
    when 'project_documents' then _prefix := 'DOC'; _type := 'document';
    when 'qcqa_reports'      then _prefix := 'QC';  _type := 'qcqa';
    when 'safety_incidents'  then _prefix := 'SAF'; _type := 'safety';
    when 'change_orders'     then _prefix := 'CO';  _type := 'change_order';
    when 'modifications'     then _prefix := 'MOD'; _type := 'modification';
    when 'weekly_reports'    then _prefix := 'WR';  _type := 'weekly_report';
    else raise exception 'assign_entity_number: unsupported table %', tg_table_name;
  end case;

  insert into public.entity_number_sequences (project_id, entity_type, current_value)
  values (new.project_id, _type, 1)
  on conflict (project_id, entity_type)
  do update set current_value = public.entity_number_sequences.current_value + 1
  returning current_value into _next;

  new.number := _prefix || '-' || lpad(_next::text, greatest(3, length(_next::text)), '0');
  return new;
end;
$function$;

revoke all on function public.sync_daily_log_create(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_daily_log_create(uuid, uuid, text, jsonb)
  to authenticated;

revoke all on function public.sync_daily_log_photo_attachment(
  uuid, uuid, uuid, text, text, text, text, text, bigint, text,
  double precision, double precision, timestamptz
) from public, anon, authenticated;
grant execute on function public.sync_daily_log_photo_attachment(
  uuid, uuid, uuid, text, text, text, text, text, bigint, text,
  double precision, double precision, timestamptz
) to authenticated;

comment on function public.sync_daily_log_create(uuid, uuid, text, jsonb) is
  'Idempotently creates an offline daily log after fresh auth, role, and can_edit checks.';
comment on function public.sync_daily_log_photo_attachment(
  uuid, uuid, uuid, text, text, text, text, text, bigint, text,
  double precision, double precision, timestamptz
) is 'Idempotently finalizes one mobile photo after object ownership, metadata, parent, and permission checks.';

notify pgrst, 'reload schema';

commit;
