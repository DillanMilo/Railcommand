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
