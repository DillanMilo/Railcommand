-- STAGING ONLY. Requires an explicit transaction-local target acknowledgement.
-- No row writes, deletes, role changes, or production authorization.
-- Database operation: online-only; offline drafts/outbox are untouched.
do $preflight$
declare item record; actual text;
begin
 if current_setting('railcommand.target_project',true) is distinct from 'rxuvchdqbzvovqijvfhx'
 then raise exception 'Explicit staging target acknowledgement required'; end if;
 if to_regnamespace('mobile_staging') is null then raise exception 'Staging schema missing'; end if;
 if to_regprocedure('railcommand_guard.can_upload_object(text,text)') is not null
 or to_regprocedure('railcommand_guard.can_read_object(text,text)') is not null
 then raise exception 'Candidate helpers already exist; inspect before retrying'; end if;
 for item in select * from (values
 ('railcommand_guard.can_write_daily_log(uuid)','f0bdc0e727ff3b485f3b9d9a45f92e61'),
 ('railcommand_guard.can_write_object(text,text)','d03e0b8ad60e1d56432a53c7fdf56a0b'),
 ('railcommand_guard.is_project_member(uuid)','4b0e559dc6e0e5df057cd62eb33c4f39')
 ) as expected(signature,hash) loop
 select md5(pg_get_functiondef(to_regprocedure(item.signature))) into actual;
 if actual is distinct from item.hash then raise exception 'Guard definition drift; stop'; end if;
 end loop;
 for item in select * from (values
 ('rc_project_object_delete_guard','09a6a84158fcdab80f7ea3ce867a1c41'),
 ('rc_project_object_insert_guard','e4f7fc357433f422ac7d3d5da72fcda0'),
 ('rc_project_object_read_guard','43a66fafe93825032087c86506b37228'),
 ('rc_project_object_update_guard','492d4fdfb6e43720543ace750a93df5a')
 ) as expected(name,hash) loop
 select md5(coalesce(qual,'')||'|'||coalesce(with_check,'')) into actual
 from pg_policies where schemaname='storage' and tablename='objects'
 and policyname=item.name and permissive='RESTRICTIVE' and roles=array['authenticated']::name[];
 if actual is distinct from item.hash then raise exception 'Storage policy drift; stop'; end if;
 end loop;
end $preflight$;

-- LOCAL REVIEW CANDIDATE ONLY. Not an approved hosted migration.
-- Preserve the existing sync_daily_log_create administrator exception.
-- Do not change membership/read helpers, Storage policies, grants, or roles.
create or replace function railcommand_guard.can_write_daily_log(p_project uuid)
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null and p_project is not null and (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = p_project
        and pm.profile_id = (select auth.uid())
        and pm.can_edit
        and pm.project_role in ('manager','superintendent','foreman','contractor')
    )
  );
$$;
-- Local candidate, not a deployable migration. Preserve the existing
-- mobile_daily_log_photos policy exception ONLY for administrators' own logs
-- in the two photo buckets. Other entity/bucket permissions stay unchanged.
-- Separate upload helper: the existing write helper also controls DELETE.
-- Never wire this exception into DELETE or general project membership.
create or replace function railcommand_guard.can_upload_object(p_bucket text,p_name text)
returns boolean language plpgsql stable security invoker set search_path=''
as $$
declare v_project uuid:=railcommand_guard.project_from_path(p_name);
begin
 if p_bucket not in ('project-photos','thermal-photos','project-documents') then return true; end if;
 if v_project is null then return false; end if;
 if p_bucket in ('project-photos','thermal-photos')
   and split_part(p_name,'/',2)='daily_log'
   and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
   and exists(select 1 from public.daily_logs dl where dl.id=split_part(p_name,'/',3)::uuid
     and dl.project_id=v_project and dl.created_by=(select auth.uid())) then
   return true;
 end if;
 return railcommand_guard.can_write_object(p_bucket,p_name);
end $$;
-- Local candidate only. Read exception matches existing own-photo policy.
create or replace function railcommand_guard.can_read_object(p_bucket text,p_name text)
returns boolean language sql stable security invoker set search_path=''
as $$
 select p_bucket not in ('project-photos','thermal-photos','project-documents')
 or (
  not storage.allow_any_operation(array['object.move','object.copy','s3.object.copy','s3.upload.part_copy'])
  and (
   railcommand_guard.is_project_member(railcommand_guard.project_from_path(p_name))
   or (
    p_bucket in ('project-photos','thermal-photos')
    and railcommand_guard.project_from_path(p_name) is not null
    and split_part(p_name,'/',2)='daily_log'
    and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
    and exists(select 1 from public.daily_logs dl
      where dl.id::text=split_part(p_name,'/',3)
        and dl.project_id=railcommand_guard.project_from_path(p_name)
        and dl.created_by=(select auth.uid()))
   )
  )
 );
$$;

-- New functions receive no PUBLIC/anonymous execute grants.
revoke all on function railcommand_guard.can_upload_object(text,text) from public,anon;
revoke all on function railcommand_guard.can_read_object(text,text) from public,anon;
grant execute on function railcommand_guard.can_upload_object(text,text) to authenticated;
grant execute on function railcommand_guard.can_read_object(text,text) to authenticated;

alter policy rc_project_object_insert_guard on storage.objects
 with check (railcommand_guard.can_upload_object(bucket_id,name));
alter policy rc_project_object_read_guard on storage.objects
 using (railcommand_guard.can_read_object(bucket_id,name));
alter policy rc_project_object_update_guard on storage.objects
 using (railcommand_guard.can_upload_object(bucket_id,name) and
 (bucket_id not in ('project-photos','thermal-photos','project-documents')
 or (select storage.allow_any_operation(array['object.upload','object.upload_update','object.sign_upload_url']))))
 with check (railcommand_guard.can_upload_object(bucket_id,name) and
 (bucket_id not in ('project-photos','thermal-photos','project-documents')
 or (select storage.allow_any_operation(array['object.upload','object.upload_update','object.sign_upload_url']))));
-- Intentionally no change to rc_project_object_delete_guard or project membership.
