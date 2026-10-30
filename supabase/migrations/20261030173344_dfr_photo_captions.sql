-- Additive storage/API evolution. Retain the released v1 RPC and every old outbox.
-- V2 retains the September 3 can_edit, object-owner and metadata protections.
alter table public.attachments add column if not exists caption text;
alter table public.attachments add constraint attachments_caption_length check (char_length(caption) <= 500);
comment on column public.attachments.caption is 'Optional photo caption. DFRs display their report date when absent.';

create or replace function public.sync_daily_log_photo_attachment_v2(
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
  p_captured_at timestamptz default null,
  p_caption text default null
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

  if length(p_caption) > 500 then
    raise exception 'Photo caption exceeds 500 characters' using errcode = '22023';
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
       or v_existing.entity_id <> p_daily_log_id
       or v_existing.caption is distinct from nullif(trim(p_caption), '') then
      raise exception 'Idempotency key was already used for another photo'
        using errcode = '23505';
    end if;
    v_attachment := v_existing;
    v_duplicate := true;
  else
    insert into public.attachments (
      id, entity_type, entity_id, project_id, file_name, file_url,
      file_type, file_size, photo_category, uploaded_by, geo_lat,
      geo_lng, captured_at, idempotency_key, caption
    ) values (
      p_attachment_id, 'daily_log', p_daily_log_id, p_project_id,
      left(p_file_name, 500),
      '/storage/v1/object/public/' || p_bucket || '/' || p_storage_path,
      left(p_file_type, 200), p_file_size, p_photo_category, v_user_id,
      p_geo_lat, p_geo_lng, coalesce(p_captured_at, now()),
      trim(p_idempotency_key), nullif(trim(p_caption), '')
    ) returning * into v_attachment;
  end if;

  return jsonb_build_object('id', v_attachment.id, 'duplicate', v_duplicate);
end;
$$;

revoke all on function public.sync_daily_log_photo_attachment_v2(
  uuid, uuid, uuid, text, text, text, text, text, bigint, text,
  double precision, double precision, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.sync_daily_log_photo_attachment_v2(
  uuid, uuid, uuid, text, text, text, text, text, bigint, text,
  double precision, double precision, timestamptz, text
) to authenticated;
notify pgrst, 'reload schema';
