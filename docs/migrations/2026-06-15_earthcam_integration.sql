-- =============================================================================
-- Migration: EarthCam integration tables
-- Date:      2026-06-15
--
-- PURPOSE: Store the Railcommand side of an EarthCam integration:
--          organization connection state, project camera mappings, and
--          snapshot/clip evidence references. Bulk video remains in EarthCam.
--
-- HOW TO APPLY:
--   Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
--   Idempotent for tables, indexes, and policies.
-- =============================================================================

-- 1. Connection ---------------------------------------------------------------
create table if not exists public.earthcam_connections (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_name    text not null default 'EarthCam',
  status          text not null default 'needs_auth' check (status in ('connected','needs_auth','disabled')),
  auth_mode       text not null default 'api_key' check (auth_mode in ('api_key','oauth','service_account')),
  api_key_last4   text,
  connected_by    uuid references public.profiles(id) on delete set null,
  connected_at    timestamptz not null default now(),
  last_sync_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (organization_id)
);

create index if not exists earthcam_connections_org_idx on public.earthcam_connections(organization_id);

-- 2. Cameras ------------------------------------------------------------------
create table if not exists public.earthcam_cameras (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  connection_id      uuid not null references public.earthcam_connections(id) on delete cascade,
  earthcam_camera_id text not null,
  name               text not null,
  location_label     text not null default '',
  rail_area          text not null default '',
  live_embed_url     text not null default '',
  live_stream_url    text not null default '',
  thumbnail_url      text not null default '',
  status             text not null default 'online' check (status in ('online','offline','maintenance')),
  ptz_enabled        boolean not null default false,
  last_seen_at       timestamptz,
  created_at         timestamptz not null default now(),
  unique (project_id, earthcam_camera_id)
);

create index if not exists earthcam_cameras_project_idx on public.earthcam_cameras(project_id);
create index if not exists earthcam_cameras_connection_idx on public.earthcam_cameras(connection_id);
create index if not exists earthcam_cameras_status_idx on public.earthcam_cameras(status);

-- 3. Evidence references ------------------------------------------------------
create table if not exists public.earthcam_evidence (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  camera_id         uuid not null references public.earthcam_cameras(id) on delete cascade,
  evidence_type     text not null check (evidence_type in ('snapshot','clip')),
  title             text not null,
  description       text not null default '',
  captured_at       timestamptz not null default now(),
  start_time        timestamptz,
  end_time          timestamptz,
  earthcam_asset_id text,
  earthcam_url      text not null default '',
  thumbnail_url     text not null default '',
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists earthcam_evidence_project_idx on public.earthcam_evidence(project_id);
create index if not exists earthcam_evidence_camera_idx on public.earthcam_evidence(camera_id);
create index if not exists earthcam_evidence_captured_idx on public.earthcam_evidence(captured_at desc);

-- 4. Row-Level Security -------------------------------------------------------
alter table public.earthcam_connections enable row level security;
alter table public.earthcam_cameras enable row level security;
alter table public.earthcam_evidence enable row level security;

drop policy if exists "org members can read earthcam connection" on public.earthcam_connections;
create policy "org members can read earthcam connection"
  on public.earthcam_connections for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = earthcam_connections.organization_id
    )
  );

drop policy if exists "org managers can create earthcam connection" on public.earthcam_connections;
create policy "org managers can create earthcam connection"
  on public.earthcam_connections for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = earthcam_connections.organization_id
        and profiles.role in ('admin','manager')
    )
  );

drop policy if exists "org managers can update earthcam connection" on public.earthcam_connections;
create policy "org managers can update earthcam connection"
  on public.earthcam_connections for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = earthcam_connections.organization_id
        and profiles.role in ('admin','manager')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = earthcam_connections.organization_id
        and profiles.role in ('admin','manager')
    )
  );

drop policy if exists "project members can read earthcam cameras" on public.earthcam_cameras;
create policy "project members can read earthcam cameras"
  on public.earthcam_cameras for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = earthcam_cameras.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "project managers can write earthcam cameras" on public.earthcam_cameras;
create policy "project managers can write earthcam cameras"
  on public.earthcam_cameras for all
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = earthcam_cameras.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager','superintendent','engineer')
    )
  )
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = earthcam_cameras.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager','superintendent','engineer')
    )
  );

drop policy if exists "project members can read earthcam evidence" on public.earthcam_evidence;
create policy "project members can read earthcam evidence"
  on public.earthcam_evidence for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = earthcam_evidence.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "project editors can create earthcam evidence" on public.earthcam_evidence;
create policy "project editors can create earthcam evidence"
  on public.earthcam_evidence for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = earthcam_evidence.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager','superintendent','engineer','foreman','contractor','inspector')
    )
  );

drop policy if exists "project editors can delete earthcam evidence" on public.earthcam_evidence;
create policy "project editors can delete earthcam evidence"
  on public.earthcam_evidence for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = earthcam_evidence.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager','superintendent','engineer')
    )
  );

notify pgrst, 'reload schema';
