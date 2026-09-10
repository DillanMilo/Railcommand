-- Synthetic isolated database only, baseline permissive policies + candidate guard.
\set ON_ERROR_STOP on
begin;
create schema auth;
create schema storage;
create schema railcommand_guard;
create role authenticated nologin;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
-- Mock the Storage operation context only; real Storage HTTP acceptance remains required.
create function storage.allow_any_operation(operations text[]) returns boolean language sql stable
 as $$ select coalesce(current_setting('test.operation',true),'')=any(operations) $$;
create table public.profiles(id uuid,role text);
create table public.project_members(project_id uuid,profile_id uuid,can_edit boolean,project_role text);
create table public.daily_logs(id uuid,project_id uuid,created_by uuid);
alter table public.daily_logs add column log_date date, add column weather_temp numeric,
 add column weather_conditions text, add column weather_wind text, add column work_summary text,
 add column safety_notes text, add column geo_tag jsonb, add column idempotency_key text;
create unique index daily_log_retry_key on public.daily_logs(created_by,idempotency_key);
create table public.daily_log_personnel(daily_log_id uuid,role text,headcount integer,company text);
create table public.daily_log_equipment(daily_log_id uuid,equipment_type text,count integer,notes text);
create table public.daily_log_work_items(daily_log_id uuid,description text,quantity numeric,unit text,location text);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
create table storage.objects(bucket_id text,name text,metadata jsonb default '{"size":70,"mimetype":"image/png"}');
create table public.attachments(id uuid,project_id uuid,entity_type text,entity_id uuid,
 uploaded_by uuid,idempotency_key text,file_url text,file_size bigint,file_type text,photo_category text,notes text);
alter table public.attachments add column file_name text, add column geo_lat double precision,
 add column geo_lng double precision, add column captured_at timestamptz;
create unique index attachment_retry_key on public.attachments(uploaded_by,idempotency_key);
alter table storage.objects add column owner_id text default auth.uid()::text;
grant select,insert,update on public.attachments to authenticated;
grant insert on public.daily_logs to authenticated;
grant select,insert on public.daily_log_personnel,public.daily_log_equipment,public.daily_log_work_items to authenticated;
alter table storage.objects enable row level security;
grant usage on schema auth,storage,railcommand_guard to authenticated;
grant select on public.profiles,public.project_members,public.daily_logs to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
-- FUNCTIONS
-- RPC_FUNCTIONS
create trigger attachment_integrity before insert or update on public.attachments
 for each row execute function railcommand_guard.check_daily_log_attachment();
-- BASELINE_POLICIES
create policy candidate_write on storage.objects as restrictive for insert to authenticated
 with check(railcommand_guard.can_upload_object(bucket_id,name));
create policy candidate_read on storage.objects as restrictive for select to authenticated
 using(railcommand_guard.can_read_object(bucket_id,name));
create policy candidate_update on storage.objects as restrictive for update to authenticated
 using(railcommand_guard.can_upload_object(bucket_id,name) and storage.allow_any_operation(array['object.upload','object.upload_update','object.sign_upload_url']))
 with check(railcommand_guard.can_upload_object(bucket_id,name) and storage.allow_any_operation(array['object.upload','object.upload_update','object.sign_upload_url']));
-- Broad fixture-only permissive delete proves the unchanged restrictive guard denies it.
create policy fixture_delete on storage.objects for delete to authenticated using(true);
create policy candidate_delete on storage.objects as restrictive for delete to authenticated
 using(railcommand_guard.can_write_object(bucket_id,name));
insert into public.profiles values('10000000-0000-4000-8000-000000000001','admin');
insert into public.daily_logs(id,project_id,created_by) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('test.uid','10000000-0000-4000-8000-000000000001',true);
do $$
declare path text:='20000000-0000-4000-8000-000000000001/daily_log/30000000-0000-4000-8000-000000000001/40000000-photo.png'; n integer:=0; affected integer; op text;
begin
 if railcommand_guard.can_write_object('project-photos',path) then raise exception 'Existing delete guard broadened'; end if;
 insert into storage.objects values('project-photos',path),('thermal-photos',path);
 begin insert into storage.objects values('project-photos',replace(path,'30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002'));
 exception when insufficient_privilege then n:=n+1; end;
 begin insert into storage.objects values('project-documents',path);
 exception when insufficient_privilege then n:=n+1; end;
 begin insert into storage.objects values('project-photos',replace(path,'daily_log','rfi'));
 exception when insufficient_privilege then n:=n+1; end;
 begin insert into storage.objects values('project-photos',replace(path,'40000000-photo.png','..'));
 exception when insufficient_privilege then n:=n+1; end;
 if n<>4 then raise exception 'Expected four rejected writes, got %',n; end if;
 if (select count(*) from storage.objects)<>2 then raise exception 'Own photo readback failed'; end if;
 perform set_config('test.operation','object.upload_update',true);
 update storage.objects set name=name;
 get diagnostics affected=row_count;
 if affected<>2 then raise exception 'Allowed upload update failed'; end if;
 foreach op in array array['object.move','object.copy','s3.object.copy','s3.upload.part_copy'] loop
  perform set_config('test.operation',op,true);
  if exists(select 1 from storage.objects) then raise exception 'Copy/move read allowed'; end if;
  update storage.objects set name=name;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Copy/move update allowed'; end if;
 end loop;
 perform set_config('test.operation','',true);
 update storage.objects set name=name;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Unspecified update operation allowed'; end if;
 delete from storage.objects;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Administrator deletion widened'; end if;
 if (select count(*) from storage.objects)<>2 then raise exception 'Stored fixture changed'; end if;
 insert into public.attachments(id,project_id,entity_type,entity_id,uploaded_by,idempotency_key,file_url,file_size,file_type,photo_category,notes) values('40000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-000000000001','daily_log','30000000-0000-4000-8000-000000000001',
 auth.uid(),'synthetic-attachment-key','/storage/v1/object/public/project-photos/'||path,70,'image/png','standard','original');
 update public.attachments set notes='allowed note edit';
 n:=0;
 begin update public.attachments set entity_id='30000000-0000-4000-8000-000000000002';
 exception when sqlstate '22023' then n:=n+1; end;
 begin update public.attachments set project_id='20000000-0000-4000-8000-000000000002';
 exception when sqlstate '22023' then n:=n+1; end;
 begin update public.attachments set file_size=71;
 exception when sqlstate '22023' then n:=n+1; end;
 begin update public.attachments set uploaded_by='10000000-0000-4000-8000-000000000002';
 exception when sqlstate '22023' then n:=n+1; end;
 begin
  insert into public.attachments(id,project_id,entity_type,entity_id,uploaded_by,idempotency_key,file_url,file_size,file_type,photo_category,notes) select '40000000-0000-4000-8000-000000000002',project_id,entity_type,entity_id,
   uploaded_by,'different-key',file_url,71,file_type,photo_category,notes from public.attachments;
 exception when sqlstate '22023' then n:=n+1; end;
 if n<>5 then raise exception 'Expected five attachment rejections, got %',n; end if;
 if (select count(*) from public.attachments)<>1 then raise exception 'Rejected attachment retained'; end if;
 if not exists(select 1 from public.attachments where notes='allowed note edit' and file_size=70
   and entity_id='30000000-0000-4000-8000-000000000001') then raise exception 'Attachment changed unexpectedly'; end if;
 raise notice 'PASS attachment finalization and note edit; five reassignment/metadata attempts rejected';
 raise notice 'PASS own standard/thermal upload/readback; other owner, document, RFI and traversal denied';
end $$;
do $$
declare p uuid:='20000000-0000-4000-8000-000000000001';
 log_id uuid:='30000000-0000-4000-8000-000000000003';
 photo_id uuid:='40000000-0000-4000-8000-000000000003'; result jsonb; path text; rejected boolean:=false;
 payload jsonb:='{"log_date":"2026-09-09","personnel":[{"role":"test","headcount":1}],"equipment":[{"equipment_type":"test","count":1}],"work_items":[{"description":"test","quantity":1}]}';
begin
 result:=public.sync_daily_log_create(p,log_id,'synthetic-rpc-log-key',payload);
 if result->>'duplicate'<>'false' then raise exception 'First log incorrectly duplicate'; end if;
 result:=public.sync_daily_log_create(p,log_id,'synthetic-rpc-log-key',payload);
 if result->>'duplicate'<>'true' then raise exception 'Log replay not recognized'; end if;
 if (select count(*) from public.daily_logs where id=log_id)<>1
 or (select count(*) from public.daily_log_personnel where daily_log_id=log_id)<>1
 or (select count(*) from public.daily_log_equipment where daily_log_id=log_id)<>1
 or (select count(*) from public.daily_log_work_items where daily_log_id=log_id)<>1 then raise exception 'Log or child replay duplicated'; end if;
 path:=p||'/daily_log/'||log_id||'/'||photo_id||'-photo.png';
 insert into storage.objects(bucket_id,name) values('project-photos',path);
 result:=public.sync_daily_log_photo_attachment(photo_id,p,log_id,'synthetic-rpc-photo-key','project-photos',path,'photo.png','image/png',70,'standard');
 if result->>'duplicate'<>'false' then raise exception 'First photo incorrectly duplicate'; end if;
 result:=public.sync_daily_log_photo_attachment(photo_id,p,log_id,'synthetic-rpc-photo-key','project-photos',path,'photo.png','image/png',70,'standard');
 if result->>'duplicate'<>'true' or (select count(*) from public.attachments where id=photo_id)<>1 then raise exception 'Photo replay duplicated'; end if;
 begin
 perform public.sync_daily_log_create(p,'30000000-0000-4000-8000-000000000004','synthetic-rpc-log-key',payload);
 exception when unique_violation then rejected:=true; end;
 if not rejected then raise exception 'Retry-key collision accepted'; end if;
 raise notice 'PASS full recovered log/photo RPC flow, child counts, replay and key collision with candidate Storage/attachment guards';
end $$;
reset role;
rollback;
