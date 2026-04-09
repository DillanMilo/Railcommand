-- Migration: create project_invitations table
-- Date: 2026-04-06
-- Purpose: Backs the team invite-by-email flow in src/lib/actions/invitations.ts.
--
-- Run this in Supabase Dashboard → SQL Editor → New query → Run.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.project_invitations (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  email         text not null,
  project_role  text not null check (project_role in (
                  'manager','superintendent','foreman','engineer','inspector','viewer'
                )),
  invited_by    uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending','accepted','declined','expired')),
  token         text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days')
);

-- 2. Indexes -----------------------------------------------------------------
create index if not exists project_invitations_project_id_idx
  on public.project_invitations(project_id);
create index if not exists project_invitations_email_idx
  on public.project_invitations(email);
create index if not exists project_invitations_status_idx
  on public.project_invitations(status);
create index if not exists project_invitations_token_idx
  on public.project_invitations(token);

-- Prevent duplicate pending invites for the same email + project
create unique index if not exists project_invitations_unique_pending
  on public.project_invitations(project_id, email)
  where status = 'pending';

-- 3. Row-Level Security ------------------------------------------------------
alter table public.project_invitations enable row level security;

-- Project members can read invitations for their projects
create policy "members can read project invitations"
  on public.project_invitations for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = project_invitations.project_id
        and project_members.profile_id = auth.uid()
    )
  );

-- Invited users can read their own pending invitations (by email)
create policy "invitees can read their own invitations"
  on public.project_invitations for select
  using (
    email = (select email from public.profiles where id = auth.uid())
  );

-- Project managers (can_edit) can insert invitations
create policy "managers can create invitations"
  on public.project_invitations for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = project_invitations.project_id
        and project_members.profile_id = auth.uid()
        and project_members.can_edit = true
    )
  );

-- Project managers can update / cancel invitations
create policy "managers can update invitations"
  on public.project_invitations for update
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = project_invitations.project_id
        and project_members.profile_id = auth.uid()
        and project_members.can_edit = true
    )
  );

-- Invitees can update their own invitation (to accept / decline)
create policy "invitees can update their own invitations"
  on public.project_invitations for update
  using (
    email = (select email from public.profiles where id = auth.uid())
  );

-- 4. Notify PostgREST to reload schema cache --------------------------------
notify pgrst, 'reload schema';
