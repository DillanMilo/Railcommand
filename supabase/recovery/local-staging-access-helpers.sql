-- Captured staging semantics for synthetic testing only, not new production functions.
create schema mobile_staging;
grant usage on schema mobile_staging to authenticated;
create function mobile_staging.can_access_project(p_project_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
or exists(select 1 from public.project_members pm where pm.project_id=p_project_id and pm.profile_id=(select auth.uid()));
$$;
create function mobile_staging.can_edit_project(p_project_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
or exists(select 1 from public.project_members pm where pm.project_id=p_project_id and pm.profile_id=(select auth.uid())
and pm.can_edit and pm.project_role in ('manager','superintendent','foreman','contractor'));
$$;
create function mobile_staging.can_view_shared_profile(p_profile_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
select (select auth.uid()) is not null and (p_profile_id=(select auth.uid())
or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
or exists(select 1 from public.project_members mine join public.project_members teammate on teammate.project_id=mine.project_id
where mine.profile_id=(select auth.uid()) and teammate.profile_id=p_profile_id));
$$;
