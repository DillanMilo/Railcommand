-- LOCAL REHEARSAL ONLY. Not an application migration or a hosted repair script.
-- Caller starts a transaction and supplies the reviewed original row manifest:
-- pg_temp.expected_assignment_rows(id uuid primary key, before_row jsonb).
-- Separately supplied owner-confirmed mappings are required:
-- pg_temp.approved_assignment_targets(id uuid primary key, profile_id uuid,
-- approval_reference text). An empty/missing mapping must stop without changes.
-- Never synthesize a project, profile, approver or approval reference.
DO $guard$
BEGIN
  IF current_database() <> 'railcommand_release_review'
     OR current_setting('railcommand.review_mode', true) IS DISTINCT FROM 'local-copy'
     OR to_regclass('pg_temp.expected_assignment_rows') IS NULL
     OR to_regclass('pg_temp.approved_assignment_targets') IS NULL THEN
    RAISE EXCEPTION 'Local reviewed snapshot and explicit review mode required';
  END IF;
  IF (SELECT count(*) FROM pg_temp.expected_assignment_rows) <> 24
     OR NOT EXISTS (SELECT 1 FROM pg_temp.approved_assignment_targets) THEN
    RAISE EXCEPTION 'Reviewed 24-row manifest and nonempty owner-confirmed mapping required';
  END IF;
END;
$guard$;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '8s';
LOCK TABLE public.punch_list_items IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.profiles, public.projects, public.project_members IN SHARE MODE;

CREATE SCHEMA IF NOT EXISTS inventory_release_review;
REVOKE ALL ON SCHEMA inventory_release_review FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS inventory_release_review.assignment_corrections (
  item_id uuid PRIMARY KEY,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason text NOT NULL CHECK (reason = 'Owner-confirmed reassignment from missing profile'),
  approval_reference text NOT NULL CHECK (length(btrim(approval_reference)) > 0),
  before_row jsonb NOT NULL,
  after_row jsonb NOT NULL,
  CHECK (before_row->>'id' = item_id::text AND after_row->>'id' = item_id::text),
  CHECK (before_row->>'assigned_to' IS NOT NULL AND after_row->>'assigned_to' IS NOT NULL
         AND before_row->>'assigned_to' <> after_row->>'assigned_to')
);
ALTER TABLE inventory_release_review.assignment_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE inventory_release_review.assignment_corrections FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION inventory_release_review.deny_evidence_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $body$
BEGIN
  RAISE EXCEPTION 'Correction evidence is append-only';
END;
$body$;
REVOKE ALL ON FUNCTION inventory_release_review.deny_evidence_change() FROM PUBLIC, anon, authenticated, service_role;
DO $triggers$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'inventory_release_review.assignment_corrections'::regclass AND tgname = 'preserve_correction_evidence') THEN
    CREATE TRIGGER preserve_correction_evidence
      BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_release_review.assignment_corrections
      FOR EACH STATEMENT EXECUTE FUNCTION inventory_release_review.deny_evidence_change();
  END IF;
END;
$triggers$;

-- Reject unknown/changed rows, restored original users, or unavailable targets.
-- Never repair the absent project's items by assigning them to another project.
DO $unchanged$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_temp.approved_assignment_targets a
    LEFT JOIN pg_temp.expected_assignment_rows e ON e.id = a.id
    LEFT JOIN public.punch_list_items p ON p.id = a.id
    LEFT JOIN inventory_release_review.assignment_corrections j ON j.item_id = a.id
    WHERE e.id IS NULL OR p.id IS NULL OR a.profile_id IS NULL
       OR a.approval_reference IS NULL OR length(btrim(a.approval_reference)) = 0
       OR NOT EXISTS (SELECT 1 FROM public.projects project WHERE project.id = p.project_id)
       OR NOT EXISTS (SELECT 1 FROM public.profiles actor
                      JOIN public.project_members member ON member.profile_id = actor.id
                      WHERE actor.id = a.profile_id AND member.project_id = p.project_id)
       OR ((j.item_id IS NULL AND to_jsonb(p) = e.before_row AND p.assigned_to IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.profiles actor WHERE actor.id = p.assigned_to))
           OR (j.before_row = e.before_row AND to_jsonb(p) = j.after_row
               AND j.after_row->>'assigned_to' = a.profile_id::text
               AND j.approval_reference = a.approval_reference)) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Row changed, approval missing, project absent or target not a current project member';
  END IF;
END;
$unchanged$;

CREATE TEMP TABLE corrected_assignment_ids(id uuid PRIMARY KEY) ON COMMIT DROP;
WITH changed AS (
  UPDATE public.punch_list_items p SET assigned_to = a.profile_id
  FROM pg_temp.expected_assignment_rows e
  JOIN pg_temp.approved_assignment_targets a ON a.id = e.id
  WHERE p.id = e.id AND to_jsonb(p) = e.before_row
    AND NOT EXISTS (SELECT 1 FROM inventory_release_review.assignment_corrections j WHERE j.item_id = e.id)
    AND p.assigned_to IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.profiles actor WHERE actor.id = p.assigned_to)
  RETURNING p.id
)
INSERT INTO corrected_assignment_ids SELECT id FROM changed;

INSERT INTO inventory_release_review.assignment_corrections(item_id, reason, approval_reference, before_row, after_row)
SELECT p.id, 'Owner-confirmed reassignment from missing profile', a.approval_reference, e.before_row, to_jsonb(p)
FROM corrected_assignment_ids c
JOIN public.punch_list_items p ON p.id = c.id
JOIN pg_temp.expected_assignment_rows e ON e.id = c.id
JOIN pg_temp.approved_assignment_targets a ON a.id = c.id;

DO $postcondition$
BEGIN
  IF (SELECT count(*) FROM inventory_release_review.assignment_corrections j
      JOIN pg_temp.expected_assignment_rows e ON e.id = j.item_id AND e.before_row = j.before_row
      JOIN pg_temp.approved_assignment_targets a ON a.id = j.item_id)
     <> (SELECT count(*) FROM pg_temp.approved_assignment_targets)
     OR EXISTS (SELECT 1 FROM pg_temp.approved_assignment_targets a
                JOIN public.punch_list_items p ON p.id = a.id WHERE p.assigned_to IS DISTINCT FROM a.profile_id)
     OR EXISTS (SELECT 1 FROM inventory_release_review.assignment_corrections j
                JOIN pg_temp.expected_assignment_rows e ON e.id = j.item_id
                WHERE (j.before_row - 'assigned_to' - 'updated_at')
                      IS DISTINCT FROM (j.after_row - 'assigned_to' - 'updated_at')) THEN
    RAISE EXCEPTION 'Correction evidence incomplete or unrelated fields changed';
  END IF;
END;
$postcondition$;
