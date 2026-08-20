-- STAGING ONLY. This script must never be added to the production migration chain.
-- It fails closed unless the private RailCommand Mobile Staging marker is present.

do $$
begin
  if to_regclass('mobile_staging.fixture_manifest') is null
     or not exists (
       select 1
       from mobile_staging.fixture_manifest
       where fixture_key = 'qa-project'
         and synthetic_name = 'Synthetic US Track Renewal'
     ) then
    raise exception 'Refusing to run without the RailCommand Mobile Staging marker';
  end if;
end;
$$;

create extension if not exists pgcrypto with schema extensions;

-- The staging project was created with an automatic-RLS event trigger. Its
-- maintenance function is not an application RPC and must not be client-callable.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  type text not null default 'contractor',
  tier text not null default 'free',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'member'
    check (role in ('admin', 'manager', 'member', 'viewer')),
  organization_id uuid references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  description text default '',
  status text not null default 'active'
    check (status in ('active', 'on_hold', 'completed', 'archived')),
  start_date date not null,
  target_end_date date not null,
  location text default '',
  client text default '',
  created_by uuid not null references public.profiles(id),
  organization_id uuid references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  project_role text not null
    check (project_role in ('engineer', 'contractor', 'owner', 'inspector', 'manager', 'superintendent', 'foreman')),
  can_edit boolean not null default false,
  added_at timestamptz not null default now(),
  unique (project_id, profile_id)
);

create table if not exists public.daily_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  log_date date not null,
  created_by uuid not null references public.profiles(id),
  weather_temp numeric(5,1) not null default 0,
  weather_conditions text not null default '',
  weather_wind text not null default '',
  work_summary text not null default '',
  safety_notes text not null default '',
  geo_tag jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists daily_logs_created_by_idempotency_key_uidx
  on public.daily_logs (created_by, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.daily_log_personnel (
  id uuid primary key default extensions.gen_random_uuid(),
  daily_log_id uuid not null references public.daily_logs(id) on delete cascade,
  role text not null,
  headcount integer not null default 0,
  company text not null default ''
);

create table if not exists public.daily_log_equipment (
  id uuid primary key default extensions.gen_random_uuid(),
  daily_log_id uuid not null references public.daily_logs(id) on delete cascade,
  equipment_type text not null,
  count integer not null default 0,
  notes text not null default ''
);

create table if not exists public.daily_log_work_items (
  id uuid primary key default extensions.gen_random_uuid(),
  daily_log_id uuid not null references public.daily_logs(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 0,
  unit text not null default '',
  location text not null default ''
);

create table if not exists public.activity_log (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  description text not null,
  performed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function mobile_staging.can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ) or exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id and pm.profile_id = (select auth.uid())
  );
$$;

create or replace function mobile_staging.can_edit_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ) or exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id
      and pm.profile_id = (select auth.uid())
      and pm.can_edit
      and pm.project_role in ('manager', 'superintendent', 'foreman', 'contractor')
  );
$$;

revoke all on function mobile_staging.can_access_project(uuid) from public, anon;
revoke all on function mobile_staging.can_edit_project(uuid) from public, anon;
grant usage on schema mobile_staging to authenticated;
grant execute on function mobile_staging.can_access_project(uuid) to authenticated;
grant execute on function mobile_staging.can_edit_project(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.daily_logs enable row level security;
alter table public.daily_log_personnel enable row level security;
alter table public.daily_log_equipment enable row level security;
alter table public.daily_log_work_items enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists mobile_profiles_select_self on public.profiles;
create policy mobile_profiles_select_self on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists mobile_projects_select_member on public.projects;
create policy mobile_projects_select_member on public.projects
  for select to authenticated using (mobile_staging.can_access_project(id));

drop policy if exists mobile_memberships_select_self on public.project_members;
create policy mobile_memberships_select_self on public.project_members
  for select to authenticated using (profile_id = (select auth.uid()));

drop policy if exists mobile_daily_logs_select_member on public.daily_logs;
create policy mobile_daily_logs_select_member on public.daily_logs
  for select to authenticated using (mobile_staging.can_access_project(project_id));

drop policy if exists mobile_daily_logs_insert_editor on public.daily_logs;
create policy mobile_daily_logs_insert_editor on public.daily_logs
  for insert to authenticated with check (
    created_by = (select auth.uid()) and mobile_staging.can_edit_project(project_id)
  );

drop policy if exists mobile_personnel_insert_owner on public.daily_log_personnel;
create policy mobile_personnel_insert_owner on public.daily_log_personnel
  for insert to authenticated with check (exists (
    select 1 from public.daily_logs dl
    where dl.id = daily_log_id and dl.created_by = (select auth.uid())
  ));

drop policy if exists mobile_equipment_insert_owner on public.daily_log_equipment;
create policy mobile_equipment_insert_owner on public.daily_log_equipment
  for insert to authenticated with check (exists (
    select 1 from public.daily_logs dl
    where dl.id = daily_log_id and dl.created_by = (select auth.uid())
  ));

drop policy if exists mobile_work_items_insert_owner on public.daily_log_work_items;
create policy mobile_work_items_insert_owner on public.daily_log_work_items
  for insert to authenticated with check (exists (
    select 1 from public.daily_logs dl
    where dl.id = daily_log_id and dl.created_by = (select auth.uid())
  ));

drop policy if exists mobile_activity_insert_editor on public.activity_log;
create policy mobile_activity_insert_editor on public.activity_log
  for insert to authenticated with check (
    performed_by = (select auth.uid()) and mobile_staging.can_edit_project(project_id)
  );

revoke all on all tables in schema public from anon;
revoke all on public.organizations, public.profiles, public.projects,
  public.project_members, public.daily_logs, public.daily_log_personnel,
  public.daily_log_equipment, public.daily_log_work_items, public.activity_log
  from authenticated;
grant select on public.profiles, public.projects, public.project_members,
  public.daily_logs to authenticated;
grant insert on public.daily_logs, public.daily_log_personnel,
  public.daily_log_equipment, public.daily_log_work_items, public.activity_log
  to authenticated;

create or replace function public.sync_daily_log_create(
  p_project_id uuid,
  p_client_id uuid,
  p_idempotency_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.daily_logs%rowtype;
  v_log public.daily_logs%rowtype;
  v_duplicate boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_project_id is null or p_client_id is null
     or p_idempotency_key is null
     or length(trim(p_idempotency_key)) < 16
     or length(p_idempotency_key) > 200 then
    raise exception 'Valid project, client, and idempotency values are required'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(coalesce(p_payload->'personnel', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_payload->'equipment', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_payload->'work_items', '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid daily-log payload' using errcode = '22023';
  end if;
  if not mobile_staging.can_edit_project(p_project_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || trim(p_idempotency_key), 0)
  );
  select * into v_existing
  from public.daily_logs dl
  where dl.created_by = v_user_id
    and dl.idempotency_key = trim(p_idempotency_key)
  limit 1;

  if found then
    if v_existing.id <> p_client_id or v_existing.project_id <> p_project_id then
      raise exception 'Idempotency key was already used for another operation'
        using errcode = '23505';
    end if;
    v_log := v_existing;
    v_duplicate := true;
  else
    insert into public.daily_logs (
      id, project_id, log_date, created_by, weather_temp, weather_conditions,
      weather_wind, work_summary, safety_notes, geo_tag, idempotency_key
    ) values (
      p_client_id, p_project_id, (p_payload->>'log_date')::date, v_user_id,
      coalesce((p_payload->>'weather_temp')::numeric, 0),
      left(coalesce(p_payload->>'weather_conditions', ''), 200),
      left(coalesce(p_payload->>'weather_wind', ''), 200),
      left(coalesce(p_payload->>'work_summary', ''), 20000),
      left(coalesce(p_payload->>'safety_notes', ''), 20000),
      p_payload->'geo_tag', trim(p_idempotency_key)
    ) returning * into v_log;

    insert into public.daily_log_personnel (daily_log_id, role, headcount, company)
    select v_log.id, left(trim(item->>'role'), 200),
      greatest(coalesce((item->>'headcount')::integer, 0), 0),
      left(coalesce(item->>'company', ''), 300)
    from jsonb_array_elements(coalesce(p_payload->'personnel', '[]'::jsonb)) item
    where trim(coalesce(item->>'role', '')) <> '';

    insert into public.daily_log_equipment (daily_log_id, equipment_type, count, notes)
    select v_log.id, left(trim(item->>'equipment_type'), 300),
      greatest(coalesce((item->>'count')::integer, 0), 0),
      left(coalesce(item->>'notes', ''), 2000)
    from jsonb_array_elements(coalesce(p_payload->'equipment', '[]'::jsonb)) item
    where trim(coalesce(item->>'equipment_type', '')) <> '';

    insert into public.daily_log_work_items (daily_log_id, description, quantity, unit, location)
    select v_log.id, left(trim(item->>'description'), 2000),
      greatest(coalesce((item->>'quantity')::numeric, 0), 0),
      left(coalesce(item->>'unit', ''), 100),
      left(coalesce(item->>'location', ''), 500)
    from jsonb_array_elements(coalesce(p_payload->'work_items', '[]'::jsonb)) item
    where trim(coalesce(item->>'description', '')) <> '';

    insert into public.activity_log (
      project_id, entity_type, entity_id, action, description, performed_by
    ) values (
      p_project_id, 'daily_log', v_log.id, 'created',
      'synchronized Phase 1 mobile daily log for ' || v_log.log_date::text,
      v_user_id
    );
  end if;

  return jsonb_build_object(
    'id', v_log.id,
    'project_id', v_log.project_id,
    'created_by', v_log.created_by,
    'idempotency_key', v_log.idempotency_key,
    'duplicate', v_duplicate
  );
end;
$$;

revoke all on function public.sync_daily_log_create(uuid, uuid, text, jsonb)
  from public, anon;
grant execute on function public.sync_daily_log_create(uuid, uuid, text, jsonb)
  to authenticated;

insert into public.organizations (id, name, type, tier)
values ('10000000-0000-4000-8000-000000000001', 'RailCommand QA Railroad', 'owner', 'enterprise')
on conflict (id) do update set name = excluded.name;

insert into public.profiles (id, email, full_name, role, organization_id)
select id, email, 'RailCommand Mobile QA Owner', 'manager',
  '10000000-0000-4000-8000-000000000001'
from auth.users
where email = 'railcommand-mobile-owner@creativecurrents.test'
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  organization_id = excluded.organization_id;

do $$
begin
  if not exists (
    select 1 from public.profiles
    where email = 'railcommand-mobile-owner@creativecurrents.test'
  ) then
    raise exception 'Synthetic Phase 1 auth user is missing';
  end if;
end;
$$;

insert into public.projects (
  id, name, description, status, start_date, target_end_date, location,
  client, created_by, organization_id
)
select
  '20000000-0000-4000-8000-000000000001',
  'Synthetic US Track Renewal',
  'Non-production fixture for the isolated mobile architecture spike.',
  'active', current_date - 30, current_date + 120,
  'Illinois, USA', 'RailCommand QA Railroad', p.id,
  '10000000-0000-4000-8000-000000000001'
from public.profiles p
where p.email = 'railcommand-mobile-owner@creativecurrents.test'
on conflict (id) do update set name = excluded.name, updated_at = now();

insert into public.project_members (project_id, profile_id, project_role, can_edit)
select '20000000-0000-4000-8000-000000000001', p.id, 'manager', true
from public.profiles p
where p.email = 'railcommand-mobile-owner@creativecurrents.test'
on conflict (project_id, profile_id) do update set
  project_role = excluded.project_role,
  can_edit = excluded.can_edit;

insert into public.daily_logs (
  id, project_id, log_date, created_by, weather_conditions, work_summary,
  safety_notes, idempotency_key
)
select
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', current_date - 1, p.id,
  'Clear — synthetic fixture',
  'Phase 1 cached daily-log fixture. No customer data.',
  'Synthetic staging record only.', 'phase1-bootstrap-fixture-0001'
from public.profiles p
where p.email = 'railcommand-mobile-owner@creativecurrents.test'
on conflict (id) do update set updated_at = now();
