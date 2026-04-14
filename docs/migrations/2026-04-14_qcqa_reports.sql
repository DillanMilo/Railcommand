-- Migration: create qcqa_reports table
-- Date: 2026-04-14
-- Purpose: QC/QA Reports module — inspections, nonconformances, tests, audits
-- Run in Supabase Dashboard -> SQL Editor -> New query -> Run.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.qcqa_reports (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete cascade,
  number                text not null,
  report_type           text not null default 'inspection' check (report_type in (
                          'inspection','nonconformance','test','audit'
                        )),
  title                 text not null,
  description           text not null default '',
  spec_reference        text not null default '',
  location              text not null default '',
  status                text not null default 'draft' check (status in (
                          'draft','open','in_review','closed'
                        )),
  findings              text not null default '',
  corrective_action     text not null default '',
  is_nonconformance     boolean not null default false,
  severity              text not null default 'minor' check (severity in (
                          'minor','major','critical'
                        )),
  inspector             uuid not null references public.profiles(id),
  linked_punch_list_ids text[] not null default '{}',
  closed_by             uuid references public.profiles(id),
  closed_date           timestamptz,
  created_at            timestamptz not null default now()
);

-- 2. Indexes -----------------------------------------------------------------
create index if not exists qcqa_reports_project_id_idx on public.qcqa_reports(project_id);
create index if not exists qcqa_reports_status_idx on public.qcqa_reports(status);
create index if not exists qcqa_reports_report_type_idx on public.qcqa_reports(report_type);
create index if not exists qcqa_reports_is_nonconformance_idx on public.qcqa_reports(is_nonconformance);

-- 3. Row-Level Security ------------------------------------------------------
alter table public.qcqa_reports enable row level security;

-- Project members can read QC/QA reports for their projects
create policy "members can read qcqa reports"
  on public.qcqa_reports for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = qcqa_reports.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Project members can create QC/QA reports
create policy "members can create qcqa reports"
  on public.qcqa_reports for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = qcqa_reports.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Project members can update QC/QA reports
create policy "members can update qcqa reports"
  on public.qcqa_reports for update
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = qcqa_reports.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Only the inspector or managers can delete
create policy "inspector or managers can delete qcqa reports"
  on public.qcqa_reports for delete
  using (
    inspector = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = qcqa_reports.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager')
    )
  );

-- 4. Notify PostgREST -------------------------------------------------------
notify pgrst, 'reload schema';
