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
