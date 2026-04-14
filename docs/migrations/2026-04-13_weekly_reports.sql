-- Migration: create weekly_reports table
-- Date: 2026-04-13
-- Purpose: Weekly Reports module — track weekly CM and contractor reports per project
-- Run in Supabase Dashboard → SQL Editor → New query → Run.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.weekly_reports (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  number              text not null,
  report_type         text not null default 'cm' check (report_type in ('cm', 'contractor')),
  week_start_date     date not null,
  week_end_date       date not null,
  title               text not null,
  status              text not null default 'draft' check (status in (
                        'draft','submitted','approved','rejected'
                      )),
  work_summary        text not null default '',
  safety_summary      text not null default '',
  schedule_summary    text not null default '',
  issues_concerns     text not null default '',
  upcoming_work       text not null default '',
  weather_summary     text not null default '',
  manpower_total      numeric not null default 0,
  equipment_hours     numeric not null default 0,
  submitted_by        uuid not null references public.profiles(id),
  approved_by         uuid references public.profiles(id),
  submit_date         date not null default current_date,
  approval_date       date,
  created_at          timestamptz not null default now()
);

-- 2. Indexes -----------------------------------------------------------------
create index if not exists weekly_reports_project_id_idx on public.weekly_reports(project_id);
create index if not exists weekly_reports_status_idx on public.weekly_reports(status);
create index if not exists weekly_reports_report_type_idx on public.weekly_reports(report_type);
create index if not exists weekly_reports_week_start_date_idx on public.weekly_reports(week_start_date);

-- 3. Row-Level Security ------------------------------------------------------
alter table public.weekly_reports enable row level security;

-- Project members can read weekly reports for their projects
create policy "members can read weekly reports"
  on public.weekly_reports for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = weekly_reports.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Project members can create weekly reports
create policy "members can create weekly reports"
  on public.weekly_reports for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = weekly_reports.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Project members can update weekly reports
create policy "members can update weekly reports"
  on public.weekly_reports for update
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = weekly_reports.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Only the submitter or managers can delete
create policy "submitter or managers can delete weekly reports"
  on public.weekly_reports for delete
  using (
    submitted_by = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = weekly_reports.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager')
    )
  );

-- 4. Notify PostgREST -------------------------------------------------------
notify pgrst, 'reload schema';
