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
