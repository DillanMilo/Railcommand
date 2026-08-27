\set ON_ERROR_STOP on

create extension if not exists pgcrypto;
create schema if not exists auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create table public.organizations (id uuid primary key, name text not null);
create table public.profiles (
  id uuid primary key,
  email text not null,
  full_name text not null default '',
  phone text,
  role text not null,
  organization_id uuid references public.organizations(id),
  avatar_url text default '',
  notification_preferences jsonb default '{}'::jsonb,
  time_zone text,
  updated_at timestamptz not null default now()
);
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_request_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'completed', 'canceled')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '30 days'),
  completed_at timestamptz,
  unique (profile_id, client_request_id)
);
create unique index account_deletion_requests_one_active_per_profile
  on public.account_deletion_requests(profile_id) where status in ('pending', 'reviewing');
alter table public.account_deletion_requests enable row level security;
create policy "Users can read their account deletion requests"
  on public.account_deletion_requests for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "Users can create their own account deletion request"
  on public.account_deletion_requests for insert to authenticated
  with check (profile_id = (select auth.uid()) and status = 'pending');
grant select, insert on public.account_deletion_requests to authenticated;

\ir ../migrations/20260826123325_phase4_account_deletion_compliance.sql
\ir ../migrations/20260827005620_phase4_account_deletion_service_role_grants.sql

insert into public.organizations values ('10000000-0000-4000-8000-000000000001', 'Synthetic Review Organization');
insert into public.profiles (id, email, full_name, role, organization_id) values
  ('60000000-0000-4000-8000-000000000001', 'review-a@example.test', 'Reviewer A', 'admin', '10000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', false);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('amr', jsonb_build_array(jsonb_build_object(
    'method', 'password', 'timestamp', extract(epoch from now())::bigint
  )))::text,
  false
);

do $$
begin
  begin
    perform * from public.request_account_deletion(
      '70000000-0000-4000-8000-000000000001', 'mobile', 1, 0, 0
    );
    raise exception 'expected unsynchronized-work rejection';
  exception when others then
    if sqlerrm not like '%RC409_UNSYNCHRONIZED_WORK%' then raise; end if;
  end;

  begin
    perform * from public.request_account_deletion(
      '70000000-0000-4000-8000-000000000001', 'mobile', 0, 0, 0
    );
    raise exception 'expected sole-admin rejection';
  exception when others then
    if sqlerrm not like '%RC409_SOLE_ORGANIZATION_ADMIN%' then raise; end if;
  end;
end $$;

insert into public.profiles (id, email, full_name, role, organization_id) values
  ('60000000-0000-4000-8000-000000000002', 'review-b@example.test', 'Reviewer B', 'admin', '10000000-0000-4000-8000-000000000001');

do $$
declare
  first_id uuid;
  second_id uuid;
  failed_id uuid;
  was_duplicate boolean;
  canceled_status text;
begin
  select result.id, result.duplicate into first_id, was_duplicate
  from public.request_account_deletion(
    '70000000-0000-4000-8000-000000000001', 'mobile', 0, 0, 0
  ) result;
  if first_id is null or was_duplicate then raise exception 'first request was not created'; end if;

  select result.id, result.duplicate into second_id, was_duplicate
  from public.request_account_deletion(
    '70000000-0000-4000-8000-000000000002', 'mobile', 0, 0, 0
  ) result;
  if second_id <> first_id or not was_duplicate then raise exception 'active request was not idempotent'; end if;

  select result.status into canceled_status
  from public.cancel_account_deletion(first_id) result;
  if canceled_status <> 'canceled' then raise exception 'request was not canceled'; end if;

  select result.id into failed_id
  from public.request_account_deletion(
    '70000000-0000-4000-8000-000000000003', 'web', 0, 0, 0
  ) result;
  update public.account_deletion_requests set status = 'failed' where id = failed_id;

  select result.id, result.duplicate into second_id, was_duplicate
  from public.request_account_deletion(
    '70000000-0000-4000-8000-000000000004', 'web', 0, 0, 0
  ) result;
  if second_id <> failed_id or not was_duplicate then
    raise exception 'failed retry state was not treated as the active request';
  end if;
end $$;

do $$
begin
  if has_table_privilege('authenticated', 'public.account_deletion_requests', 'INSERT') then
    raise exception 'authenticated still has direct insert privilege';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.request_account_deletion(uuid,text,integer,integer,integer)',
    'EXECUTE'
  ) then
    raise exception 'authenticated cannot execute guarded request RPC';
  end if;
  if not has_table_privilege(
    'service_role',
    'public.account_deletion_requests',
    'SELECT,UPDATE'
  ) then
    raise exception 'service_role cannot process account deletion requests';
  end if;
  if not has_table_privilege(
    'service_role',
    'public.account_deletion_audit',
    'SELECT,INSERT'
  ) then
    raise exception 'service_role cannot record account deletion audit events';
  end if;
  if not exists (
    select 1 from public.account_deletion_audit
    where event_code = 'requested'
  ) or not exists (
    select 1 from public.account_deletion_audit
    where event_code = 'duplicate_request'
  ) or not exists (
    select 1 from public.account_deletion_audit
    where event_code = 'canceled'
  ) then
    raise exception 'required audit events were not recorded';
  end if;
end $$;

select 'phase4_account_deletion_sql_passed' as result;
