-- =============================================================================
-- Migration: Drop legacy permissive storage.objects policies
-- Date:      2026-04-21
--
-- PURPOSE: The project-documents bucket has both old permissive policies
--          (any authenticated user can read/upload/delete) AND new member-
--          scoped policies active simultaneously. Because storage RLS
--          policies are PERMISSIVE and OR'd together, the legacy ones win:
--          any signed-in user can upload into any project's folder — a
--          tenant-isolation gap.
--
--          This migration drops the three legacy policies so the member-
--          scoped policies added in 2026-04-21_project_documents_rls.sql
--          become the sole gate for project-documents.
--
--          Legacy policies being removed:
--            1. "Authenticated users can upload project documents"
--               (INSERT, with_check = authenticated role only)
--            2. "Authenticated users can view project documents"
--               (SELECT, qual = authenticated role only)
--            3. "Users can delete own document uploads"
--               (DELETE, qual assumed path[1] = user_id — but our path
--                convention puts project_id at path[1], so this policy
--                was effectively never matching intended rows anyway)
--
-- HOW TO APPLY:
--   Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
--   Idempotent — uses DROP POLICY IF EXISTS.
--
-- VERIFICATION:
--   The "Before" and "After" SELECTs below show the policies on the
--   project-documents bucket. After running, you should see exactly
--   four policies remaining — all four scoped to project_members.
-- =============================================================================

-- ─── Before state ─────────────────────────────────────────────────────────
-- Uncomment to inspect current policies on project-documents before drop:
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'storage' and tablename = 'objects'
--   and (qual ilike '%project-documents%' or with_check ilike '%project-documents%')
-- order by cmd, policyname;

-- ─── Drop legacy permissive policies ──────────────────────────────────────

drop policy if exists "Authenticated users can upload project documents"
  on storage.objects;

drop policy if exists "Authenticated users can view project documents"
  on storage.objects;

drop policy if exists "Users can delete own document uploads"
  on storage.objects;

-- ─── Reload PostgREST schema cache ────────────────────────────────────────

notify pgrst, 'reload schema';

-- ─── After state ──────────────────────────────────────────────────────────
-- Expected: four policies remain, all gated on project_members:
--   - "Project members can read project documents"   (SELECT)
--   - "Project members can upload project documents" (INSERT)
--   - "Project members can update project documents" (UPDATE)
--   - "Project members can delete project documents" (DELETE)

select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (qual ilike '%project-documents%' or with_check ilike '%project-documents%')
order by cmd, policyname;
