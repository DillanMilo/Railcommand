-- =============================================================================
-- Migration: Fix infinite recursion in project_members RLS policies
-- Date: 2026-04-16
-- Purpose: Invitation acceptance fails with "infinite recursion detected in
--          policy for relation project_members" because the SELECT policy
--          references project_members (self-referencing).
--
-- Fix: Use SECURITY DEFINER helper functions that bypass RLS during the
--      membership check, breaking the recursion cycle.
--
-- Run in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run — uses CREATE OR REPLACE and DROP POLICY IF EXISTS.
-- =============================================================================

-- 1. Helper functions (SECURITY DEFINER bypasses RLS) ────────────────────

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid, p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
      AND profile_id = p_profile_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_project(p_project_id uuid, p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
      AND profile_id = p_profile_id
      AND can_edit = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_profile_id
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_pending_invitation(p_project_id uuid, p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_invitations pi
    JOIN public.profiles p ON p.email = pi.email
    WHERE pi.project_id = p_project_id
      AND p.id = p_profile_id
      AND pi.status = 'pending'
      AND pi.expires_at > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_pending_invitation(uuid, uuid) TO authenticated;

-- 2. Drop existing recursive policies on project_members ─────────────────
DROP POLICY IF EXISTS "members can read project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
DROP POLICY IF EXISTS "members can insert project members" ON public.project_members;
DROP POLICY IF EXISTS "Members can insert project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can insert project members" ON public.project_members;
DROP POLICY IF EXISTS "members can update project members" ON public.project_members;
DROP POLICY IF EXISTS "Members can update project members" ON public.project_members;
DROP POLICY IF EXISTS "members can delete project members" ON public.project_members;
DROP POLICY IF EXISTS "Members can delete project members" ON public.project_members;
DROP POLICY IF EXISTS "project_members_select" ON public.project_members;
DROP POLICY IF EXISTS "project_members_insert" ON public.project_members;
DROP POLICY IF EXISTS "project_members_update" ON public.project_members;
DROP POLICY IF EXISTS "project_members_delete" ON public.project_members;

-- 3. New non-recursive policies using helper functions ────────────────────

-- SELECT: own row, fellow members (via helper), admins
CREATE POLICY "project_members_select"
  ON public.project_members FOR SELECT
  USING (
    profile_id = auth.uid()
    OR public.is_project_member(project_id, auth.uid())
    OR public.is_admin(auth.uid())
  );

-- INSERT: self-insert (invitation accept flow), managers/admins adding members
CREATE POLICY "project_members_insert"
  ON public.project_members FOR INSERT
  WITH CHECK (
    -- Self-insert requires a valid pending invitation
    (profile_id = auth.uid() AND public.has_pending_invitation(project_id, auth.uid()))
    -- Or a manager of the project is adding someone
    OR public.can_manage_project(project_id, auth.uid())
    -- Or an admin
    OR public.is_admin(auth.uid())
  );

-- UPDATE: managers of project, admins
CREATE POLICY "project_members_update"
  ON public.project_members FOR UPDATE
  USING (
    public.can_manage_project(project_id, auth.uid())
    OR public.is_admin(auth.uid())
  );

-- DELETE: managers of project, admins, or the user themselves (leave project)
CREATE POLICY "project_members_delete"
  ON public.project_members FOR DELETE
  USING (
    profile_id = auth.uid()
    OR public.can_manage_project(project_id, auth.uid())
    OR public.is_admin(auth.uid())
  );

-- 4. Also check projects table SELECT for similar recursion ─────────────
-- Projects table often has a policy like "members can read their projects"
-- that queries project_members — let's make sure that uses the helper too

DROP POLICY IF EXISTS "members can read projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Members can view projects" ON public.projects;
DROP POLICY IF EXISTS "projects_select" ON public.projects;

CREATE POLICY "projects_select"
  ON public.projects FOR SELECT
  USING (
    public.is_project_member(id, auth.uid())
    OR public.is_admin(auth.uid())
    OR created_by = auth.uid()
  );

-- 5. Reload PostgREST ────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
