-- Disposable local PostgreSQL fixture only. Never run against field records.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, storage to authenticated, anon;
create table public.profiles(id uuid primary key, role text);
create table public.project_members(project_id uuid, profile_id uuid, project_role text, can_edit boolean);
create table public.daily_logs(id uuid primary key, project_id uuid, created_by uuid);
create table public.attachments(id uuid primary key, entity_type text, entity_id uuid, project_id uuid, file_name text, file_url text, file_type text, file_size bigint, photo_category text, uploaded_by uuid, geo_lat double precision, geo_lng double precision, captured_at timestamptz, idempotency_key text);
create unique index on public.attachments(uploaded_by,idempotency_key);
create table storage.objects(bucket_id text, name text, owner_id text, metadata jsonb);
grant select on public.profiles, public.project_members, public.daily_logs, storage.objects to authenticated;
grant select, insert on public.attachments to authenticated;
alter table public.attachments enable row level security;
create policy fixture_select on public.attachments for select to authenticated using (uploaded_by=auth.uid());
create policy fixture_insert on public.attachments for insert to authenticated with check (uploaded_by=auth.uid());
insert into profiles values ('10000000-0000-4000-8000-000000000001','contractor');
insert into project_members values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','contractor',true);
insert into daily_logs values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
insert into storage.objects select 'project-photos', '20000000-0000-4000-8000-000000000001/daily_log/30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-00000000000'||n||'-image.jpeg','10000000-0000-4000-8000-000000000001','{"size":100,"mimetype":"image/jpeg"}'::jsonb from generate_series(1,4)n;
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


revoke all on function public.sync_daily_log_photo_attachment(uuid,uuid,uuid,text,text,text,text,text,bigint,text,double precision,double precision,timestamptz) from public,anon;
grant execute on function public.sync_daily_log_photo_attachment(uuid,uuid,uuid,text,text,text,text,text,bigint,text,double precision,double precision,timestamptz) to authenticated;
create temporary table legacy_definition as select pg_get_functiondef('public.sync_daily_log_photo_attachment(uuid,uuid,uuid,text,text,text,text,text,bigint,text,double precision,double precision,timestamptz)'::regprocedure) definition;

\ir ../supabase/migrations/20261030173344_dfr_photo_captions.sql

create function pg_temp.assert(ok boolean, message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception '%',message; end if; end $$;
select pg_temp.assert((select definition from legacy_definition)=pg_get_functiondef('public.sync_daily_log_photo_attachment(uuid,uuid,uuid,text,text,text,text,text,bigint,text,double precision,double precision,timestamptz)'::regprocedure),'Legacy function changed');
select pg_temp.assert(not has_function_privilege('anon','public.sync_daily_log_photo_attachment_v2(uuid,uuid,uuid,text,text,text,text,text,bigint,text,double precision,double precision,timestamptz,text)','EXECUTE'),'Anon can invoke V2');
select pg_temp.assert(not (select prosecdef from pg_proc where proname='sync_daily_log_photo_attachment_v2'),'V2 bypasses RLS');
create function pg_temp.deliver(n integer, caption text, legacy boolean default false) returns jsonb language plpgsql as $$
declare aid uuid := ('40000000-0000-4000-8000-00000000000'||n)::uuid;
  path text := '20000000-0000-4000-8000-000000000001/daily_log/30000000-0000-4000-8000-000000000001/'||aid||'-image.jpeg';
begin
  if legacy then return public.sync_daily_log_photo_attachment(aid,'20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','daily-log-photo:'||aid,'project-photos',path,'image.jpeg','image/jpeg',100,'standard'); end if;
  return public.sync_daily_log_photo_attachment_v2(aid,'20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','daily-log-photo:'||aid,'project-photos',path,'image.jpeg','image/jpeg',100,'standard',p_caption=>caption);
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select pg_temp.assert(pg_temp.deliver(1,null,true)->>'duplicate'='false','Legacy insert failed');
select pg_temp.assert(pg_temp.deliver(1,null,true)->>'duplicate'='true','Legacy retry failed');
select pg_temp.assert(pg_temp.deliver(2,'  South entrance paving  ')->>'duplicate'='false','Caption insert failed');
select pg_temp.assert(pg_temp.deliver(2,'South entrance paving')->>'duplicate'='true','Caption retry failed');
select pg_temp.assert((select caption from attachments where id='40000000-0000-4000-8000-000000000002')='South entrance paving','Caption not retained');
do $$ begin perform pg_temp.deliver(2,'Changed caption'); raise exception 'Conflicting retry overwrote caption'; exception when unique_violation then null; end $$;
do $$ begin perform pg_temp.deliver(3,repeat('x',501)); raise exception 'Oversized caption accepted'; exception when invalid_parameter_value then null; end $$;
reset role;
update project_members set can_edit=false;
set role authenticated;
do $$ begin perform pg_temp.deliver(3,'No permission'); raise exception 'can_edit ignored'; exception when insufficient_privilege then null; end $$;
reset role;
update project_members set can_edit=true;
update storage.objects set owner_id='other' where name like '%0003-image.jpeg';
set role authenticated;
do $$ begin perform pg_temp.deliver(3,'Wrong owner'); raise exception 'Storage owner ignored'; exception when insufficient_privilege then null; end $$;
reset role;
update storage.objects set metadata='{"size":999,"mimetype":"image/jpeg"}' where name like '%0004-image.jpeg';
set role authenticated;
do $$ begin perform pg_temp.deliver(4,'Wrong metadata'); raise exception 'Storage metadata ignored'; exception when invalid_parameter_value then null; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000099',false);
do $$ begin perform pg_temp.deliver(3,'Wrong parent'); raise exception 'Parent ownership ignored'; exception when foreign_key_violation then null; end $$;
reset role;
select pg_temp.assert((select count(*) from attachments)=2,'Unexpected records created');
select pg_temp.assert((select file_name from attachments where caption is not null)='image.jpeg','Filename rewritten');
select 'PASS: legacy, caption, retry, conflict, length, permissions, owner, metadata, parent and RLS grants';
