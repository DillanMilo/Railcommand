-- =============================================================================
-- Diagnostic + Enforcement: Contributions must stay behind when a project member is removed
-- Date: 2026-04-16
-- Purpose: When a user is removed from a project (or leaves), their contributions
--          (submittals, RFIs, daily logs, photos, etc.) must NOT be cascade-deleted.
--
--          This script:
--          1. Diagnoses current FK behavior on all contribution tables
--          2. Enforces ON DELETE SET NULL for created_by/submitted_by/etc. columns
--             that reference profiles.id, so contributions become "orphaned" (authored
--             by a now-null user) rather than deleted.
--
-- Run in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run.
-- =============================================================================

-- ─── 1. Diagnose current FK behavior ────────────────────────────────────
-- Run this and review results BEFORE running the enforcement below.

SELECT
  tc.table_name AS "Table",
  kcu.column_name AS "Column",
  ccu.table_name AS "References Table",
  ccu.column_name AS "References Column",
  rc.delete_rule AS "On Delete",
  tc.constraint_name AS "Constraint"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'profiles'
  AND ccu.column_name = 'id'
ORDER BY tc.table_name, kcu.column_name;

-- Expected: Any FK from a contribution table (submittals, rfis, daily_logs,
-- punch_list_items, safety_incidents, change_orders, qcqa_reports,
-- project_documents, weekly_reports, modifications, attachments, activity_log)
-- → profiles should be ON DELETE SET NULL (or NO ACTION).
--
-- If any show CASCADE, deleting the profile would destroy their contributions.
-- NOTE: Removing a project_members row does NOT delete the profile, so even
-- CASCADE FKs on profiles → submittals etc. don't trigger on member removal.
-- But we harden these anyway so future profile deletions are safe.

-- ─── 2. Check that project_members removal does NOT cascade elsewhere ──
-- Confirm that deleting a project_members row is self-contained.

SELECT
  tc.table_name AS "Table referencing project_members",
  kcu.column_name AS "Column",
  rc.delete_rule AS "On Delete",
  tc.constraint_name AS "Constraint"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'project_members';

-- Expected: very few (or none). project_members is not referenced by
-- contribution tables — those reference profiles directly.

-- ─── 3. Enforce SET NULL on all contribution → profile FKs ─────────────
-- These ALTER statements make contributions orphan-safe: even if a profile
-- is hard-deleted in the future, the records stay with "deleted user" attribution.

DO $$
DECLARE
  r RECORD;
  sql TEXT;
BEGIN
  FOR r IN
    SELECT
      tc.table_name,
      kcu.column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'profiles'
      AND ccu.column_name = 'id'
      AND rc.delete_rule <> 'SET NULL'
      AND tc.table_name IN (
        'submittals', 'rfis', 'daily_logs', 'punch_list_items',
        'safety_incidents', 'change_orders', 'qcqa_reports',
        'project_documents', 'weekly_reports', 'modifications',
        'attachments', 'activity_log', 'rfi_responses'
      )
      -- Only change attribution columns (not required relationships like project_members.profile_id)
      AND kcu.column_name IN (
        'submitted_by', 'reviewed_by', 'uploaded_by', 'reported_by',
        'approved_by', 'created_by', 'performed_by', 'inspector',
        'issued_by', 'acknowledged_by', 'closed_by', 'author_id'
      )
  LOOP
    -- Drop the old constraint
    sql := format(
      'ALTER TABLE public.%I DROP CONSTRAINT %I',
      r.table_name, r.constraint_name
    );
    EXECUTE sql;

    -- Recreate with SET NULL
    sql := format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
      r.table_name, r.constraint_name, r.column_name
    );
    EXECUTE sql;

    RAISE NOTICE 'Updated % .% → SET NULL on profile delete', r.table_name, r.column_name;
  END LOOP;
END $$;

-- ─── 4. Make the attribution columns nullable (required for SET NULL) ──
-- These were likely NOT NULL before. Relax that to allow orphaned records.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND is_nullable = 'NO'
      AND (table_name, column_name) IN (
        ('submittals', 'submitted_by'),
        ('rfis', 'submitted_by'),
        ('daily_logs', 'created_by'),
        ('punch_list_items', 'created_by'),
        ('safety_incidents', 'reported_by'),
        ('change_orders', 'submitted_by'),
        ('qcqa_reports', 'inspector'),
        ('project_documents', 'uploaded_by'),
        ('weekly_reports', 'submitted_by'),
        ('modifications', 'issued_by'),
        ('attachments', 'uploaded_by'),
        ('activity_log', 'performed_by'),
        ('rfi_responses', 'author_id')
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL',
      r.table_name, r.column_name
    );
    RAISE NOTICE 'Relaxed NOT NULL on %.%', r.table_name, r.column_name;
  END LOOP;
END $$;

-- ─── 5. Reload PostgREST ────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── 6. Final audit — verify everything is in good shape ───────────────
-- Run this last to confirm all contribution FKs are now SET NULL.

SELECT
  tc.table_name AS "Table",
  kcu.column_name AS "Column",
  rc.delete_rule AS "On Delete"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'profiles'
  AND ccu.column_name = 'id'
  AND kcu.column_name IN (
    'submitted_by', 'reviewed_by', 'uploaded_by', 'reported_by',
    'approved_by', 'created_by', 'performed_by', 'inspector',
    'issued_by', 'acknowledged_by', 'closed_by', 'author_id'
  )
ORDER BY tc.table_name, kcu.column_name;
