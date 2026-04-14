-- Migration: create modifications table
-- Date: 2026-04-13
-- Purpose: Modifications & Amendments module — track plan revisions, spec/contract amendments per project
-- Run in Supabase Dashboard → SQL Editor → New query → Run.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.modifications (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  number              text not null,
  title               text not null,
  description         text not null default '',
  modification_type   text not null default 'plan_revision' check (modification_type in (
                        'plan_revision','spec_amendment','contract_amendment','design_change','scope_change'
                      )),
  status              text not null default 'draft' check (status in (
                        'draft','issued','acknowledged','implemented','void'
                      )),
  revision_number     text not null default '',
  affected_documents  text not null default '',
  issued_by           uuid not null references public.profiles(id),
  issued_date         date not null default current_date,
  effective_date      date,
  acknowledged_by     uuid references public.profiles(id),
  acknowledged_date   date,
  linked_milestone_id uuid references public.milestones(id) on delete set null,
  created_at          timestamptz not null default now()
);

-- 2. Indexes -----------------------------------------------------------------
create index if not exists modifications_project_id_idx on public.modifications(project_id);
create index if not exists modifications_status_idx on public.modifications(status);
create index if not exists modifications_modification_type_idx on public.modifications(modification_type);

-- 3. Row-Level Security ------------------------------------------------------
alter table public.modifications enable row level security;

-- Project members can read modifications for their projects
create policy "members can read modifications"
  on public.modifications for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = modifications.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Project members can create modifications
create policy "members can create modifications"
  on public.modifications for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = modifications.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Project members can update modifications
create policy "members can update modifications"
  on public.modifications for update
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = modifications.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Only the issuer or managers can delete
create policy "issuer or managers can delete modifications"
  on public.modifications for delete
  using (
    issued_by = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = modifications.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager')
    )
  );

-- 4. Notify PostgREST -------------------------------------------------------
notify pgrst, 'reload schema';
