-- Migration: create change_orders table
-- Date: 2026-04-12
-- Purpose: Change Orders module — track cost/scope changes per project
-- Run in Supabase Dashboard → SQL Editor → New query → Run.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.change_orders (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  number              text not null,
  title               text not null,
  description         text not null default '',
  reason              text not null default '',
  amount              numeric not null default 0,
  status              text not null default 'draft' check (status in (
                        'draft','submitted','approved','rejected','void'
                      )),
  submitted_by        uuid not null references public.profiles(id),
  approved_by         uuid references public.profiles(id),
  linked_milestone_id uuid references public.milestones(id) on delete set null,
  submit_date         date not null default current_date,
  approval_date       date,
  created_at          timestamptz not null default now()
);

-- 2. Indexes -----------------------------------------------------------------
create index if not exists change_orders_project_id_idx on public.change_orders(project_id);
create index if not exists change_orders_status_idx on public.change_orders(status);
create index if not exists change_orders_submitted_by_idx on public.change_orders(submitted_by);

-- 3. Row-Level Security ------------------------------------------------------
alter table public.change_orders enable row level security;

-- Project members can read change orders for their projects
create policy "members can read change orders"
  on public.change_orders for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = change_orders.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Project members with edit access can create change orders
create policy "editors can create change orders"
  on public.change_orders for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = change_orders.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Project members with edit access can update change orders
create policy "editors can update change orders"
  on public.change_orders for update
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = change_orders.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Only the submitter or managers can delete
create policy "reporters can delete change orders"
  on public.change_orders for delete
  using (
    submitted_by = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = change_orders.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager')
    )
  );

-- 4. Notify PostgREST -------------------------------------------------------
notify pgrst, 'reload schema';
