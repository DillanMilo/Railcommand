-- Keep mobile invitation acceptance entirely inside the caller's RLS boundary.
-- The insert policy admits only the exact pending invitation addressed to the caller.

begin;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_invitations'
      and policyname = 'Mobile invitees can accept their pending invitations'
  ) then
    create policy "Mobile invitees can accept their pending invitations"
      on public.project_invitations for update to authenticated
      using (
        status = 'pending'
        and expires_at > now()
        and lower(email) = lower((select p.email from public.profiles p where p.id = (select auth.uid())))
      )
      with check (
        status = 'accepted'
        and lower(email) = lower((select p.email from public.profiles p where p.id = (select auth.uid())))
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_members'
      and policyname = 'Mobile invitees can add their invited membership'
  ) then
    create policy "Mobile invitees can add their invited membership"
      on public.project_members for insert to authenticated
      with check (
        profile_id = (select auth.uid())
        and exists (
          select 1
          from public.project_invitations invitation
          where invitation.project_id = project_members.project_id
            and invitation.project_role = project_members.project_role
            and invitation.status = 'pending'
            and invitation.expires_at > now()
            and lower(invitation.email) = lower((
              select profile.email
              from public.profiles profile
              where profile.id = (select auth.uid())
            ))
            and project_members.can_edit = (
              invitation.project_role in ('manager', 'superintendent', 'foreman', 'engineer')
            )
        )
      );
  end if;
end;
$$;

grant update(status) on public.project_invitations to authenticated;
grant insert(project_id, profile_id, project_role, can_edit)
  on public.project_members to authenticated;

create or replace function public.accept_mobile_project_invitation(p_token text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_invitation public.project_invitations%rowtype;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select lower(email) into v_user_email from public.profiles where id = v_user_id;
  select * into v_invitation from public.project_invitations
    where token = p_token and lower(email) = v_user_email and status = 'pending' and expires_at > now()
    for update;
  if not found then raise exception 'invitation not found, expired, or already used' using errcode = 'P0002'; end if;

  insert into public.project_members(project_id, profile_id, project_role, can_edit)
  values (
    v_invitation.project_id,
    v_user_id,
    v_invitation.project_role,
    v_invitation.project_role in ('manager', 'superintendent', 'foreman', 'engineer')
  ) on conflict (project_id, profile_id) do nothing;

  update public.project_invitations set status = 'accepted' where id = v_invitation.id;
  return v_invitation.project_id;
end;
$$;

revoke all on function public.accept_mobile_project_invitation(text) from public, anon;
grant execute on function public.accept_mobile_project_invitation(text) to authenticated;

notify pgrst, 'reload schema';

commit;
