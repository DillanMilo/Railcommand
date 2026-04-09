-- =============================================================================
-- Migration: Create `avatars` storage bucket + RLS policies
-- Date:      2026-04-08
--
-- HOW TO APPLY:
--   Copy this entire file and paste it into the Supabase Dashboard
--   (Project -> SQL Editor -> New query -> Run). Safe to re-run — uses
--   `on conflict do nothing` and `drop policy if exists`.
--
-- WHAT IT DOES:
--   1. Creates a public `avatars` bucket for user profile pictures.
--   2. Adds RLS policies so that:
--      - Any authenticated user can read avatars (bucket is public anyway).
--      - Users can only INSERT/UPDATE/DELETE files inside a folder named
--        after their own auth.uid() (i.e. `${user.id}/...`).
-- =============================================================================

-- 1. Create the bucket (public so avatar URLs resolve without signing)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2. RLS policies on storage.objects for the avatars bucket
--    Folder convention: first path segment must equal the uploader's auth.uid().

-- Read: any authenticated user can read any avatar
drop policy if exists "Avatars are readable by authenticated users" on storage.objects;
create policy "Avatars are readable by authenticated users"
on storage.objects
for select
to authenticated
using (bucket_id = 'avatars');

-- Insert: only into your own folder
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Update: only files in your own folder
drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete: only files in your own folder
drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
