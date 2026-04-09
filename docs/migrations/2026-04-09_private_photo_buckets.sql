-- =============================================================================
-- Migration: Flip project-photos & thermal-photos buckets to private + RLS
-- Date:      2026-04-09
--
-- IMPORTANT: Run this AFTER the frontend deploy that switches to signed URLs.
--            The frontend will gracefully fall back to file_url during the
--            transition window, so deploying code first is safe.
--
-- HOW TO APPLY:
--   Copy this entire file and paste it into the Supabase Dashboard
--   (Project -> SQL Editor -> New query -> Run). Safe to re-run — uses
--   `drop policy if exists` for idempotency.
--
-- WHAT IT DOES:
--   1. Flips project-photos and thermal-photos to private (public = false).
--   2. Adds RLS policies so that only authenticated project members can
--      read, insert, update, and delete files in their project folder.
--   Folder convention: first path segment is project_id (UUID).
-- =============================================================================

-- ─── Step 1: Flip buckets to private ────────────────────────────────────────

update storage.buckets
set public = false
where id in ('project-photos', 'thermal-photos');

-- ─── Step 2: RLS policies for project-photos ────────────────────────────────

-- SELECT: project members can read project photos
drop policy if exists "Project members can read project photos" on storage.objects;
create policy "Project members can read project photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

-- INSERT: project members can upload project photos
drop policy if exists "Project members can upload project photos" on storage.objects;
create policy "Project members can upload project photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

-- UPDATE: project members can update project photos
drop policy if exists "Project members can update project photos" on storage.objects;
create policy "Project members can update project photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
)
with check (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

-- DELETE: project members can delete project photos
drop policy if exists "Project members can delete project photos" on storage.objects;
create policy "Project members can delete project photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

-- ─── Step 3: RLS policies for thermal-photos ────────────────────────────────

-- SELECT: project members can read thermal photos
drop policy if exists "Project members can read thermal photos" on storage.objects;
create policy "Project members can read thermal photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'thermal-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

-- INSERT: project members can upload thermal photos
drop policy if exists "Project members can upload thermal photos" on storage.objects;
create policy "Project members can upload thermal photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'thermal-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

-- UPDATE: project members can update thermal photos
drop policy if exists "Project members can update thermal photos" on storage.objects;
create policy "Project members can update thermal photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'thermal-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
)
with check (
  bucket_id = 'thermal-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

-- DELETE: project members can delete thermal photos
drop policy if exists "Project members can delete thermal photos" on storage.objects;
create policy "Project members can delete thermal photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'thermal-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);
