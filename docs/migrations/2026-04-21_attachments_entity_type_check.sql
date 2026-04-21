-- =============================================================================
-- Migration: Update attachments.entity_type CHECK constraint
-- Date:      2026-04-21
--
-- PURPOSE: The original schema restricted attachments.entity_type to
--          ('submittal', 'rfi', 'daily_log', 'punch_list'). The app has since
--          added three more entity types that can own attachments:
--
--            - safety_incident  (2026-04-10 safety_incidents feature)
--            - project_photo    (photo library)
--            - project_document (2026-04-14 project documents feature)
--
--          Uploads for those entity types fail with:
--            new row for relation "attachments" violates check constraint
--            "attachments_entity_type_check"
--
--          This migration drops the stale constraint and recreates it with
--          the full list that matches src/lib/types.ts:392.
--
-- HOW TO APPLY:
--   Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
--   Idempotent — uses DROP ... IF EXISTS.
-- =============================================================================

alter table public.attachments
  drop constraint if exists attachments_entity_type_check;

alter table public.attachments
  add constraint attachments_entity_type_check
  check (entity_type in (
    'submittal',
    'rfi',
    'daily_log',
    'punch_list',
    'safety_incident',
    'project_photo',
    'project_document'
  ));

notify pgrst, 'reload schema';

-- Verify
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname = 'attachments_entity_type_check';
