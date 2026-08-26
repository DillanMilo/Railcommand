-- Phase 4 account-deletion compliance foundation.
--
-- This migration is additive and deliberately leaves all customer construction
-- records in place. Personal authentication/profile data is finalized by the
-- protected server job after the approved 30-day recovery period.

begin;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_status_check;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_status_check
  check (status in ('pending', 'reviewing', 'processing', 'completed', 'canceled', 'failed'));

drop index if exists public.account_deletion_requests_one_active_per_profile;
create unique index account_deletion_requests_one_active_per_profile
  on public.account_deletion_requests(profile_id)
  where status in ('pending', 'reviewing', 'processing', 'failed');

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

alter table public.account_deletion_audit enable row level security;

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

revoke all on public.account_deletion_audit from public, anon, authenticated;
grant select on public.account_deletion_audit to authenticated;

-- Direct inserts would bypass reauthentication and ownership checks. All user
-- submissions must pass through request_account_deletion().
drop policy if exists "Users can create their own account deletion request"
  on public.account_deletion_requests;
revoke insert on public.account_deletion_requests from authenticated;

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

  if p_request_source not in ('mobile', 'web') then
    raise exception 'invalid request source' using errcode = '22023';
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
  from public.profiles
  where profiles.id = v_user_id
  for update;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  select * into v_existing
  from public.account_deletion_requests
  where profile_id = v_user_id
    and account_deletion_requests.status in ('pending', 'reviewing', 'processing', 'failed')
  order by requested_at desc
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
    from public.profiles
    where organization_id = v_profile.organization_id
      and role = 'admin'
      and profiles.id <> v_user_id;

    if v_other_admins = 0 then
      raise exception 'RC409_SOLE_ORGANIZATION_ADMIN' using errcode = 'P0001';
    end if;
  end if;

  insert into public.account_deletion_requests (
    profile_id,
    client_request_id,
    status,
    request_source,
    organization_id,
    organization_role,
    local_drafts_count,
    local_outbox_count,
    local_photos_count,
    reauthenticated_at,
    record_disposition,
    completion_recipient
  ) values (
    v_user_id,
    p_client_request_id,
    'pending',
    p_request_source,
    v_profile.organization_id,
    v_profile.role,
    0,
    0,
    0,
    v_recent_password_at,
    'organization_retained_or_anonymized',
    v_profile.email
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

  update public.account_deletion_requests
  set status = 'canceled', canceled_at = now(), updated_at = now(), result_code = 'user_canceled'
  where account_deletion_requests.id = p_request_id
    and profile_id = v_user_id
    and account_deletion_requests.status in ('pending', 'reviewing')
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

revoke all on function public.request_account_deletion(uuid, text, integer, integer, integer)
  from public, anon;
revoke all on function public.cancel_account_deletion(uuid) from public, anon;
grant execute on function public.request_account_deletion(uuid, text, integer, integer, integer)
  to authenticated;
grant execute on function public.cancel_account_deletion(uuid) to authenticated;

comment on function public.request_account_deletion(uuid, text, integer, integer, integer) is
  'Creates one idempotent account-deletion request after recent password authentication, zero local work attestation, and sole-admin validation.';
comment on table public.account_deletion_audit is
  'Minimal audit trail for deletion request processing. Never stores credentials, email addresses, or field-record contents.';

notify pgrst, 'reload schema';

commit;
