alter table public.attachments
  add column if not exists idempotency_key text;

create unique index if not exists attachments_uploaded_by_idempotency_key_uidx
  on public.attachments (uploaded_by, idempotency_key)
  where idempotency_key is not null;

comment on column public.attachments.idempotency_key is
  'Client-generated key used to make offline attachment finalization idempotent per user.';

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
     or p_file_size <= 0
     or p_file_size > 26214400
     or length(coalesce(p_file_name, '')) = 0
     or length(p_file_name) > 500
     or length(coalesce(p_file_type, '')) = 0
     or length(p_file_type) > 200 then
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

  -- Recheck current identity, parent ownership, membership, and create
  -- permission on every finalization attempt.
  if not exists (
    select 1
    from public.daily_logs dl
    where dl.id = p_daily_log_id
      and dl.project_id = p_project_id
      and dl.created_by = v_user_id
  ) then
    raise exception 'Parent daily log is unavailable' using errcode = '23503';
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
  from public.attachments a
  where a.uploaded_by = v_user_id
    and a.idempotency_key = trim(p_idempotency_key)
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
      id,
      entity_type,
      entity_id,
      project_id,
      file_name,
      file_url,
      file_type,
      file_size,
      photo_category,
      uploaded_by,
      geo_lat,
      geo_lng,
      captured_at,
      idempotency_key
    ) values (
      p_attachment_id,
      'daily_log',
      p_daily_log_id,
      p_project_id,
      left(p_file_name, 500),
      '/storage/v1/object/public/' || p_bucket || '/' || p_storage_path,
      left(p_file_type, 200),
      p_file_size,
      p_photo_category,
      v_user_id,
      p_geo_lat,
      p_geo_lng,
      coalesce(p_captured_at, now()),
      trim(p_idempotency_key)
    )
    returning * into v_attachment;
  end if;

  return jsonb_build_object(
    'id', v_attachment.id,
    'duplicate', v_duplicate
  );
end;
$$;

revoke all on function public.sync_daily_log_photo_attachment(
  uuid, uuid, uuid, text, text, text, text, text, bigint, text,
  double precision, double precision, timestamptz
) from public;
revoke all on function public.sync_daily_log_photo_attachment(
  uuid, uuid, uuid, text, text, text, text, text, bigint, text,
  double precision, double precision, timestamptz
) from anon;
grant execute on function public.sync_daily_log_photo_attachment(
  uuid, uuid, uuid, text, text, text, text, text, bigint, text,
  double precision, double precision, timestamptz
) to authenticated;

comment on function public.sync_daily_log_photo_attachment(
  uuid, uuid, uuid, text, text, text, text, text, bigint, text,
  double precision, double precision, timestamptz
) is 'Idempotently records one uploaded offline daily-log photo after fresh identity, parent, and permission checks.';

notify pgrst, 'reload schema';
