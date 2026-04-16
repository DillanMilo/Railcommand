-- =============================================================================
-- Migration: Drop legacy recursive SELECT policies on project_members + projects
-- Date: 2026-04-16
-- Purpose: Two old SELECT policies from the original schema were never dropped
--          by earlier migrations because their names didn't match our DROP list.
--          They reference a helper function `get_my_project_ids()` that queries
--          project_members WITHOUT SECURITY DEFINER, causing infinite recursion
--          when combined with the new clean policies.
--
--          The newer `project_members_select` and `projects_select` policies
--          (using SECURITY DEFINER helpers) provide the same access control
--          correctly, so the old ones are simply redundant + broken.
--
-- Run in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run — uses DROP POLICY IF EXISTS.
-- =============================================================================

DROP POLICY IF EXISTS "Members can read project members" ON public.project_members;
DROP POLICY IF EXISTS "Members can read their projects" ON public.projects;

NOTIFY pgrst, 'reload schema';
