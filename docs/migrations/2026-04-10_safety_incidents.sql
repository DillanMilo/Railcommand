-- Migration: create safety_incidents table
-- Date: 2026-04-10
-- Purpose: Safety module — incident reporting, tracking, close-out
-- Run in Supabase Dashboard → SQL Editor → New query → Run.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.safety_incidents (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  number          text not null,
  reported_by     uuid not null references public.profiles(id),
  incident_date   date not null default current_date,
  title           text not null,
  description     text not null default '',
  incident_type   text not null check (incident_type in (
                    'near_miss','first_aid','recordable','lost_time','observation','hazard'
                  )),
  severity        text not null check (severity in ('low','medium','high','critical')),
  status          text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  location        text not null default '',
  personnel_involved text not null default '',
  root_cause      text not null default '',
  corrective_action text not null default '',
  daily_log_id    uuid references public.daily_logs(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- 2. Indexes -----------------------------------------------------------------
create index if not exists safety_incidents_project_id_idx on public.safety_incidents(project_id);
create index if not exists safety_incidents_status_idx on public.safety_incidents(status);
create index if not exists safety_incidents_type_idx on public.safety_incidents(incident_type);
create index if not exists safety_incidents_severity_idx on public.safety_incidents(severity);
create index if not exists safety_incidents_date_idx on public.safety_incidents(incident_date);

-- 3. Row-Level Security ------------------------------------------------------
alter table public.safety_incidents enable row level security;

-- Project members can read safety incidents for their projects
create policy "members can read safety incidents"
  on public.safety_incidents for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = safety_incidents.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Project members with edit access can create incidents
create policy "editors can create safety incidents"
  on public.safety_incidents for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = safety_incidents.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Project members with edit access can update incidents
create policy "editors can update safety incidents"
  on public.safety_incidents for update
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = safety_incidents.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Only the reporter or managers can delete
create policy "reporters can delete safety incidents"
  on public.safety_incidents for delete
  using (
    reported_by = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = safety_incidents.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager')
    )
  );

-- 4. Notify PostgREST -------------------------------------------------------
notify pgrst, 'reload schema';
