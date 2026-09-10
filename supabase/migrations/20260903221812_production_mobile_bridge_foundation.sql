-- Production mobile bridge foundation.
--
-- This migration is intentionally additive. It creates only the mobile device,
-- invitation-acceptance, and account-deletion contracts already exercised in
-- isolated staging. It does not copy, update, or delete customer field records.
-- Application rollout remains separately gated by MOBILE_PILOT_MODE.

begin;

-- Fail before any DDL if this is not the expected RailCommand schema. This keeps
-- an accidental or drifted target from being "repaired" by guesswork.
do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.profiles') is null then v_missing := array_append(v_missing, 'public.profiles'); end if;
  if to_regclass('public.organizations') is null then v_missing := array_append(v_missing, 'public.organizations'); end if;
  if to_regclass('public.projects') is null then v_missing := array_append(v_missing, 'public.projects'); end if;
  if to_regclass('public.project_members') is null then v_missing := array_append(v_missing, 'public.project_members'); end if;
  if to_regclass('public.project_invitations') is null then v_missing := array_append(v_missing, 'public.project_invitations'); end if;

  if cardinality(v_missing) > 0 then
    raise exception 'RC_BRIDGE_BASELINE_MISMATCH: missing required relations %', array_to_string(v_missing, ', ')
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class relation on relation.oid = constraint_row.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'project_members'
      and constraint_row.contype = 'u'
      and pg_get_constraintdef(constraint_row.oid) = 'UNIQUE (project_id, profile_id)'
  ) then
    raise exception 'RC_BRIDGE_BASELINE_MISMATCH: project membership uniqueness is unavailable'
      using errcode = '55000';
  end if;
end;
$$;

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
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '30 days'),
  completed_at timestamptz,
  unique (profile_id, client_request_id)
);

alter table public.account_deletion_requests
  add column if not exists request_source text not null default 'mobile'
    check (request_source in ('mobile', 'web')),
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists organization_role text,
  add column if not exists local_drafts_count integer not null default 0 check (local_drafts_count >= 0),
  add column if not exists local_outbox_count integer not null default 0 check (local_outbox_count >= 0),
  add column if not exists local_photos_count integer not null default 0 check (local_photos_count >= 0),
  add column if not exists reauthenticated_at timestamptz,
  add column if not exists record_disposition text not null default 'organization_retained_or_anonymized',
  add column if not exists canceled_at timestamptz,
  add column if not exists anonymized_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists result_code text,
  add column if not exists completion_recipient text,
  add column if not exists identity_deleted_at timestamptz,
  add column if not exists completion_email_sent_at timestamptz;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_status_check;
alter table public.account_deletion_requests
  add constraint account_deletion_requests_status_check
  check (status in ('pending', 'reviewing', 'processing', 'completed', 'canceled', 'failed'));

drop index if exists public.account_deletion_requests_one_active_per_profile;
create unique index account_deletion_requests_one_active_per_profile
  on public.account_deletion_requests(profile_id)
  where status in ('pending', 'reviewing', 'processing', 'failed');

create table if not exists public.account_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.account_deletion_requests(id) on delete restrict,
  event_code text not null check (event_code in (
    'requested', 'duplicate_request', 'sessions_revoked', 'session_revocation_failed', 'canceled',
    'processing_started', 'profile_anonymized', 'identity_deleted',
    'completion_email_sent', 'completed', 'failed'
  )),
  actor text not null check (actor in ('user', 'system', 'administrator')),
  event_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists account_deletion_audit_request_idx
  on public.account_deletion_audit(request_id, event_at);

alter table public.mobile_device_registrations enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.account_deletion_audit enable row level security;

drop policy if exists "Users can read their mobile device registrations" on public.mobile_device_registrations;
create policy "Users can read their mobile device registrations"
  on public.mobile_device_registrations for select to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "Users can register their own mobile devices" on public.mobile_device_registrations;
create policy "Users can register their own mobile devices"
  on public.mobile_device_registrations for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists "Users can update their own mobile device registrations" on public.mobile_device_registrations;
create policy "Users can update their own mobile device registrations"
  on public.mobile_device_registrations for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists "Users can read their account deletion requests" on public.account_deletion_requests;
create policy "Users can read their account deletion requests"
  on public.account_deletion_requests for select to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "Users can create their own account deletion request" on public.account_deletion_requests;

drop policy if exists "Users can read their account deletion audit" on public.account_deletion_audit;
create policy "Users can read their account deletion audit"
  on public.account_deletion_audit for select to authenticated
  using (
    exists (
      select 1
      from public.account_deletion_requests request
      where request.id = account_deletion_audit.request_id
        and request.profile_id = (select auth.uid())
    )
  );

-- These narrowly scoped policies let an invitee finish the existing
-- pending -> accepted workflow without a privileged invitation function.
drop policy if exists "Mobile invitees can read accepted invitation during handoff" on public.project_invitations;
create policy "Mobile invitees can read accepted invitation during handoff"
  on public.project_invitations for select to authenticated
  using (
    status in ('pending', 'accepted')
    and lower(email) = lower((
      select profile.email from public.profiles profile
      where profile.id = (select auth.uid())
    ))
  );

drop policy if exists "Mobile invitees can accept their invitation" on public.project_invitations;
create policy "Mobile invitees can accept their invitation"
  on public.project_invitations for update to authenticated
  using (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower((
      select profile.email from public.profiles profile
      where profile.id = (select auth.uid())
    ))
  )
  with check (
    status = 'accepted'
    and lower(email) = lower((
      select profile.email from public.profiles profile
      where profile.id = (select auth.uid())
    ))
  );

drop policy if exists "Mobile invitees can add invited membership" on public.project_members;
create policy "Mobile invitees can add invited membership"
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
          select profile.email from public.profiles profile
          where profile.id = (select auth.uid())
        ))
        and project_members.can_edit = (
          invitation.project_role in ('manager', 'superintendent', 'foreman', 'engineer')
        )
    )
  );

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
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[a-fA-F0-9]{32,128}$' then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;

  select lower(profile.email)
  into v_user_email
  from public.profiles profile
  where profile.id = v_user_id;

  select *
  into v_invitation
  from public.project_invitations invitation
  where invitation.token = p_token
    and lower(invitation.email) = v_user_email
    and invitation.status = 'pending'
    and invitation.expires_at > now()
  for update;

  if not found then
    raise exception 'invitation not found, expired, or already used' using errcode = 'P0002';
  end if;

  insert into public.project_members(project_id, profile_id, project_role, can_edit)
  values (
    v_invitation.project_id,
    v_user_id,
    v_invitation.project_role,
    v_invitation.project_role in ('manager', 'superintendent', 'foreman', 'engineer')
  )
  on conflict (project_id, profile_id) do nothing;

  update public.project_invitations invitation
  set status = 'accepted'
  where invitation.id = v_invitation.id;

  return v_invitation.project_id;
end;
$$;

create or replace function public.request_account_deletion(
  p_client_request_id uuid,
  p_request_source text,
  p_local_drafts_count integer,
  p_local_outbox_count integer,
  p_local_photos_count integer
)
returns table (
  id uuid,
  status text,
  requested_at timestamptz,
  scheduled_for timestamptz,
  duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_existing public.account_deletion_requests%rowtype;
  v_created public.account_deletion_requests%rowtype;
  v_recent_password_at timestamptz;
  v_other_admins integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_client_request_id is null or p_request_source not in ('mobile', 'web') then
    raise exception 'invalid deletion request' using errcode = '22023';
  end if;
  if coalesce(p_local_drafts_count, -1) <> 0
     or coalesce(p_local_outbox_count, -1) <> 0
     or coalesce(p_local_photos_count, -1) <> 0 then
    raise exception 'RC409_UNSYNCHRONIZED_WORK' using errcode = 'P0001';
  end if;

  select to_timestamp((entry ->> 'timestamp')::double precision)
  into v_recent_password_at
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) entry
  where entry ->> 'method' = 'password'
  order by (entry ->> 'timestamp')::bigint desc
  limit 1;

  if v_recent_password_at is null or v_recent_password_at < now() - interval '5 minutes' then
    raise exception 'RC401_RECENT_PASSWORD_REQUIRED' using errcode = '42501';
  end if;

  select * into v_profile
  from public.profiles profile
  where profile.id = v_user_id
  for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  select * into v_existing
  from public.account_deletion_requests request
  where request.profile_id = v_user_id
    and request.status in ('pending', 'reviewing', 'processing', 'failed')
  order by request.requested_at desc
  limit 1;

  if found then
    insert into public.account_deletion_audit(request_id, event_code, actor)
    values (v_existing.id, 'duplicate_request', 'user');
    return query select v_existing.id, v_existing.status, v_existing.requested_at,
      v_existing.scheduled_for, true;
    return;
  end if;

  if v_profile.organization_id is not null and v_profile.role = 'admin' then
    select count(*)::integer into v_other_admins
    from public.profiles profile
    where profile.organization_id = v_profile.organization_id
      and profile.role = 'admin'
      and profile.id <> v_user_id;
    if v_other_admins = 0 then
      raise exception 'RC409_SOLE_ORGANIZATION_ADMIN' using errcode = 'P0001';
    end if;
  end if;

  insert into public.account_deletion_requests (
    profile_id, client_request_id, status, request_source,
    organization_id, organization_role, local_drafts_count,
    local_outbox_count, local_photos_count, reauthenticated_at,
    record_disposition, completion_recipient
  ) values (
    v_user_id, p_client_request_id, 'pending', p_request_source,
    v_profile.organization_id, v_profile.role, 0, 0, 0,
    v_recent_password_at, 'organization_retained_or_anonymized', v_profile.email
  )
  returning * into v_created;

  insert into public.account_deletion_audit(request_id, event_code, actor, metadata)
  values (
    v_created.id,
    'requested',
    'user',
    jsonb_build_object(
      'source', p_request_source,
      'recovery_days', 30,
      'record_disposition', 'organization_retained_or_anonymized'
    )
  );

  return query select v_created.id, v_created.status, v_created.requested_at,
    v_created.scheduled_for, false;
end;
$$;

create or replace function public.cancel_account_deletion(p_request_id uuid)
returns table (
  id uuid,
  status text,
  requested_at timestamptz,
  scheduled_for timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.account_deletion_requests%rowtype;
  v_recent_password_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select to_timestamp((entry ->> 'timestamp')::double precision)
  into v_recent_password_at
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) entry
  where entry ->> 'method' = 'password'
  order by (entry ->> 'timestamp')::bigint desc
  limit 1;

  if v_recent_password_at is null or v_recent_password_at < now() - interval '5 minutes' then
    raise exception 'RC401_RECENT_PASSWORD_REQUIRED' using errcode = '42501';
  end if;

  update public.account_deletion_requests request
  set status = 'canceled', canceled_at = now(), updated_at = now(), result_code = 'user_canceled'
  where request.id = p_request_id
    and request.profile_id = v_user_id
    and request.status in ('pending', 'reviewing')
  returning * into v_request;

  if not found then
    raise exception 'active deletion request not found' using errcode = 'P0002';
  end if;

  insert into public.account_deletion_audit(request_id, event_code, actor)
  values (v_request.id, 'canceled', 'user');

  return query select v_request.id, v_request.status, v_request.requested_at,
    v_request.scheduled_for;
end;
$$;

revoke all on table public.mobile_device_registrations from public, anon, authenticated;
revoke all on table public.account_deletion_requests from public, anon, authenticated;
revoke all on table public.account_deletion_audit from public, anon, authenticated;

grant select, insert, update on table public.mobile_device_registrations to authenticated;
grant select on table public.account_deletion_requests to authenticated;
grant select on table public.account_deletion_audit to authenticated;

grant select, update, delete on table public.mobile_device_registrations to service_role;
grant select, update on table public.account_deletion_requests to service_role;
grant select, insert on table public.account_deletion_audit to service_role;

grant select, update(status) on table public.project_invitations to authenticated;
grant insert(project_id, profile_id, project_role, can_edit)
  on table public.project_members to authenticated;

revoke all on function public.accept_mobile_project_invitation(text) from public, anon, authenticated;
grant execute on function public.accept_mobile_project_invitation(text) to authenticated;

revoke all on function public.request_account_deletion(uuid, text, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.cancel_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.request_account_deletion(uuid, text, integer, integer, integer)
  to authenticated;
grant execute on function public.cancel_account_deletion(uuid) to authenticated;

comment on table public.mobile_device_registrations is
  'User-owned Expo push registrations separated by application environment.';
comment on table public.account_deletion_requests is
  'User-initiated deletion requests processed after the approved 30-day recovery window.';
comment on table public.account_deletion_audit is
  'Minimal deletion workflow audit; credentials and field-record contents are prohibited.';
comment on function public.request_account_deletion(uuid, text, integer, integer, integer) is
  'Creates one idempotent deletion request after recent password authentication and zero local-work attestation.';

notify pgrst, 'reload schema';

commit;
