-- Migration: Replace direct activity_log inserts with SECURITY DEFINER RPC
-- Date: 2026-04-09
-- Context: Defense-in-depth — revoke direct writes so only the RPC (and
--          existing trigger functions) can insert into activity_log.
--
-- IMPORTANT: Deploy the code changes FIRST (so all call sites use the RPC),
-- then run this migration.

-- 1. Create the RPC function
CREATE OR REPLACE FUNCTION public.log_activity(
  p_project_id   UUID,
  p_entity_type  TEXT,
  p_entity_id    UUID,
  p_action       TEXT,
  p_description  TEXT,
  p_performed_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.activity_log (
    project_id,
    entity_type,
    entity_id,
    action,
    description,
    performed_by
  ) VALUES (
    p_project_id,
    p_entity_type,
    p_entity_id,
    p_action,
    p_description,
    p_performed_by
  );
END;
$$;

-- 2. Revoke direct table writes from client roles
REVOKE INSERT, UPDATE, DELETE ON public.activity_log FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.activity_log FROM authenticated;

-- 3. Grant execute on the new RPC to authenticated users
GRANT EXECUTE ON FUNCTION public.log_activity(UUID, TEXT, UUID, TEXT, TEXT, UUID) TO authenticated;
