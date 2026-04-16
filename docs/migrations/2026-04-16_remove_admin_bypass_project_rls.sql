-- =============================================================================
-- Migration: Remove platform-admin bypass from project-level RLS
-- Date: 2026-04-16
-- Purpose: Enterprise data isolation — platform admins must be project members
--          to see project data, not get automatic access via role='admin'.
--
-- Context: Previously, RLS on project_members and projects had an
--          `OR public.is_admin(auth.uid())` clause that let platform admins
--          see every project. This broke true multi-tenant isolation —
--          "Leave Project" for an admin was only cosmetic.
--
--          Admin bypass is kept on INSERT/UPDATE/DELETE for project_members
--          as an emergency-recovery escape hatch (admins can manually fix
--          things via SQL or direct DB access if needed). But VIEWING
--          project data now strictly requires membership.
--
--          The /admin/demos dashboard and admin API routes continue to work
--          because they use the service-role client which bypasses RLS entirely.
--
-- Run in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run — uses DROP POLICY IF EXISTS.
-- =============================================================================

-- Remove admin bypass from project_members SELECT ────────────────────────
DROP POLICY IF EXISTS "project_members_select" ON public.project_members;
CREATE POLICY "project_members_select"
  ON public.project_members FOR SELECT
  USING (
    profile_id = auth.uid()
    OR public.is_project_member(project_id, auth.uid())
  );

-- Remove admin bypass from projects SELECT ───────────────────────────────
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select"
  ON public.projects FOR SELECT
  USING (
    public.is_project_member(id, auth.uid())
    OR created_by = auth.uid()
  );

-- Reload PostgREST so changes take effect immediately ───────────────────
NOTIFY pgrst, 'reload schema';
