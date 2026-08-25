-- Phase 3 mobile device registrations and request-only account deletion workflow.
-- This migration is additive. It does not alter or delete existing customer records.

begin;

-- Some isolated mobile environments contain only the Phase 1–2 synthetic field
-- schema. Establish the invitation table when it is absent while leaving the full
-- web schema unchanged when the table already exists.
create table if not exists public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  project_role text not null check (project_role in (
    'manager', 'superintendent', 'foreman', 'engineer', 'contractor',
    'inspector', 'owner', 'viewer'
  )),
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists project_invitations_project_id_idx
  on public.project_invitations(project_id);
create index if not exists project_invitations_email_idx
  on public.project_invitations(email);
create unique index if not exists project_invitations_unique_pending
  on public.project_invitations(project_id, lower(email))
  where status = 'pending';

alter table public.project_invitations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_invitations'
      and policyname = 'Mobile invitees can read their pending invitations'
  ) then
    create policy "Mobile invitees can read their pending invitations"
      on public.project_invitations for select to authenticated
      using (
        status = 'pending'
        and expires_at > now()
        and lower(email) = lower((select p.email from public.profiles p where p.id = (select auth.uid())))
      );
  end if;
end;
$$;

revoke all on public.project_invitations from anon;
grant select on public.project_invitations to authenticated;

create table if not exists public.mobile_device_registrations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  app_profile text not null check (app_profile in ('development', 'staging', 'production')),
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  unique (profile_id, expo_push_token, app_profile)
);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_request_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'completed', 'canceled')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '30 days'),
  completed_at timestamptz,
  unique (profile_id, client_request_id)
);

create unique index if not exists account_deletion_requests_one_active_per_profile
  on public.account_deletion_requests(profile_id)
  where status in ('pending', 'reviewing');

alter table public.mobile_device_registrations enable row level security;
alter table public.account_deletion_requests enable row level security;

create policy "Users can read their mobile device registrations"
  on public.mobile_device_registrations for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "Users can register their own mobile devices"
  on public.mobile_device_registrations for insert to authenticated
  with check (profile_id = (select auth.uid()));

create policy "Users can update their own mobile device registrations"
  on public.mobile_device_registrations for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "Users can read their account deletion requests"
  on public.account_deletion_requests for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "Users can create their own account deletion request"
  on public.account_deletion_requests for insert to authenticated
  with check (profile_id = (select auth.uid()) and status = 'pending');

revoke all on public.mobile_device_registrations from anon;
revoke all on public.account_deletion_requests from anon;
grant select, insert, update on public.mobile_device_registrations to authenticated;
grant select, insert on public.account_deletion_requests to authenticated;

comment on table public.account_deletion_requests is
  'User-initiated deletion requests. Processing is administrative and follows the approved 30-day retention window.';

create or replace function public.accept_mobile_project_invitation(p_token text)
returns uuid
language plpgsql
security definer
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
