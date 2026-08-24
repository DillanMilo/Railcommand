-- Mobile photo uploads use short-lived signed upload tokens, but token creation
-- still passes through Storage RLS. Limit authorization to the signed-in
-- creator's own daily log and recheck the current editor role on every retry.

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('project-photos', 'project-photos', false, 26214400),
  ('thermal-photos', 'thermal-photos', false, 26214400)
on conflict (id) do nothing;

drop policy if exists "mobile_daily_log_photos_insert" on storage.objects;
create policy "mobile_daily_log_photos_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('project-photos', 'thermal-photos')
    and case
      when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/daily_log/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]+-.+$'
      then exists (
        select 1
        from public.daily_logs dl
        where dl.id = split_part(name, '/', 3)::uuid
          and dl.project_id = split_part(name, '/', 1)::uuid
          and dl.created_by = (select auth.uid())
      ) and (
        exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role = 'admin'
        )
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = split_part(name, '/', 1)::uuid
            and pm.profile_id = (select auth.uid())
            and pm.can_edit
            and pm.project_role in ('manager', 'superintendent', 'foreman', 'contractor')
        )
      )
      else false
    end
  );

drop policy if exists "mobile_daily_log_photos_select" on storage.objects;
create policy "mobile_daily_log_photos_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('project-photos', 'thermal-photos')
    and case
      when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/daily_log/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]+-.+$'
      then exists (
        select 1
        from public.daily_logs dl
        where dl.id = split_part(name, '/', 3)::uuid
          and dl.project_id = split_part(name, '/', 1)::uuid
          and dl.created_by = (select auth.uid())
      ) and (
        exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role = 'admin'
        )
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = split_part(name, '/', 1)::uuid
            and pm.profile_id = (select auth.uid())
            and pm.can_edit
            and pm.project_role in ('manager', 'superintendent', 'foreman', 'contractor')
        )
      )
      else false
    end
  );

drop policy if exists "mobile_daily_log_photos_update" on storage.objects;
create policy "mobile_daily_log_photos_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('project-photos', 'thermal-photos')
    and case
      when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/daily_log/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]+-.+$'
      then exists (
        select 1
        from public.daily_logs dl
        where dl.id = split_part(name, '/', 3)::uuid
          and dl.project_id = split_part(name, '/', 1)::uuid
          and dl.created_by = (select auth.uid())
      ) and (
        exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role = 'admin'
        )
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = split_part(name, '/', 1)::uuid
            and pm.profile_id = (select auth.uid())
            and pm.can_edit
            and pm.project_role in ('manager', 'superintendent', 'foreman', 'contractor')
        )
      )
      else false
    end
  )
  with check (
    bucket_id in ('project-photos', 'thermal-photos')
    and case
      when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/daily_log/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]+-.+$'
      then exists (
        select 1
        from public.daily_logs dl
        where dl.id = split_part(name, '/', 3)::uuid
          and dl.project_id = split_part(name, '/', 1)::uuid
          and dl.created_by = (select auth.uid())
      ) and (
        exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role = 'admin'
        )
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = split_part(name, '/', 1)::uuid
            and pm.profile_id = (select auth.uid())
            and pm.can_edit
            and pm.project_role in ('manager', 'superintendent', 'foreman', 'contractor')
        )
      )
      else false
    end
  );
