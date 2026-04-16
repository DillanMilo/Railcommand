-- =============================================================================
-- Migration: Fix attachments RLS — add project_id and scope to project_members
-- Date: 2026-04-15
-- Purpose: Attachments table had permissive RLS (any authenticated user could
--          read any attachment). This breaks demo isolation. Fix by adding a
--          project_id column and scoping all policies to project_members.
--
-- Run in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run — uses IF NOT EXISTS and DROP IF EXISTS.
-- =============================================================================

-- 1. Add project_id column ───────────────────────────────────────────────────
ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS attachments_project_id_idx ON public.attachments(project_id);

-- 2. Backfill project_id from parent entities ────────────────────────────────
-- Submittals
UPDATE public.attachments a SET project_id = s.project_id
FROM public.submittals s
WHERE a.entity_type = 'submittal' AND a.entity_id = s.id::text AND a.project_id IS NULL;

-- RFIs
UPDATE public.attachments a SET project_id = r.project_id
FROM public.rfis r
WHERE a.entity_type = 'rfi' AND a.entity_id = r.id::text AND a.project_id IS NULL;

-- Daily Logs
UPDATE public.attachments a SET project_id = d.project_id
FROM public.daily_logs d
WHERE a.entity_type = 'daily_log' AND a.entity_id = d.id::text AND a.project_id IS NULL;

-- Punch List Items
UPDATE public.attachments a SET project_id = p.project_id
FROM public.punch_list_items p
WHERE a.entity_type = 'punch_list' AND a.entity_id = p.id::text AND a.project_id IS NULL;

-- Safety Incidents
UPDATE public.attachments a SET project_id = si.project_id
FROM public.safety_incidents si
WHERE a.entity_type = 'safety_incident' AND a.entity_id = si.id::text AND a.project_id IS NULL;

-- 3. Drop old permissive policies ────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON public.attachments;
DROP POLICY IF EXISTS "Authenticated users can add attachments" ON public.attachments;
DROP POLICY IF EXISTS "Users can delete own attachments" ON public.attachments;
DROP POLICY IF EXISTS "attachments_select" ON public.attachments;
DROP POLICY IF EXISTS "attachments_insert" ON public.attachments;
DROP POLICY IF EXISTS "attachments_update" ON public.attachments;
DROP POLICY IF EXISTS "attachments_delete" ON public.attachments;

-- 4. Create membership-scoped policies ───────────────────────────────────────
CREATE POLICY "attachments_select"
  ON public.attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = attachments.project_id
        AND pm.profile_id = auth.uid()
    )
  );

CREATE POLICY "attachments_insert"
  ON public.attachments FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = attachments.project_id
        AND pm.profile_id = auth.uid()
    )
  );

CREATE POLICY "attachments_update"
  ON public.attachments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = attachments.project_id
        AND pm.profile_id = auth.uid()
    )
  );

CREATE POLICY "attachments_delete"
  ON public.attachments FOR DELETE
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = attachments.project_id
        AND pm.profile_id = auth.uid()
    )
  );

-- 5. Reload PostgREST schema cache ───────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
